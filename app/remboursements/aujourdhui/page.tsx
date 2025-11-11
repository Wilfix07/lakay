'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase, type Remboursement, type UserProfile } from '@/lib/supabase'
import { getUserProfile, signOut } from '@/lib/auth'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/DashboardLayout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CalendarDays, Loader2, RefreshCcw } from 'lucide-react'

type DailyRemboursementRow = {
  id: number
  pretId: string
  membreId: string
  membreName: string
  agentId: string
  agentName: string
  numero: number
  montant: number
  principal: number
  interet: number
  statut: Remboursement['statut']
  datePaiement?: string | null
}

function RemboursementsJourContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [remboursements, setRemboursements] = useState<DailyRemboursementRow[]>([])

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadRemboursements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  async function loadUserProfile() {
    try {
      const profile = await getUserProfile()
      if (!profile) {
        return
      }
      setUserProfile(profile)
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRemboursements() {
    if (!userProfile) return

    try {
      setRefreshing(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayString = today.toISOString().split('T')[0]

      const remboursementsQuery = supabase
        .from('remboursements')
        .select(
          'id, pret_id, membre_id, agent_id, numero_remboursement, montant, principal, interet, date_remboursement, date_paiement, statut'
        )
        .eq('date_remboursement', todayString)
        .order('numero_remboursement', { ascending: true })

      const pretsQuery = supabase
        .from('prets')
        .select('pret_id, montant_pret, nombre_remboursements, membre_id, agent_id')

      const membresQuery = supabase
        .from('membres')
        .select('membre_id, nom, prenom, agent_id')

      const agentsQuery = supabase
        .from('agents')
        .select('agent_id, nom, prenom')

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        remboursementsQuery.eq('agent_id', userProfile.agent_id)
        pretsQuery.eq('agent_id', userProfile.agent_id)
        membresQuery.eq('agent_id', userProfile.agent_id)
      }

      if (userProfile.role === 'manager') {
        // Managers voient tous les remboursements, aucune restriction
      }

      const [remboursementsRes, pretsRes, membresRes, agentsRes] = await Promise.all([
        remboursementsQuery,
        pretsQuery,
        membresQuery,
        agentsQuery,
      ])

      if (remboursementsRes.error) throw remboursementsRes.error
      if (pretsRes.error) throw pretsRes.error
      if (membresRes.error) throw membresRes.error
      if (agentsRes.error) throw agentsRes.error

      const pretMap = new Map((pretsRes.data || []).map((pret) => [pret.pret_id, pret]))
      const membreMap = new Map((membresRes.data || []).map((m) => [m.membre_id, m]))
      const agentMap = new Map((agentsRes.data || []).map((a) => [a.agent_id, a]))

      const computePrincipal = (remboursement: Remboursement) => {
        if (remboursement.principal != null) {
          return Number(remboursement.principal)
        }
        const pret = pretMap.get(remboursement.pret_id)
        if (pret && pret.nombre_remboursements) {
          const base =
            Number(pret.montant_pret || 0) / Number(pret.nombre_remboursements || 1)
          return Math.round(base * 100) / 100
        }
        const fallback =
          Number(remboursement.montant || 0) / 1.15
        return Math.round(fallback * 100) / 100
      }

      const rows: DailyRemboursementRow[] =
        (remboursementsRes.data || []).map((remboursement) => {
          const membre = membreMap.get(remboursement.membre_id)
          const agent = agentMap.get(remboursement.agent_id)
          const principal = computePrincipal(remboursement as Remboursement)
          const montant = Number(remboursement.montant || 0)

          return {
            id: remboursement.id,
            pretId: remboursement.pret_id,
            membreId: remboursement.membre_id,
            membreName: membre
              ? `${membre.prenom ?? ''} ${membre.nom ?? ''}`.trim() || membre.membre_id
              : remboursement.membre_id,
            agentId: remboursement.agent_id,
            agentName: agent
              ? `${agent.prenom ?? ''} ${agent.nom ?? ''}`.trim() || agent.agent_id
              : remboursement.agent_id,
            numero: remboursement.numero_remboursement,
            montant,
            principal,
            interet: Math.max(montant - principal, 0),
            statut: remboursement.statut,
            datePaiement: remboursement.date_paiement,
          }
        }) || []

      setRemboursements(
        rows.sort((a, b) => {
          if (a.agentId === b.agentId) {
            return a.numero - b.numero
          }
          return a.agentId.localeCompare(b.agentId)
        }),
      )
    } catch (error) {
      console.error('Erreur lors du chargement des remboursements du jour:', error)
      alert("Erreur lors du chargement des remboursements d'aujourd'hui")
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSignOut() {
    await signOut()
  }

  const summary = useMemo(() => {
    const totalMontant = remboursements.reduce((sum, item) => sum + item.montant, 0)
    const totalPrincipal = remboursements.reduce((sum, item) => sum + item.principal, 0)
    const totalInteret = remboursements.reduce((sum, item) => sum + item.interet, 0)
    const payes = remboursements.filter((item) => item.statut === 'paye').length
    return {
      count: remboursements.length,
      payes,
      restants: remboursements.length - payes,
      totalMontant,
      totalPrincipal,
      totalInteret,
    }
  }, [remboursements])

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <CalendarDays className="w-7 h-7 text-orange-500" />
              Remboursements du jour
            </h1>
            <p className="text-muted-foreground mt-2">
              Liste des échéances prévues aujourd’hui et état de leurs paiements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/remboursements"
              className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Gérer les remboursements
            </Link>
            <button
              onClick={loadRemboursements}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              disabled={refreshing}
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Remboursements prévus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{summary.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Nombre total d’échéances du jour
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Montant total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(summary.totalMontant)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somme des remboursements attendus aujourd’hui
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Payés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{summary.payes}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.payes > 0
                  ? `${formatCurrency(
                      remboursements
                        .filter((item) => item.statut === 'paye')
                        .reduce((sum, item) => sum + item.montant, 0),
                    )} encaissés`
                  : 'Aucun paiement enregistré pour le moment'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Restant à encaisser
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{summary.restants}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(
                  remboursements
                    .filter((item) => item.statut !== 'paye')
                    .reduce((sum, item) => sum + item.montant, 0),
                )}{' '}
                à encaisser
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Tableau des remboursements du jour</CardTitle>
            <CardDescription>
              Suivez les remboursements prévus aujourd’hui, leur statut et les montants
              associés.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {remboursements.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <CalendarDays className="w-6 h-6 mb-2 text-orange-500" />
                <p>Aucun remboursement prévu pour aujourd’hui.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pret</TableHead>
                      <TableHead>Membre</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-center">#</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Intérêt</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date de paiement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remboursements.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.pretId}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{item.membreName}</span>
                            <span className="text-xs text-muted-foreground">{item.membreId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{item.agentName}</span>
                            <span className="text-xs text-muted-foreground">{item.agentId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.numero}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground">
                          {formatCurrency(item.montant)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(item.principal)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(item.interet)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              item.statut === 'paye'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }
                          >
                            {item.statut === 'paye' ? 'Payé' : 'En attente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.datePaiement ? formatDate(item.datePaiement) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function RemboursementsJourPage() {
  return (
    <ProtectedRoute>
      <RemboursementsJourContent />
    </ProtectedRoute>
  )
}

