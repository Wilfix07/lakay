'use client'

import { useState, useEffect } from 'react'
import { supabase, type Pret, type Membre, type Agent, type UserProfile, type Collateral } from '@/lib/supabase'
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
import { calculateLoanPlan, type FrequenceRemboursement } from '@/lib/loanUtils'

function ApprobationsPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [prets, setPrets] = useState<Pret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [collaterals, setCollaterals] = useState<Collateral[]>([])
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

      const [pretsRes, membresRes, agentsRes, collateralsRes] = await Promise.all([
        // Charger les prêts en attente de garantie (les agents peuvent collecter le collateral sans approbation)
        // Le manager doit approuver pour activer le prêt une fois le collateral complet
        (async () => {
          let query = supabase
            .from('prets')
            .select('*')
            .eq('statut', 'en_attente_garantie')
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
        supabase.from('collaterals').select('*'),
      ])

      if (pretsRes.error) throw pretsRes.error
      if (membresRes.error) throw membresRes.error
      if (agentsRes.error) throw agentsRes.error
      if (collateralsRes.error) throw collateralsRes.error

      setPrets(pretsRes.data || [])
      setMembres(membresRes.data || [])
      setAgents(agentsRes.data || [])
      setCollaterals(collateralsRes.data || [])
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

  function getCollateral(pret_id: string): Collateral | undefined {
    return collaterals.find((c) => c.pret_id === pret_id)
  }

  async function handleApprove(pret: Pret) {
    // Vérifier que la garantie existe et est complète
    const collateral = getCollateral(pret.pret_id)
    
    if (!collateral) {
      alert(`❌ Impossible d'approuver le prêt ${pret.pret_id}.\n\nLa garantie n'a pas été créée. Contactez l'administrateur.`)
      return
    }

    // Vérifier que la garantie est complètement déposée
    const montantDepose = Number(collateral.montant_depose || 0)
    const montantRequis = Number(collateral.montant_requis || 0)
    // Utiliser montant_restant directement (peut être 0, null ou undefined)
    const montantRestant = collateral.montant_restant != null ? Number(collateral.montant_restant) : Math.max(0, montantRequis - montantDepose)

    if (montantDepose < montantRequis || montantRestant > 0) {
      alert(
        `❌ Impossible d'approuver le prêt ${pret.pret_id}.\n\n` +
        `La garantie n'a pas été déposée en totalité.\n\n` +
        `💰 Garantie requise: ${formatCurrency(montantRequis)}\n` +
        `💵 Montant déposé: ${formatCurrency(montantDepose)}\n` +
        `⚠️ Montant restant: ${formatCurrency(montantRestant)}\n\n` +
        `Le membre doit déposer la garantie complète avant que vous puissiez approuver le prêt.\n` +
        `Allez dans "Garanties" pour vérifier et enregistrer les dépôts.`
      )
      return
    }

    if (!confirm(`Approuver le prêt ${pret.pret_id} ?\n\nMontant: ${formatCurrency(pret.montant_pret)}\nMembre: ${getMembre(pret.membre_id)?.prenom} ${getMembre(pret.membre_id)?.nom}\nGarantie: ${formatCurrency(montantDepose)} déposée`)) {
      return
    }

    setApproving(pret.pret_id)
    try {
      // Mettre à jour le statut de la garantie à "complet" si nécessaire
      if (collateral.statut !== 'complet') {
        const { error: collateralUpdateError } = await supabase
          .from('collaterals')
          .update({ statut: 'complet' })
          .eq('pret_id', pret.pret_id)

        if (collateralUpdateError) {
          console.error('Erreur lors de la mise à jour de la garantie:', collateralUpdateError)
          throw new Error('Erreur lors de la mise à jour de la garantie')
        }
      }

      // Mettre à jour le statut du prêt à "en_attente_garantie" d'abord
      const { error: updateError } = await supabase
        .from('prets')
        .update({ statut: 'en_attente_garantie' })
        .eq('pret_id', pret.pret_id)

      if (updateError) throw updateError

      // Si la garantie est complète, activer automatiquement le prêt
      // (créer les remboursements et passer le statut à "actif")
      if (montantDepose >= montantRequis && montantRestant <= 0) {
        // Calculer le plan de remboursement
        const frequency: FrequenceRemboursement = 
          pret.frequence_remboursement === 'mensuel' ? 'mensuel' : 'journalier'
        
        const plan = await calculateLoanPlan(
          pret.montant_pret,
          frequency,
          pret.nombre_remboursements,
          pret.date_decaissement,
        )

        // Créer les remboursements
        const remboursements = plan.schedule.map((entry) => ({
          pret_id: pret.pret_id,
          membre_id: pret.membre_id,
          agent_id: pret.agent_id,
          numero_remboursement: entry.numero,
          montant: entry.montant,
          principal: entry.principal,
          interet: entry.interet,
          date_remboursement: entry.date.toISOString().split('T')[0],
          statut: 'en_attente',
        }))

        const { error: rembError } = await supabase
          .from('remboursements')
          .insert(remboursements)

        if (rembError) throw rembError

        // Activer le prêt
        const { error: activateError } = await supabase
          .from('prets')
          .update({ 
            statut: 'actif',
            updated_at: new Date().toISOString(),
          })
          .eq('pret_id', pret.pret_id)

        if (activateError) throw activateError

        alert(`✅ Prêt ${pret.pret_id} approuvé et activé avec succès!\n\nLa garantie est complète. Le prêt a été activé et les remboursements ont été créés. Le décaissement peut maintenant être effectué.`)
      } else {
        alert(`✅ Prêt ${pret.pret_id} approuvé avec succès!\n\nLe prêt est maintenant en attente de garantie.`)
      }
      
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
              Approuvez les prêts avec garantie complète pour les activer. Les agents peuvent collecter le collateral sans approbation.
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
                Aucun prêt en attente d'approbation
              </p>
              <p className="text-muted-foreground">
                Il n'y a actuellement aucun prêt avec garantie complète en attente d'activation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Prêts en attente d'approbation ({prets.length})</CardTitle>
              <CardDescription>
                Prêts avec garantie complète en attente d'activation. Seuls les prêts avec garantie complète peuvent être approuvés.
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
                    <TableHead>Garantie</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prets.map((pret) => {
                    const membre = getMembre(pret.membre_id)
                    const agent = getAgent(pret.agent_id)
                    const collateral = getCollateral(pret.pret_id)
                    const isProcessing = approving === pret.pret_id
                    
                    const montantDepose = collateral ? Number(collateral.montant_depose || 0) : 0
                    const montantRequis = collateral ? Number(collateral.montant_requis || 0) : 0
                    // Utiliser montant_restant directement (peut être 0, null ou undefined)
                    // Si montant_restant est null/undefined, calculer: max(0, montantRequis - montantDepose)
                    const montantRestant = collateral 
                      ? (collateral.montant_restant != null 
                          ? Number(collateral.montant_restant) 
                          : Math.max(0, montantRequis - montantDepose))
                      : montantRequis
                    const garantieComplete = montantDepose >= montantRequis && montantRestant <= 0

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
                        <TableCell>
                          {collateral ? (
                            <div className="space-y-1">
                              <div className={`text-xs font-semibold ${
                                garantieComplete ? 'text-green-600' : 'text-yellow-600'
                              }`}>
                                {garantieComplete ? '✅ Complète' : '⚠️ Incomplète'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(montantDepose)} / {formatCurrency(montantRequis)}
                              </div>
                              {!garantieComplete && (
                                <div className="text-xs text-red-600">
                                  Reste: {formatCurrency(montantRestant)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-red-600">❌ Aucune garantie</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            onClick={() => handleApprove(pret)}
                            disabled={isProcessing || !garantieComplete}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!garantieComplete ? 'La garantie doit être complète avant d\'approuver' : ''}
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

