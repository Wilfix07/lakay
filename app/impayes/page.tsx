'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  supabase,
  type Agent,
  type Membre,
  type Pret,
  type Remboursement,
  type UserProfile,
} from '@/lib/supabase'
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
import { AlertTriangle, Loader2, RefreshCcw, DollarSign, TrendingUp } from 'lucide-react'

type ImpayeRow = {
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
  dueDate: string
  statut: Remboursement['statut']
  daysLate: number
}

function ImpayesPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [impayes, setImpayes] = useState<ImpayeRow[]>([])
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (!userProfile) return

    // Charger les impayés initiaux
    loadImpayes()

    // Configurer les subscriptions Supabase Realtime pour rendre la page totalement dynamique
    const subscriptions: Array<{ channel: any; unsubscribe: () => void }> = []

    // Construire les filtres selon le rôle
    let remboursementsFilter = ''
    let pretsFilter = ''
    let membresFilter = ''

    if (userProfile.role === 'agent' && userProfile.agent_id) {
      remboursementsFilter = `agent_id=eq.${userProfile.agent_id}`
      pretsFilter = `agent_id=eq.${userProfile.agent_id}`
      membresFilter = `agent_id=eq.${userProfile.agent_id}`
    }

    // Subscription pour les remboursements
    const remboursementsChannel = supabase
      .channel('impayes-remboursements')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'remboursements',
          filter: remboursementsFilter || undefined,
        },
        (payload) => {
          console.log('📊 Changement détecté dans remboursements (Impayés):', payload.eventType)
          // Mettre à jour immédiatement sans afficher le spinner de rafraîchissement
          loadImpayes(false)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
          console.log('✅ Subscription remboursements Impayés active')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erreur de subscription remboursements Impayés')
          setRealtimeConnected(false)
        }
      })

    subscriptions.push({
      channel: remboursementsChannel,
      unsubscribe: () => remboursementsChannel.unsubscribe(),
    })

    // Subscription pour les prêts (pour mettre à jour les informations de prêt)
    const pretsChannel = supabase
      .channel('impayes-prets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prets',
          filter: pretsFilter || undefined,
        },
        (payload) => {
          console.log('📊 Changement détecté dans prets (Impayés):', payload.eventType)
          loadImpayes(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: pretsChannel,
      unsubscribe: () => pretsChannel.unsubscribe(),
    })

    // Subscription pour les membres (pour mettre à jour les noms)
    const membresChannel = supabase
      .channel('impayes-membres')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'membres',
          filter: membresFilter || undefined,
        },
        (payload) => {
          console.log('👥 Changement détecté dans membres (Impayés):', payload.eventType)
          loadImpayes(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: membresChannel,
      unsubscribe: () => membresChannel.unsubscribe(),
    })

    // Rafraîchissement périodique de secours (toutes les 60 secondes) au cas où les subscriptions échouent
    const intervalId = setInterval(() => {
      if (!realtimeConnected) {
        // Si Realtime n'est pas connecté, rafraîchir plus souvent
        loadImpayes(false)
      }
    }, 60000) // 60 secondes comme backup

    // Nettoyer les subscriptions et l'intervalle lors du démontage
    return () => {
      console.log('🧹 Nettoyage des subscriptions Impayés')
      subscriptions.forEach((sub) => sub.unsubscribe())
      clearInterval(intervalId)
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

  async function loadImpayes(showRefreshing = true) {
    if (!userProfile) return
    try {
      if (showRefreshing) {
        setRefreshing(true)
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const remboursementsQuery = supabase
        .from('remboursements')
        .select(
          'id, pret_id, membre_id, agent_id, numero_remboursement, montant, principal, interet, date_remboursement, statut, date_paiement'
        )
        .in('statut', ['en_attente', 'en_retard'] as Remboursement['statut'][] )
        .order('date_remboursement', { ascending: true })

      const pretsQuery = supabase
        .from('prets')
        .select('pret_id, montant_pret, nombre_remboursements, membre_id, agent_id, statut')

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

      const getPrincipalValue = (remboursement: Remboursement) => {
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

      const overdue = (remboursementsRes.data || []).filter((remboursement) => {
        if (remboursement.statut === 'en_retard') return true
        if (remboursement.statut === 'en_attente' && remboursement.date_remboursement) {
          const dueDate = new Date(remboursement.date_remboursement)
          if (Number.isNaN(dueDate.getTime())) return false
          dueDate.setHours(0, 0, 0, 0)
          return dueDate < today
        }
        return false
      })

      const enriched: ImpayeRow[] = overdue.map((remboursement) => {
        const membre = membreMap.get(remboursement.membre_id)
        const agent = agentMap.get(remboursement.agent_id)
        const principal = getPrincipalValue(remboursement as Remboursement)
        const montant = Number(remboursement.montant || 0)
        const dueDate = remboursement.date_remboursement
        const due = dueDate ? new Date(dueDate) : null
        let daysLate = 0
        if (due && !Number.isNaN(due.getTime())) {
          due.setHours(0, 0, 0, 0)
          const diffTime = today.getTime() - due.getTime()
          daysLate = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0
        }
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
          dueDate: dueDate || '',
          statut: remboursement.statut,
          daysLate,
        }
      })

      setImpayes(
        enriched.sort((a, b) => {
          if (a.dueDate === b.dueDate) {
            return a.numero - b.numero
          }
          return a.dueDate.localeCompare(b.dueDate)
        }),
      )
    } catch (error) {
      console.error('Erreur lors du chargement des impayés:', error)
      alert('Erreur lors du chargement des impayés')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

  const summary = useMemo(() => {
    const totalPrincipal = impayes.reduce((sum, item) => sum + item.principal, 0)
    const totalMontant = impayes.reduce((sum, item) => sum + item.montant, 0)
    const totalInteret = impayes.reduce((sum, item) => sum + item.interet, 0)
    return {
      count: impayes.length,
      totalPrincipal,
      totalMontant,
      totalInteret,
    }
  }, [impayes])

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
              <AlertTriangle className="w-7 h-7 text-red-500" />
              Impayés
            </h1>
            <p className="text-muted-foreground mt-2">
              Suivi des échéances en retard et des principaux restants dus
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/remboursements"
              className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Aller aux remboursements
            </Link>
            <button
              onClick={loadImpayes}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              disabled={refreshing}
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Échéances en retard
              </CardTitle>
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{summary.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Remboursements à traiter en priorité
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Principal impayé
              </CardTitle>
              <div className="p-2 rounded-lg bg-orange-50">
                <DollarSign className="w-4 h-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(summary.totalPrincipal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somme des capitaux en retard
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Montant total dû
              </CardTitle>
              <div className="p-2 rounded-lg bg-rose-50">
                <TrendingUp className="w-4 h-4 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(summary.totalMontant)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Principal + intérêt en attente de paiement
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Liste des impayés</CardTitle>
              <CardDescription>
                Détails des remboursements en retard, triés par date d’échéance
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="bg-red-100 text-red-700"
            >
              {formatCurrency(summary.totalPrincipal)} de principal en retard
            </Badge>
          </CardHeader>
          <CardContent>
            {impayes.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <AlertTriangle className="w-6 h-6 mb-2 text-amber-500" />
                <p>Aucun impayé pour le moment.</p>
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
                      <TableHead>Date prévue</TableHead>
                      <TableHead className="text-center">Jours de retard</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Intérêt</TableHead>
                      <TableHead className="text-right">Montant dû</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impayes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.pretId}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{item.membreName}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.membreId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{item.agentName}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.agentId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.numero}</TableCell>
                        <TableCell>{item.dueDate ? formatDate(item.dueDate) : '-'}</TableCell>
                        <TableCell className="text-center">
                          {item.daysLate > 0 ? (
                            <Badge variant="secondary" className="bg-red-100 text-red-700">
                              {item.daysLate} j
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              À traiter
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground">
                          {formatCurrency(item.principal)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(item.interet)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground">
                          {formatCurrency(item.montant)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              item.statut === 'en_retard'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }
                          >
                            {item.statut === 'en_retard' ? 'En retard' : 'En attente'}
                          </Badge>
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

export default function ImpayesPage() {
  return (
    <ProtectedRoute>
      <ImpayesPageContent />
    </ProtectedRoute>
  )
}

