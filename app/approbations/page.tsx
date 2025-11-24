'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase, type Pret, type Membre, type Agent, type UserProfile, type Collateral, type GroupPret } from '@/lib/supabase'
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
import { Loader2, CheckCircle2, XCircle, AlertCircle, Eye, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calculateCollateralAmount } from '@/lib/systemSettings'
import { calculateLoanPlan, type FrequenceRemboursement } from '@/lib/loanUtils'

function ApprobationsPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [collaterals, setCollaterals] = useState<Collateral[]>([])
  const [groups, setGroups] = useState<Array<{ id: number; group_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [approvingGroup, setApprovingGroup] = useState<string | null>(null)
  const [selectedPret, setSelectedPret] = useState<Pret | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [groupCollateralsComplete, setGroupCollateralsComplete] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadData()
    }
  }, [userProfile])

  // Calculer les états de complétude des garanties pour les prêts de groupe
  useEffect(() => {
    async function calculateGroupCollateralsComplete() {
      const completeMap: Record<string, boolean> = {}
      for (const groupPret of groupPrets) {
        completeMap[groupPret.pret_id] = await areAllGroupCollateralsComplete(groupPret.pret_id)
      }
      setGroupCollateralsComplete(completeMap)
    }
    
    if (groupPrets.length > 0) {
      calculateGroupCollateralsComplete()
    } else {
      setGroupCollateralsComplete({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupPrets])

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

      const [pretsRes, groupPretsRes, membresRes, agentsRes, collateralsRes, groupsRes] = await Promise.all([
        // Charger les prêts individuels en attente de garantie
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
        // Charger les prêts de groupe en attente de garantie
        (async () => {
          let query = supabase
            .from('group_prets')
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
        supabase.from('membre_groups').select('id, group_name'),
      ])

      if (pretsRes.error) throw pretsRes.error
      if (groupPretsRes.error) {
        // Si la table group_prets n'existe pas, ignorer l'erreur
        const isTableNotFound = 
          groupPretsRes.error?.code === 'PGRST116' || 
          groupPretsRes.error?.code === '42P01' ||
          groupPretsRes.error?.message?.includes('404') ||
          groupPretsRes.error?.message?.includes('does not exist')
        
        if (!isTableNotFound) throw groupPretsRes.error
      }
      if (membresRes.error) throw membresRes.error
      if (agentsRes.error) throw agentsRes.error
      if (collateralsRes.error) throw collateralsRes.error
      if (groupsRes.error) {
        // Ignorer l'erreur si la table n'existe pas
        const isTableNotFound = 
          groupsRes.error?.code === 'PGRST116' || 
          groupsRes.error?.code === '42P01' ||
          groupsRes.error?.message?.includes('404') ||
          groupsRes.error?.message?.includes('does not exist')
        
        if (!isTableNotFound) throw groupsRes.error
      }

      setPrets(pretsRes.data || [])
      setGroupPrets(groupPretsRes.data || [])
      setMembres(membresRes.data || [])
      setAgents(agentsRes.data || [])
      setCollaterals(collateralsRes.data || [])
      setGroups(groupsRes.data || [])
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

  function getGroupCollaterals(group_pret_id: string): Collateral[] {
    return collaterals.filter((c) => c.group_pret_id === group_pret_id)
  }

  async function areAllGroupCollateralsComplete(group_pret_id: string): Promise<boolean> {
    // Récupérer le prêt de groupe pour obtenir les membres
    const groupPret = groupPrets.find(gp => gp.pret_id === group_pret_id)
    if (!groupPret) return false

    // Récupérer les membres du groupe
    const { data: groupMembers, error: membersError } = await supabase
      .from('membre_group_members')
      .select('membre_id')
      .eq('group_id', groupPret.group_id)

    if (membersError || !groupMembers || groupMembers.length === 0) return false

    // Récupérer les montants individuels depuis les remboursements
    const { data: remboursements, error: rembError } = await supabase
      .from('group_remboursements')
      .select('membre_id, montant')
      .eq('pret_id', group_pret_id)

    if (rembError) return false

    // Calculer le montant de prêt par membre
    const montantsParMembre = new Map<string, number>()
    remboursements?.forEach(r => {
      const current = montantsParMembre.get(r.membre_id) || 0
      montantsParMembre.set(r.membre_id, current + Number(r.montant || 0))
    })

    // Vérifier que chaque membre a sa garantie bloquée
    const { calculateCollateralAmount } = await import('@/lib/systemSettings')
    
    for (const member of groupMembers) {
      const montantPret = montantsParMembre.get(member.membre_id) || 0
      if (montantPret <= 0) continue

      const montantGarantieRequis = await calculateCollateralAmount(montantPret)
      
      const { data: blockedTransactions, error: epargneError } = await supabase
        .from('epargne_transactions')
        .select('montant, type')
        .eq('membre_id', member.membre_id)
        .eq('blocked_for_group_pret_id', group_pret_id)
        .eq('is_blocked', true)

      if (epargneError) return false

      const montantBloque = blockedTransactions?.reduce((sum, t) => {
        if (t.type === 'depot') {
          return sum + Number(t.montant || 0)
        }
        return sum
      }, 0) || 0

      if (montantBloque < montantGarantieRequis) {
        return false
      }
    }

    return true
  }

  function getGroupName(group_id: number): string {
    const group = groups.find(g => g.id === group_id)
    return group?.group_name || `Groupe ${group_id}`
  }

  const filteredPrets = useMemo(() => {
    if (!activeSearch) {
      return prets
    }

    const searchTerm = activeSearch.toLowerCase().trim()

    return prets.filter((pret) => {
      // Recherche par numéro de prêt
      const pretId = (pret.pret_id || '').toLowerCase()
      if (pretId.includes(searchTerm)) {
        return true
      }

      // Recherche par agent (ID agent, nom agent)
      const agent = getAgent(pret.agent_id)
      if (agent) {
        const agentId = (agent.agent_id || '').toLowerCase()
        const agentName = `${agent.prenom || ''} ${agent.nom || ''}`.toLowerCase().trim()
        if (agentId.includes(searchTerm) || agentName.includes(searchTerm)) {
          return true
        }
      }

      // Recherche par membre (ID membre, nom membre)
      const membre = getMembre(pret.membre_id)
      if (membre) {
        const membreId = (membre.membre_id || '').toLowerCase()
        const membreName = `${membre.prenom || ''} ${membre.nom || ''}`.toLowerCase().trim()
        if (membreId.includes(searchTerm) || membreName.includes(searchTerm)) {
          return true
        }
      }

      // Recherche par date de demande (created_at)
      const dateDemande = new Date(pret.created_at)
      const dateISO = dateDemande.toISOString().split('T')[0]
      const dateFormatted = formatDate(pret.created_at).toLowerCase()
      if (dateISO.includes(searchTerm) || dateFormatted.includes(searchTerm)) {
        return true
      }

      return false
    })
  }, [prets, activeSearch, agents, membres])

  const filteredGroupPrets = useMemo(() => {
    if (!activeSearch) {
      return groupPrets
    }

    const searchTerm = activeSearch.toLowerCase().trim()

    return groupPrets.filter((groupPret) => {
      // Recherche par numéro de prêt
      const pretId = (groupPret.pret_id || '').toLowerCase()
      if (pretId.includes(searchTerm)) {
        return true
      }

      // Recherche par agent (ID agent, nom agent)
      const agent = getAgent(groupPret.agent_id)
      if (agent) {
        const agentId = (agent.agent_id || '').toLowerCase()
        const agentName = `${agent.prenom || ''} ${agent.nom || ''}`.toLowerCase().trim()
        if (agentId.includes(searchTerm) || agentName.includes(searchTerm)) {
          return true
        }
      }

      // Recherche par groupe (nom du groupe)
      const groupName = getGroupName(groupPret.group_id).toLowerCase()
      if (groupName.includes(searchTerm)) {
        return true
      }

      // Recherche par date de demande (created_at)
      const dateDemande = new Date(groupPret.created_at)
      const dateISO = dateDemande.toISOString().split('T')[0]
      const dateFormatted = formatDate(groupPret.created_at).toLowerCase()
      if (dateISO.includes(searchTerm) || dateFormatted.includes(searchTerm)) {
        return true
      }

      return false
    })
  }, [groupPrets, activeSearch, agents, groups])

  async function handleApprove(pret: Pret) {
    // Ne pas générer de calendrier pour les prêts rejetés
    if (pret.statut === 'annule') {
      alert('Ce prêt a été rejeté et ne peut pas être approuvé.')
      return
    }

    // Calculer le montant de garantie requis
    const { calculateCollateralAmount } = await import('@/lib/systemSettings')
    const montantGarantieRequis = await calculateCollateralAmount(pret.montant_pret)

    // Vérifier que la garantie est bloquée sur le compte épargne
    const { data: blockedTransactions, error: epargneError } = await supabase
      .from('epargne_transactions')
      .select('montant, type')
      .eq('membre_id', pret.membre_id)
      .eq('blocked_for_pret_id', pret.pret_id)
      .eq('is_blocked', true)

    if (epargneError) {
      console.error('Erreur lors de la vérification de la garantie:', epargneError)
      alert(`❌ Erreur lors de la vérification de la garantie. Contactez l'administrateur.`)
      return
    }

    // Calculer le montant bloqué
    const montantBloque = blockedTransactions?.reduce((sum, t) => {
      if (t.type === 'depot') {
        return sum + Number(t.montant || 0)
      }
      return sum
    }, 0) || 0

    if (montantBloque < montantGarantieRequis) {
      alert(
        `❌ Impossible d'approuver le prêt ${pret.pret_id}.\n\n` +
        `La garantie n'est pas complètement bloquée sur le compte épargne.\n\n` +
        `💰 Garantie requise: ${formatCurrency(montantGarantieRequis)}\n` +
        `💵 Montant bloqué: ${formatCurrency(montantBloque)}\n` +
        `⚠️ Montant manquant: ${formatCurrency(montantGarantieRequis - montantBloque)}\n\n` +
        `L'agent de crédit doit bloquer la garantie complète sur le compte épargne du membre avant que vous puissiez approuver le prêt.\n` +
        `Allez dans "Épargnes" pour bloquer la garantie.`
      )
      return
    }

    if (!confirm(`Approuver le prêt ${pret.pret_id} ?\n\nMontant: ${formatCurrency(pret.montant_pret)}\nMembre: ${getMembre(pret.membre_id)?.prenom} ${getMembre(pret.membre_id)?.nom}\nGarantie bloquée: ${formatCurrency(montantBloque)}`)) {
      return
    }

    setApproving(pret.pret_id)
    try {

      // La garantie est complète, donc on peut activer le prêt directement
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

      if (rembError) {
        console.error('Erreur lors de la création des remboursements:', rembError)
        throw new Error('Erreur lors de la création des remboursements: ' + rembError.message)
      }

      // Activer le prêt directement (statut = 'actif')
      const { error: activateError } = await supabase
        .from('prets')
        .update({ 
          statut: 'actif',
          updated_at: new Date().toISOString(),
        })
        .eq('pret_id', pret.pret_id)

      if (activateError) {
        console.error('Erreur lors de l\'activation du prêt:', activateError)
        throw new Error('Erreur lors de l\'activation du prêt: ' + activateError.message)
      }

      alert(`✅ Prêt ${pret.pret_id} approuvé et activé avec succès!\n\nLa garantie est bloquée sur le compte épargne. Le prêt a été activé et les remboursements ont été créés. Le décaissement peut maintenant être effectué.`)
      
      await loadData()
    } catch (error: any) {
      console.error('Erreur lors de l\'approbation:', error)
      const errorMessage = error?.message || error?.toString() || 'Erreur inconnue'
      alert(`Erreur lors de l'approbation du prêt:\n\n${errorMessage}\n\nVérifiez la console pour plus de détails.`)
    } finally {
      setApproving(null)
    }
  }

  async function handleApproveGroupPret(groupPret: GroupPret) {
    // Ne pas générer de calendrier pour les prêts rejetés
    if (groupPret.statut === 'annule') {
      alert('Ce prêt a été rejeté et ne peut pas être approuvé.')
      return
    }

    // Vérifier que toutes les garanties sont bloquées sur les comptes épargne
    const allComplete = await areAllGroupCollateralsComplete(groupPret.pret_id)
    
    if (!allComplete) {
      alert(
        `❌ Impossible d'approuver le prêt de groupe ${groupPret.pret_id}.\n\n` +
        `Toutes les garanties des membres doivent être bloquées sur leurs comptes épargne.\n\n` +
        `L'agent de crédit doit bloquer la garantie complète pour chaque membre avant que vous puissiez approuver le prêt.\n` +
        `Allez dans "Épargnes" pour bloquer les garanties.`
      )
      return
    }

    if (!confirm(`Approuver le prêt de groupe ${groupPret.pret_id} ?\n\nMontant total: ${formatCurrency(groupPret.montant_pret)}\nAgent: ${getAgent(groupPret.agent_id)?.prenom} ${getAgent(groupPret.agent_id)?.nom}\nToutes les garanties sont complètes`)) {
      return
    }

    setApprovingGroup(groupPret.pret_id)
    try {
      // Récupérer les membres du groupe et leurs montants depuis les remboursements déjà créés
      const { data: groupRemboursements, error: rembError } = await supabase
        .from('group_remboursements')
        .select('membre_id, montant, numero_remboursement')
        .eq('pret_id', groupPret.pret_id)
        .order('membre_id')
        .order('numero_remboursement')

      if (rembError) throw rembError

      // Les remboursements ont déjà été créés lors de la création du prêt
      // On doit juste activer le prêt

      // Activer le prêt de groupe
      const { error: activateError } = await supabase
        .from('group_prets')
        .update({ 
          statut: 'actif',
          updated_at: new Date().toISOString(),
        })
        .eq('pret_id', groupPret.pret_id)

      if (activateError) throw activateError

      alert(`✅ Prêt de groupe ${groupPret.pret_id} approuvé et activé avec succès!\n\nToutes les garanties sont bloquées sur les comptes épargne. Le prêt a été activé et les remboursements ont été créés pour tous les membres. Le décaissement peut maintenant être effectué.`)
      
      await loadData()
    } catch (error) {
      console.error('Erreur lors de l\'approbation du prêt de groupe:', error)
      alert('Erreur lors de l\'approbation du prêt de groupe')
    } finally {
      setApprovingGroup(null)
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

  async function handleRejectGroupPret(groupPret: GroupPret) {
    const reason = prompt(`Rejeter le prêt de groupe ${groupPret.pret_id} ?\n\nEntrez une raison (optionnel):`)
    if (reason === null) return // User cancelled

    setApprovingGroup(groupPret.pret_id)
    try {
      const { error: updateError } = await supabase
        .from('group_prets')
        .update({ statut: 'annule' })
        .eq('pret_id', groupPret.pret_id)

      if (updateError) throw updateError

      alert(`❌ Prêt de groupe ${groupPret.pret_id} rejeté.`)
      await loadData()
    } catch (error) {
      console.error('Erreur lors du rejet du prêt de groupe:', error)
      alert('Erreur lors du rejet du prêt de groupe')
    } finally {
      setApprovingGroup(null)
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
        ) : prets.length === 0 && groupPrets.length === 0 ? (
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
              <CardTitle>Prêts en attente d'approbation ({filteredPrets.length + filteredGroupPrets.length} sur {prets.length + groupPrets.length})</CardTitle>
              <CardDescription>
                Prêts avec garantie complète en attente d'activation. Seuls les prêts avec garantie complète peuvent être approuvés.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Recherche */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Recherche</h3>
                  {activeSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchInput('')
                        setActiveSearch('')
                      }}
                      className="ml-auto h-7 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Réinitialiser
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Rechercher par ID agent, numéro de prêt, ID membre, nom membre ou date demande..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setActiveSearch(searchInput)
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => setActiveSearch(searchInput)}
                    className="px-6"
                  >
                    Rechercher
                  </Button>
                </div>
                {activeSearch && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    {filteredPrets.length + filteredGroupPrets.length} prêt(s) trouvé(s) sur {prets.length + groupPrets.length}
                  </div>
                )}
              </div>

              {filteredPrets.length === 0 && filteredGroupPrets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>
                    {prets.length === 0 && groupPrets.length === 0
                      ? "Aucun prêt en attente d'approbation"
                      : "Aucun prêt ne correspond aux filtres sélectionnés"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prêt</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Membre/Groupe</TableHead>
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
                  {/* Prêts individuels */}
                  {filteredPrets.map((pret) => {
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
                      <TableRow key={`pret-${pret.id}`}>
                        <TableCell className="font-medium">{pret.pret_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Individuel</Badge>
                        </TableCell>
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
                  {/* Prêts de groupe */}
                  {filteredGroupPrets.map((groupPret) => {
                    const agent = getAgent(groupPret.agent_id)
                    const groupCollaterals = getGroupCollaterals(groupPret.pret_id)
                    const isProcessing = approvingGroup === groupPret.pret_id
                    const allComplete = groupCollateralsComplete[groupPret.pret_id] ?? false
                    
                    const totalRequis = groupCollaterals.reduce((sum, c) => sum + Number(c.montant_requis || 0), 0)
                    const totalDepose = groupCollaterals.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0)
                    const totalRestant = groupCollaterals.reduce((sum, c) => sum + Number(c.montant_restant || 0), 0)
                    const completeCount = groupCollaterals.filter(c => c.statut === 'complet' && c.montant_restant === 0).length
                    const totalMembers = groupCollaterals.length

                    return (
                      <TableRow key={`group-${groupPret.id}`}>
                        <TableCell className="font-medium">
                          <span className="text-blue-600">👥 {groupPret.pret_id}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-blue-100 text-blue-700">Groupe</Badge>
                        </TableCell>
                        <TableCell>
                          {getGroupName(groupPret.group_id)}
                        </TableCell>
                        <TableCell>
                          {agent ? `${agent.prenom} ${agent.nom} (${agent.agent_id})` : groupPret.agent_id}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(groupPret.montant_pret)}
                        </TableCell>
                        <TableCell>
                          {groupPret.nombre_remboursements} × {formatCurrency(groupPret.montant_remboursement)}
                        </TableCell>
                        <TableCell>{formatDate(groupPret.date_decaissement)}</TableCell>
                        <TableCell>{formatDate(groupPret.created_at)}</TableCell>
                        <TableCell>
                          {groupCollaterals.length > 0 ? (
                            <div className="space-y-1">
                              <div className={`text-xs font-semibold ${
                                allComplete ? 'text-green-600' : 'text-yellow-600'
                              }`}>
                                {allComplete ? '✅ Toutes complètes' : `⚠️ ${completeCount}/${totalMembers} complètes`}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(totalDepose)} / {formatCurrency(totalRequis)}
                              </div>
                              {!allComplete && (
                                <div className="text-xs text-red-600">
                                  Reste: {formatCurrency(totalRestant)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-red-600">❌ Aucune garantie</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            onClick={() => handleApproveGroupPret(groupPret)}
                            disabled={isProcessing || !allComplete}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!allComplete ? 'Toutes les garanties doivent être complètes avant d\'approuver' : ''}
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
                            onClick={() => handleRejectGroupPret(groupPret)}
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
                </div>
              )}
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

