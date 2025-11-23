'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Membre, type UserProfile, type ChefZoneMembre, type Agent } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, UserPlus, X, ArrowRightLeft, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function AssignerMembresChefZoneContent() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [chefsZone, setChefsZone] = useState<UserProfile[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedChefZone, setSelectedChefZone] = useState<string>('')
  const [assignations, setAssignations] = useState<Record<string, string[]>>({}) // chef_zone_id -> membre_ids[]
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferChefZone, setTransferChefZone] = useState<UserProfile | null>(null)
  const [transferFromAgentId, setTransferFromAgentId] = useState<string>('')
  const [transferToAgentId, setTransferToAgentId] = useState<string>('')
  const [transferSaving, setTransferSaving] = useState(false)
  
  // Sélection d'agent source (pour voir ses chefs de zone et membres)
  const [selectedSourceAgentId, setSelectedSourceAgentId] = useState<string>('')
  
  // Filtres additionnels
  const [filterTypeMembre, setFilterTypeMembre] = useState<'tous' | 'individuel' | 'groupe'>('tous')
  const [filterStatut, setFilterStatut] = useState<'tous' | 'actif' | 'inactif'>('tous')
  
  // Données pour les filtres
  const [activePrets, setActivePrets] = useState<Set<string>>(new Set()) // Set de membre_id avec prêts actifs
  const [groupMembres, setGroupMembres] = useState<Set<string>>(new Set()) // Set de membre_id dans des groupes
  
  // Transfert entre chefs de zone
  const [transferSourceChefZone, setTransferSourceChefZone] = useState<string>('')
  const [transferDestinationChefZone, setTransferDestinationChefZone] = useState<string>('')
  const [destinationChefsZone, setDestinationChefsZone] = useState<UserProfile[]>([]) // Chefs de zone de l'agent de destination
  const [selectedMembersToTransfer, setSelectedMembersToTransfer] = useState<Set<string>>(new Set())
  const [transferMembersDialogOpen, setTransferMembersDialogOpen] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile && (userProfile.role === 'admin' || userProfile.role === 'manager')) {
      loadAgents()
      loadAssignations()
    }
  }, [userProfile])
  
  useEffect(() => {
    if (selectedSourceAgentId) {
      loadChefsZoneForAgent(selectedSourceAgentId)
      loadMembresForAgent(selectedSourceAgentId)
    } else {
      setChefsZone([])
      setMembres([])
    }
  }, [selectedSourceAgentId, userProfile])
  
  useEffect(() => {
    if (membres.length > 0) {
      loadFilterData()
    }
  }, [membres])

  // Charger les chefs de zone de l'agent de destination quand il est sélectionné
  useEffect(() => {
    if (transferToAgentId) {
      loadChefsZoneForAgent(transferToAgentId).then((chefs) => {
        setDestinationChefsZone(chefs || [])
      })
    } else {
      setDestinationChefsZone([])
      setTransferDestinationChefZone('')
    }
  }, [transferToAgentId])

  async function loadUserProfile() {
    try {
      const profile = await getUserProfile()
      if (!profile) {
        router.push('/login')
        return
      }
      setUserProfile(profile)
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  async function loadChefsZoneForAgent(agentId: string): Promise<UserProfile[]> {
    try {
      // Charger les chefs de zone attachés directement à cet agent (via agent_id)
      const { data: chefsZoneWithAgent, error: error1 } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'chef_zone')
        .eq('agent_id', agentId)
        .order('nom', { ascending: true })

      if (error1) throw error1

      // Charger les membres de cet agent
      const { data: membresAgent, error: membresError } = await supabase
        .from('membres')
        .select('membre_id')
        .eq('agent_id', agentId)

      if (membresError) throw membresError

      const membreIds = membresAgent?.map(m => m.membre_id) || []

      // Si aucun membre, retourner seulement les chefs de zone avec agent_id
      if (membreIds.length === 0) {
        const result = chefsZoneWithAgent || []
        // Si c'est pour l'agent source, mettre à jour l'état
        if (agentId === selectedSourceAgentId) {
          setChefsZone(result)
        }
        return result
      }

      // Récupérer les chefs de zone qui ont ces membres assignés
      const { data: chefZoneMembres, error: chefZoneMembresError } = await supabase
        .from('chef_zone_membres')
        .select('chef_zone_id')
        .in('membre_id', membreIds)

      if (chefZoneMembresError) throw chefZoneMembresError

      const chefZoneIds = [...new Set((chefZoneMembres || []).map(czm => czm.chef_zone_id))]

      // Si aucun chef de zone trouvé par membre, retourner seulement ceux avec agent_id
      if (chefZoneIds.length === 0) {
        const result = chefsZoneWithAgent || []
        if (agentId === selectedSourceAgentId) {
          setChefsZone(result)
        }
        return result
      }

      // Charger les profils des chefs de zone qui ont des membres de cet agent
      const { data: chefsZoneByMembres, error: error2 } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'chef_zone')
        .in('id', chefZoneIds)
        .order('nom', { ascending: true })

      if (error2) throw error2

      // Combiner les deux listes (chefs de zone avec agent_id + chefs de zone avec membres)
      const allChefsZone = [
        ...(chefsZoneWithAgent || []),
        ...(chefsZoneByMembres || [])
      ]

      // Enlever les doublons (même ID)
      const uniqueChefsZone = Array.from(
        new Map(allChefsZone.map(cz => [cz.id, cz])).values()
      )

      // Si c'est pour l'agent source, mettre à jour l'état
      if (agentId === selectedSourceAgentId) {
        setChefsZone(uniqueChefsZone)
      }

      return uniqueChefsZone
    } catch (error) {
      console.error('Erreur lors du chargement des chefs de zone:', error)
      if (agentId === selectedSourceAgentId) {
        setChefsZone([])
      }
      return []
    }
  }

  async function loadMembresForAgent(agentId: string) {
    try {
      const { data, error } = await supabase
        .from('membres')
        .select('*')
        .eq('agent_id', agentId)
        .order('membre_id', { ascending: true })

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
      setMembres([])
    }
  }

  async function loadAgents() {
    try {
      let query = supabase
        .from('agents')
        .select('*')
        .order('agent_id', { ascending: true })

      // Les managers ne voient que leurs agents
      if (userProfile?.role === 'manager') {
        query = query.eq('manager_id', userProfile.id)
      }
      // Les admins voient tous les agents

      const { data, error } = await query

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error)
    }
  }

  async function loadAssignations() {
    try {
      const { data, error } = await supabase
        .from('chef_zone_membres')
        .select('chef_zone_id, membre_id')

      if (error) throw error

      const assignationsMap: Record<string, string[]> = {}
      for (const assignation of data || []) {
        if (!assignationsMap[assignation.chef_zone_id]) {
          assignationsMap[assignation.chef_zone_id] = []
        }
        assignationsMap[assignation.chef_zone_id].push(assignation.membre_id)
      }
      setAssignations(assignationsMap)
    } catch (error) {
      console.error('Erreur lors du chargement des assignations:', error)
    }
  }

  async function loadFilterData() {
    try {
      const membreIds = membres.map(m => m.membre_id)
      if (membreIds.length === 0) {
        setActivePrets(new Set())
        setGroupMembres(new Set())
        return
      }

      // Charger les prêts actifs (individuels et groupe)
      const [pretsRes, groupPretsRes, groupMembersRes] = await Promise.all([
        supabase
          .from('prets')
          .select('membre_id')
          .in('membre_id', membreIds)
          .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation']),
        supabase
          .from('group_prets')
          .select('group_id')
          .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation']),
        supabase
          .from('membre_group_members')
          .select('membre_id')
          .in('membre_id', membreIds),
      ])

      // Créer un set des membres avec prêts actifs individuels
      const activePretsSet = new Set<string>()
      if (pretsRes.data) {
        pretsRes.data.forEach(p => activePretsSet.add(p.membre_id))
      }

      // Pour les prêts de groupe, charger les membres des groupes actifs
      if (groupPretsRes.data && groupPretsRes.data.length > 0) {
        const activeGroupIds = groupPretsRes.data.map(gp => gp.group_id)
        const { data: groupMembersData } = await supabase
          .from('membre_group_members')
          .select('membre_id')
          .in('group_id', activeGroupIds)
        
        if (groupMembersData) {
          groupMembersData.forEach(gm => activePretsSet.add(gm.membre_id))
        }
      }

      setActivePrets(activePretsSet)

      // Créer un set des membres dans des groupes
      const groupMembresSet = new Set<string>()
      if (groupMembersRes.data) {
        groupMembersRes.data.forEach(gm => groupMembresSet.add(gm.membre_id))
      }
      setGroupMembres(groupMembresSet)
    } catch (error) {
      console.error('Erreur lors du chargement des données de filtre:', error)
    }
  }

  async function handleAssignMembre(chefZoneId: string, membreId: string) {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      // Vérifier si le membre est déjà assigné à un autre chef de zone
      const { data: existingAssignment, error: checkError } = await supabase
        .from('chef_zone_membres')
        .select('chef_zone_id')
        .eq('membre_id', membreId)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      // Si le membre est déjà assigné au même chef de zone, ne rien faire
      if (existingAssignment && existingAssignment.chef_zone_id === chefZoneId) {
        setSuccess('Le membre est déjà assigné à ce chef de zone')
        setTimeout(() => setSuccess(''), 3000)
        return
      }

      // Si le membre est assigné à un autre chef de zone, supprimer l'ancienne assignation
      if (existingAssignment) {
        const { error: deleteError } = await supabase
          .from('chef_zone_membres')
          .delete()
          .eq('membre_id', membreId)

        if (deleteError) throw deleteError
      }

      // Créer la nouvelle assignation
      const { error: insertError } = await supabase
        .from('chef_zone_membres')
        .insert({
          chef_zone_id: chefZoneId,
          membre_id: membreId,
          assigned_by: userProfile?.id,
        })

      if (insertError) {
        // Si c'est une erreur de clé dupliquée (ne devrait plus arriver avec la contrainte unique)
        if (insertError.code === '23505') {
          setError('Ce membre est déjà assigné à un autre chef de zone. Veuillez réessayer.')
        } else {
          throw insertError
        }
        return
      }

      setSuccess(existingAssignment 
        ? 'Membre réassigné avec succès' 
        : 'Membre assigné avec succès')
      setTimeout(() => setSuccess(''), 3000)
      await loadAssignations()
    } catch (error: any) {
      console.error('Erreur lors de l\'assignation:', error)
      setError(error.message || 'Erreur lors de l\'assignation')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function handleUnassignMembre(chefZoneId: string, membreId: string) {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { error: deleteError } = await supabase
        .from('chef_zone_membres')
        .delete()
        .eq('chef_zone_id', chefZoneId)
        .eq('membre_id', membreId)

      if (deleteError) throw deleteError

      setSuccess('Membre retiré avec succès')
      setTimeout(() => setSuccess(''), 3000)
      await loadAssignations()
    } catch (error: any) {
      console.error('Erreur lors du retrait:', error)
      setError(error.message || 'Erreur lors du retrait')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  function openTransferDialog(chef?: UserProfile) {
    // Si un chef est fourni, l'utiliser comme valeur par défaut
    if (chef) {
      const membresAssignes = assignations[chef.id] || []
      const membresDetails = membres.filter(m => membresAssignes.includes(m.membre_id))
      const agentIds = [...new Set(membresDetails.map(m => m.agent_id))]
      
      if (agentIds.length > 0) {
        setTransferChefZone(chef)
        setTransferFromAgentId(agentIds.length === 1 ? agentIds[0] : '')
      } else {
        setTransferChefZone(chef)
        setTransferFromAgentId('')
      }
    } else {
      setTransferChefZone(null)
      setTransferFromAgentId('')
    }
    setTransferToAgentId('')
    setTransferDialogOpen(true)
  }

  async function handleTransferChefZone(e: React.FormEvent) {
    e.preventDefault()
    
    if (!transferChefZone || !transferFromAgentId || !transferToAgentId) {
      setError('Veuillez sélectionner un chef de zone, un agent source et un agent de destination')
      return
    }

    if (transferFromAgentId === transferToAgentId) {
      setError('Les membres sont déjà assignés à cet agent')
      return
    }

    try {
      setTransferSaving(true)
      setError('')
      setSuccess('')

      // Récupérer tous les membres assignés à ce chef de zone qui appartiennent à l'agent source
      const membresAssignes = assignations[transferChefZone.id] || []
      const membresToTransfer = membres.filter(
        m => membresAssignes.includes(m.membre_id) && m.agent_id === transferFromAgentId
      )

      if (membresToTransfer.length === 0) {
        setError('Aucun membre à transférer pour cette combinaison chef de zone / agent source')
        setTransferSaving(false)
        return
      }

      if (membresToTransfer.length === 0) {
        setError('Aucun membre à transférer')
        return
      }

      const membreIds = membresToTransfer.map(m => m.membre_id)

      // Vérifier qu'aucun membre n'a de prêt actif
      const { data: activeLoans, error: loansError } = await supabase
        .from('prets')
        .select('membre_id, pret_id')
        .in('membre_id', membreIds)
        .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])

      if (loansError) throw loansError

      if (activeLoans && activeLoans.length > 0) {
        setError(`Certains membres ont des prêts actifs (ex: ${activeLoans[0].pret_id}). Terminez-les avant de transférer.`)
        return
      }

      // Vérifier les prêts de groupe actifs
      const { data: activeGroupLoans, error: groupLoansError } = await supabase
        .from('group_remboursements')
        .select('membre_id, pret_id, group_prets!inner(statut)')
        .in('membre_id', membreIds)
        .in('group_prets.statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])

      if (groupLoansError && groupLoansError.code !== 'PGRST116') {
        // Ignorer l'erreur si la table n'existe pas
        if (!groupLoansError.message.includes('relation') && !groupLoansError.message.includes('does not exist')) {
          throw groupLoansError
        }
      }

      if (activeGroupLoans && activeGroupLoans.length > 0) {
        setError('Certains membres ont des prêts de groupe actifs. Terminez-les avant de transférer.')
        return
      }

      // Transférer tous les membres de l'agent source vers l'agent destination
      // Mettre à jour la table membres
      const { error: membresError } = await supabase
        .from('membres')
        .update({ agent_id: transferToAgentId })
        .in('membre_id', membreIds)

      if (membresError) throw membresError

      // Mettre à jour les prêts (même s'ils sont terminés, pour l'historique)
      const { error: pretsError } = await supabase
        .from('prets')
        .update({ agent_id: transferToAgentId })
        .in('membre_id', membreIds)

      if (pretsError) {
        // Rollback en cas d'erreur
        await supabase
          .from('membres')
          .update({ agent_id: transferFromAgentId })
          .in('membre_id', membreIds)
        throw pretsError
      }

      // Mettre à jour les remboursements
      const { error: remboursementsError } = await supabase
        .from('remboursements')
        .update({ agent_id: transferToAgentId })
        .in('membre_id', membreIds)

      if (remboursementsError) {
        // Rollback en cas d'erreur
        await supabase
          .from('membres')
          .update({ agent_id: transferFromAgentId })
          .in('membre_id', membreIds)
        await supabase
          .from('prets')
          .update({ agent_id: transferFromAgentId })
          .in('membre_id', membreIds)
        throw remboursementsError
      }

      // Mettre à jour les transactions d'épargne
      const { error: epargneError } = await supabase
        .from('epargne_transactions')
        .update({ agent_id: transferToAgentId })
        .in('membre_id', membreIds)

      if (epargneError) {
        console.warn('Erreur lors de la mise à jour des transactions d\'épargne:', epargneError)
        // Ne pas faire de rollback car ce n'est pas critique
      }

      setSuccess(`${membresToTransfer.length} membre(s) transféré(s) avec succès de l'agent ${transferFromAgentId} vers l'agent ${transferToAgentId}`)
      setTimeout(() => setSuccess(''), 5000)
      
      setTransferDialogOpen(false)
      setTransferChefZone(null)
      setTransferFromAgentId('')
      setTransferToAgentId('')
      
      // Recharger les données
      if (selectedSourceAgentId) {
        await loadMembresForAgent(selectedSourceAgentId)
        await loadChefsZoneForAgent(selectedSourceAgentId)
      }
      await loadAssignations()
      if (membres.length > 0) {
        await loadFilterData()
      }
    } catch (error: any) {
      console.error('Erreur lors du transfert:', error)
      setError(error.message || 'Erreur lors du transfert')
      setTimeout(() => setError(''), 5000)
    } finally {
      setTransferSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'manager')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Accès non autorisé</div>
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={() => router.push('/login')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assigner des Membres aux Chefs de Zone</h1>
            <p className="text-muted-foreground mt-2">
              Gérez les assignations de membres aux chefs de zone
            </p>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Sélection de l'agent source */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Source</CardTitle>
            <CardDescription>
              Sélectionnez un agent de crédit pour voir ses chefs de zone et les membres assignés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="sourceAgent">Agent de Crédit Source *</Label>
              <Select 
                value={selectedSourceAgentId || 'aucun'} 
                onValueChange={(value) => {
                  setSelectedSourceAgentId(value === 'aucun' ? '' : value)
                  setSelectedMembersToTransfer(new Set())
                  setTransferSourceChefZone('')
                  setTransferDestinationChefZone('')
                  setTransferToAgentId('')
                }}
              >
                <SelectTrigger id="sourceAgent">
                  <SelectValue placeholder="Sélectionner un agent source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aucun">Aucun</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_id} - {agent.nom} {agent.prenom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>


        {!selectedSourceAgentId ? (
          <Card>
            <CardContent className="py-10 text-center">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Veuillez sélectionner un agent source pour voir ses chefs de zone et leurs membres assignés.
              </p>
            </CardContent>
          </Card>
        ) : chefsZone.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Aucun chef de zone trouvé pour cet agent. Les chefs de zone peuvent être créés dans la page Utilisateurs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {chefsZone.map((chef) => {
              // Filtrer les membres selon les critères (tous les membres sont déjà de l'agent source)
              const membresFiltres = membres.filter((m) => {
                // Filtre par type (individuel ou groupe)
                if (filterTypeMembre === 'individuel' && groupMembres.has(m.membre_id)) {
                  return false
                }
                if (filterTypeMembre === 'groupe' && !groupMembres.has(m.membre_id)) {
                  return false
                }

                // Filtre par statut (actif ou inactif)
                if (filterStatut === 'actif' && !activePrets.has(m.membre_id)) {
                  return false
                }
                if (filterStatut === 'inactif' && activePrets.has(m.membre_id)) {
                  return false
                }

                return true
              })

              const membresAssignes = assignations[chef.id] || []
              const membresNonAssignes = membresFiltres.filter(
                (m) => !membresAssignes.includes(m.membre_id)
              )
              const membresAssignesFiltres = membresFiltres.filter(
                (m) => membresAssignes.includes(m.membre_id)
              )

              return (
                <Card key={chef.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          {chef.prenom} {chef.nom} ({chef.email})
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {membresAssignes.length} membre(s) assigné(s) | {membresFiltres.length} membre(s) affiché(s) après filtres
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {membresAssignes.length > 0 && (userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTransferSourceChefZone(chef.id)
                              setSelectedMembersToTransfer(new Set(assignations[chef.id] || []))
                              setTransferMembersDialogOpen(true)
                            }}
                            disabled={saving}
                            className="flex items-center gap-2"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            Transférer
                          </Button>
                        )}
                        <Badge variant="secondary">Chef de Zone</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {membresAssignesFiltres.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Membres assignés</h3>
                        <div className="flex flex-wrap gap-2">
                          {membresAssignesFiltres.map((membre) => {
                            const isInGroup = groupMembres.has(membre.membre_id)
                            const isActive = activePrets.has(membre.membre_id)
                            return (
                              <Badge
                                key={membre.membre_id}
                                variant="default"
                                className="flex items-center gap-2"
                              >
                                {membre.prenom || ''} {membre.nom || ''} ({membre.membre_id})
                                {isInGroup && <Badge variant="outline" className="ml-1 text-xs">Groupe</Badge>}
                                {isActive && <Badge variant="secondary" className="ml-1 text-xs">Actif</Badge>}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 hover:bg-red-100"
                                  onClick={() => handleUnassignMembre(chef.id, membre.membre_id)}
                                  disabled={saving}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </Badge>
                            )
                          })}
                        </div>
                        {membresAssignes.length > membresAssignesFiltres.length && (
                          <p className="text-xs text-muted-foreground mt-2">
                            + {membresAssignes.length - membresAssignesFiltres.length} autre(s) membre(s) assigné(s) (masqué(s) par les filtres)
                          </p>
                        )}
                      </div>
                    )}

                    {membresNonAssignes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Assigner un membre</h3>
                        <div className="flex flex-wrap gap-2">
                          {membresNonAssignes.map((membre) => {
                            const isInGroup = groupMembres.has(membre.membre_id)
                            const isActive = activePrets.has(membre.membre_id)
                            return (
                              <Button
                                key={membre.membre_id}
                                size="sm"
                                variant="outline"
                                onClick={() => handleAssignMembre(chef.id, membre.membre_id)}
                                disabled={saving}
                                className="flex items-center gap-1"
                              >
                                <UserPlus className="w-4 h-4" />
                                {membre.prenom || ''} {membre.nom || ''} ({membre.membre_id})
                                {isInGroup && <Badge variant="outline" className="ml-1 text-xs">Groupe</Badge>}
                                {isActive && <Badge variant="secondary" className="ml-1 text-xs">Actif</Badge>}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {membresNonAssignes.length === 0 && membresAssignes.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Tous les membres sont assignés à ce chef de zone
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Dialogue de transfert de membres entre chefs de zone */}
        <Dialog open={transferMembersDialogOpen} onOpenChange={setTransferMembersDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Transférer des membres entre chefs de zone</DialogTitle>
              <DialogDescription>
                Sélectionnez l'agent de destination, le chef de zone source et le chef de zone destination
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              <div className="space-y-2">
                <Label htmlFor="transferToAgent">Agent de Destination *</Label>
                <Select
                  value={transferToAgentId || 'aucun'}
                  onValueChange={(value) => {
                    setTransferToAgentId(value === 'aucun' ? '' : value)
                    setTransferDestinationChefZone('')
                  }}
                  required
                >
                  <SelectTrigger id="transferToAgent">
                    <SelectValue placeholder="Sélectionner un agent de destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucun">Aucun</SelectItem>
                    {agents
                      .filter(a => a.agent_id !== selectedSourceAgentId)
                      .map((agent) => (
                        <SelectItem key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.nom} {agent.prenom}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transferSourceChefZone">Chef de Zone Source *</Label>
                <Select
                  value={transferSourceChefZone || 'aucun'}
                  onValueChange={(value) => {
                    setTransferSourceChefZone(value === 'aucun' ? '' : value)
                    if (value !== 'aucun') {
                      const membresAssignes = assignations[value] || []
                      setSelectedMembersToTransfer(new Set(membresAssignes))
                    } else {
                      setSelectedMembersToTransfer(new Set())
                    }
                  }}
                  required
                  disabled={!selectedSourceAgentId}
                >
                  <SelectTrigger id="transferSourceChefZone">
                    <SelectValue placeholder="Sélectionner un chef de zone source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucun">Aucun</SelectItem>
                    {chefsZone.map((chef) => (
                      <SelectItem key={chef.id} value={chef.id}>
                        {chef.prenom} {chef.nom} ({chef.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {transferSourceChefZone && (
                  <p className="text-sm text-muted-foreground">
                    {assignations[transferSourceChefZone]?.length || 0} membre(s) assigné(s) à ce chef de zone
                  </p>
                )}
              </div>

              {transferSourceChefZone && (
                <div className="space-y-2">
                  <Label>Membres du Chef de Zone Source</Label>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {(() => {
                      const membresAssignes = assignations[transferSourceChefZone] || []
                      if (membresAssignes.length === 0) {
                        return <p className="text-sm text-muted-foreground text-center py-4">Aucun membre assigné</p>
                      }
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {selectedMembersToTransfer.size} membre(s) sélectionné(s) sur {membresAssignes.length}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedMembersToTransfer(new Set(membresAssignes))}
                              >
                                Tout sélectionner
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedMembersToTransfer(new Set())}
                              >
                                Tout désélectionner
                              </Button>
                            </div>
                          </div>
                          {membresAssignes.map((membreId) => {
                            const membre = membres.find(m => m.membre_id === membreId)
                            if (!membre) return null
                            const isInGroup = groupMembres.has(membre.membre_id)
                            const isActive = activePrets.has(membre.membre_id)
                            const isSelected = selectedMembersToTransfer.has(membreId)
                            return (
                              <div
                                key={membreId}
                                className={`flex items-center justify-between p-2 rounded border cursor-pointer ${
                                  isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                                }`}
                                onClick={() => {
                                  const newSet = new Set(selectedMembersToTransfer)
                                  if (isSelected) {
                                    newSet.delete(membreId)
                                  } else {
                                    newSet.add(membreId)
                                  }
                                  setSelectedMembersToTransfer(newSet)
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="cursor-pointer"
                                  />
                                  <span className="font-medium">
                                    {membre.prenom} {membre.nom} ({membre.membre_id})
                                  </span>
                                  {isInGroup && <Badge variant="outline" className="text-xs">Groupe</Badge>}
                                  {isActive && <Badge variant="secondary" className="text-xs">Actif</Badge>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="transferDestinationChefZone">Chef de Zone Destination *</Label>
                <Select
                  value={transferDestinationChefZone || 'aucun'}
                  onValueChange={(value) => setTransferDestinationChefZone(value === 'aucun' ? '' : value)}
                  required
                  disabled={!transferToAgentId}
                >
                  <SelectTrigger id="transferDestinationChefZone">
                    <SelectValue placeholder="Sélectionner un chef de zone destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucun">Aucun</SelectItem>
                    {destinationChefsZone
                      .filter(chef => chef.id !== transferSourceChefZone)
                      .map((chef) => (
                        <SelectItem key={chef.id} value={chef.id}>
                          {chef.prenom} {chef.nom} ({chef.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Les chefs de zone de l'agent de destination seront chargés automatiquement
                </p>
              </div>

            </div>
            <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTransferMembersDialogOpen(false)
                  setTransferToAgentId('')
                  setTransferSourceChefZone('')
                  setTransferDestinationChefZone('')
                  setSelectedMembersToTransfer(new Set())
                }}
                disabled={transferSaving}
              >
                Annuler
              </Button>
              <Button
                onClick={async () => {
                  if (!transferToAgentId || !transferSourceChefZone || !transferDestinationChefZone || selectedMembersToTransfer.size === 0) {
                    setError('Veuillez remplir tous les champs et sélectionner au moins un membre')
                    return
                  }

                  try {
                    setTransferSaving(true)
                    setError('')
                    setSuccess('')

                    const membreIds = Array.from(selectedMembersToTransfer)

                    // Transférer chaque membre
                    for (const membreId of membreIds) {
                      // Supprimer l'assignation actuelle
                      const { error: deleteError } = await supabase
                        .from('chef_zone_membres')
                        .delete()
                        .eq('chef_zone_id', transferSourceChefZone)
                        .eq('membre_id', membreId)

                      if (deleteError) throw deleteError

                      // Créer la nouvelle assignation
                      const { error: insertError } = await supabase
                        .from('chef_zone_membres')
                        .insert({
                          chef_zone_id: transferDestinationChefZone,
                          membre_id: membreId,
                          assigned_by: userProfile?.id,
                        })

                      if (insertError) throw insertError
                    }

                    setSuccess(`${membreIds.length} membre(s) transféré(s) avec succès`)
                    setTimeout(() => setSuccess(''), 5000)

                    // Recharger les assignations
                    await loadAssignations()
                    
                    // Réinitialiser les sélections
                    setSelectedMembersToTransfer(new Set())
                    setTransferToAgentId('')
                    setTransferSourceChefZone('')
                    setTransferDestinationChefZone('')
                    setTransferMembersDialogOpen(false)
                  } catch (error: any) {
                    console.error('Erreur lors du transfert:', error)
                    setError(error.message || 'Erreur lors du transfert')
                    setTimeout(() => setError(''), 5000)
                  } finally {
                    setTransferSaving(false)
                  }
                }}
                disabled={transferSaving || !transferToAgentId || !transferSourceChefZone || !transferDestinationChefZone || selectedMembersToTransfer.size === 0}
              >
                {transferSaving ? 'Transfert en cours...' : 'Confirmer le transfert'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialogue de transfert */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transférer les membres d'un chef de zone</DialogTitle>
              <DialogDescription>
                Transférer tous les membres assignés à un chef de zone d'un agent de crédit à un autre.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransferChefZone} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="transferChefZoneId">Chef de zone *</Label>
                <Select
                  value={transferChefZone?.id || 'aucun'}
                  onValueChange={(value) => {
                    if (value === 'aucun') {
                      setTransferChefZone(null)
                      setTransferFromAgentId('')
                    } else {
                      const chef = chefsZone.find(c => c.id === value)
                      if (chef) {
                        setTransferChefZone(chef)
                        // Trouver les agents des membres assignés à ce chef
                        const membresAssignes = assignations[chef.id] || []
                        const membresDetails = membres.filter(m => membresAssignes.includes(m.membre_id))
                        const agentIds = [...new Set(membresDetails.map(m => m.agent_id))]
                        if (agentIds.length === 1) {
                          setTransferFromAgentId(agentIds[0])
                        } else {
                          setTransferFromAgentId('')
                        }
                      }
                    }
                  }}
                  required
                >
                  <SelectTrigger id="transferChefZoneId">
                    <SelectValue placeholder="Sélectionner un chef de zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucun">Aucun</SelectItem>
                    {chefsZone.map((chef) => (
                      <SelectItem key={chef.id} value={chef.id}>
                        {chef.prenom} {chef.nom} ({chef.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transferFromAgentId">Agent source *</Label>
                <Select
                  value={transferFromAgentId || 'aucun'}
                  onValueChange={(value) => setTransferFromAgentId(value === 'aucun' ? '' : value)}
                  required
                  disabled={!transferChefZone}
                >
                  <SelectTrigger id="transferFromAgentId">
                    <SelectValue placeholder="Sélectionner un agent source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucun">Aucun</SelectItem>
                    {(() => {
                      if (!transferChefZone) return []
                      const membresAssignes = assignations[transferChefZone.id] || []
                      const membresDetails = membres.filter(m => membresAssignes.includes(m.membre_id))
                      const agentIds = [...new Set(membresDetails.map(m => m.agent_id))]
                      return agents
                        .filter(a => agentIds.includes(a.agent_id))
                        .map((agent) => (
                          <SelectItem key={agent.agent_id} value={agent.agent_id}>
                            {agent.agent_id} - {agent.nom} {agent.prenom}
                          </SelectItem>
                        ))
                    })()}
                  </SelectContent>
                </Select>
                {transferChefZone && transferFromAgentId && (
                  <p className="text-sm text-muted-foreground">
                    {assignations[transferChefZone.id]?.filter(mId => {
                      const m = membres.find(m => m.membre_id === mId)
                      return m && m.agent_id === transferFromAgentId
                    }).length || 0} membre(s) à transférer
                  </p>
                )}
              </div>

                <div className="space-y-2">
                  <Label htmlFor="transferToAgentId">Agent de destination *</Label>
                  <Select
                    value={transferToAgentId}
                    onValueChange={setTransferToAgentId}
                    required
                  >
                    <SelectTrigger id="transferToAgentId">
                      <SelectValue placeholder="Sélectionner un agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents
                        .filter(a => a.agent_id !== transferFromAgentId)
                        .map((agent) => (
                          <SelectItem key={agent.agent_id} value={agent.agent_id}>
                            {agent.agent_id} - {agent.nom} {agent.prenom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTransferDialogOpen(false)
                      setTransferChefZone(null)
                      setTransferFromAgentId('')
                      setTransferToAgentId('')
                    }}
                    disabled={transferSaving}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={transferSaving}>
                    {transferSaving ? 'Transfert en cours...' : 'Transférer'}
                  </Button>
                </DialogFooter>
              </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

export default function AssignerMembresChefZonePage() {
  return (
    <ProtectedRoute>
      <AssignerMembresChefZoneContent />
    </ProtectedRoute>
  )
}

