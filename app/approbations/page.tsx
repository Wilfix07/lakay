'use client'

import { useState, useEffect } from 'react'
import { supabase, type Pret, type Membre, type Agent, type UserProfile } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Eye } from 'lucide-react'
import { calculateCollateralAmount } from '@/lib/systemSettings'

function ApprobationsPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [prets, setPrets] = useState<Pret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [selectedPret, setSelectedPret] = useState<Pret | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadData()
    }
  }, [userProfile])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
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

  async function loadData() {
    setLoading(true)
    try {
      if (!userProfile) return

      // Charger les agents du manager
      let agentQuery = supabase.from('agents').select('*')
      if (userProfile.role === 'manager') {
        agentQuery = agentQuery.eq('manager_id', userProfile.id)
      }

      const [pretsRes, membresRes, agentsRes] = await Promise.all([
        // Charger uniquement les prêts en attente d'approbation
        (async () => {
          let query = supabase
            .from('prets')
            .select('*')
            .eq('statut', 'en_attente_approbation')
            .order('created_at', { ascending: false })

          if (userProfile.role === 'manager') {
            const { data: managerAgents } = await supabase
              .from('agents')
              .select('agent_id')
              .eq('manager_id', userProfile.id)

            const agentIds = managerAgents?.map(a => a.agent_id) || []
            if (agentIds.length > 0) {
              query = query.in('agent_id', agentIds)
            } else {
              return { data: [], error: null }
            }
          }

          return await query
        })(),
        supabase.from('membres').select('*'),
        agentQuery,
      ])

      if (pretsRes.error) throw pretsRes.error
      if (membresRes.error) throw membresRes.error
      if (agentsRes.error) throw agentsRes.error

      setPrets(pretsRes.data || [])
      setMembres(membresRes.data || [])
      setAgents(agentsRes.data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
      alert('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  function getMembre(membre_id: string): Membre | undefined {
    return membres.find((m) => m.membre_id === membre_id)
  }

  function getAgent(agent_id: string): Agent | undefined {
    return agents.find((a) => a.agent_id === agent_id)
  }

  async function handleApprove(pret: Pret) {
    if (!confirm(`Approuver le prêt ${pret.pret_id} ?\n\nMontant: ${formatCurrency(pret.montant_pret)}\nMembre: ${getMembre(pret.membre_id)?.prenom} ${getMembre(pret.membre_id)?.nom}`)) {
      return
    }

    setApproving(pret.pret_id)
    try {
      // Créer la garantie (collateral) si elle n'existe pas déjà
      const { data: existingCollateral } = await supabase
        .from('collaterals')
        .select('id')
        .eq('pret_id', pret.pret_id)
        .single()

      if (!existingCollateral) {
        const montantGarantieRequis = await calculateCollateralAmount(pret.montant_pret)
        const { error: collateralError } = await supabase
          .from('collaterals')
          .insert([{
            pret_id: pret.pret_id,
            membre_id: pret.membre_id,
            montant_requis: montantGarantieRequis,
            montant_depose: 0,
            montant_restant: montantGarantieRequis,
            statut: 'partiel',
            notes: `Garantie générée automatiquement pour le prêt ${pret.pret_id} après approbation`,
          }])

        if (collateralError) {
          console.error('Erreur lors de la création de la garantie:', collateralError)
          throw new Error('Erreur lors de la création de la garantie')
        }
      }

      // Mettre à jour le statut du prêt
      const { error: updateError } = await supabase
        .from('prets')
        .update({ statut: 'en_attente_garantie' })
        .eq('pret_id', pret.pret_id)

      if (updateError) throw updateError

      alert(`✅ Prêt ${pret.pret_id} approuvé avec succès!\n\nLe prêt est maintenant en attente de garantie.`)
      await loadData()
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error)
      alert('Erreur lors de l\'approbation du prêt')
    } finally {
      setApproving(null)
    }
  }

  async function handleReject(pret: Pret) {
    const reason = prompt(`Rejeter le prêt ${pret.pret_id} ?\n\nEntrez une raison (optionnel):`)
    if (reason === null) return // User cancelled

    setApproving(pret.pret_id)
    try {
      const { error: updateError } = await supabase
        .from('prets')
        .update({ statut: 'annule' })
        .eq('pret_id', pret.pret_id)

      if (updateError) throw updateError

      alert(`❌ Prêt ${pret.pret_id} rejeté.`)
      await loadData()
    } catch (error) {
      console.error('Erreur lors du rejet:', error)
      alert('Erreur lors du rejet du prêt')
    } finally {
      setApproving(null)
    }
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (userProfile.role !== 'manager' && userProfile.role !== 'admin') {
    return (
      <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Accès restreint</CardTitle>
              <CardDescription>
                Cette section est réservée aux managers et administrateurs.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Approbations de prêts
            </h1>
            <p className="text-muted-foreground mt-2">
              Approuvez ou rejetez les demandes de prêts de vos agents avant le décaissement.
            </p>
          </div>
          <Button
            onClick={loadData}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 mr-2" />
            )}
            Actualiser
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : prets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                Aucune demande en attente
              </p>
              <p className="text-muted-foreground">
                Il n'y a actuellement aucune demande de prêt en attente d'approbation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Demandes en attente ({prets.length})</CardTitle>
              <CardDescription>
                Les prêts créés par vos agents nécessitent votre approbation avant le décaissement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prêt</TableHead>
                    <TableHead>Membre</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Échéances</TableHead>
                    <TableHead>Date décaissement</TableHead>
                    <TableHead>Date demande</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prets.map((pret) => {
                    const membre = getMembre(pret.membre_id)
                    const agent = getAgent(pret.agent_id)
                    const isProcessing = approving === pret.pret_id

                    return (
                      <TableRow key={pret.id}>
                        <TableCell className="font-medium">{pret.pret_id}</TableCell>
                        <TableCell>
                          {membre ? `${membre.prenom} ${membre.nom}` : pret.membre_id}
                        </TableCell>
                        <TableCell>
                          {agent ? `${agent.prenom} ${agent.nom} (${agent.agent_id})` : pret.agent_id}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(pret.montant_pret)}
                        </TableCell>
                        <TableCell>
                          {pret.nombre_remboursements} × {formatCurrency(pret.montant_remboursement)}
                        </TableCell>
                        <TableCell>{formatDate(pret.date_decaissement)}</TableCell>
                        <TableCell>{formatDate(pret.created_at)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            onClick={() => handleApprove(pret)}
                            disabled={isProcessing}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Approuver
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleReject(pret)}
                            disabled={isProcessing}
                            size="sm"
                            variant="destructive"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 mr-1" />
                                Rejeter
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function ApprobationsPage() {
  return (
    <ProtectedRoute requiredRole={['admin', 'manager']}>
      <ApprobationsPageContent />
    </ProtectedRoute>
  )
}

