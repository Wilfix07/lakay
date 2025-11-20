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
import { Users, UserPlus, X, ArrowRightLeft } from 'lucide-react'
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

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile && (userProfile.role === 'admin' || userProfile.role === 'manager')) {
      loadChefsZone()
      loadMembres()
      loadAgents()
      loadAssignations()
    }
  }, [userProfile])

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

  async function loadChefsZone() {
    try {
      let query = supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'chef_zone')
        .order('nom', { ascending: true })

      // Les managers ne voient que les chefs de zone qui ont des membres assignés appartenant à leurs agents
      if (userProfile?.role === 'manager') {
        // Récupérer les agent_id des agents du manager
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length === 0) {
          setChefsZone([])
          return
        }

        // Récupérer les membres du manager
        const { data: managerMembres, error: membresError } = await supabase
          .from('membres')
          .select('membre_id')
          .in('agent_id', agentIds)

        if (membresError) throw membresError

        const membreIds = managerMembres?.map(m => m.membre_id) || []
        if (membreIds.length === 0) {
          setChefsZone([])
          return
        }

        // Récupérer les chefs de zone qui ont ces membres assignés
        const { data: chefZoneAssignations, error: assignationsError } = await supabase
          .from('chef_zone_membres')
          .select('chef_zone_id')
          .in('membre_id', membreIds)

        if (assignationsError) throw assignationsError

        const chefZoneIds = [...new Set(chefZoneAssignations?.map(a => a.chef_zone_id) || [])]
        if (chefZoneIds.length === 0) {
          setChefsZone([])
          return
        }

        // Charger uniquement ces chefs de zone
        query = query.in('id', chefZoneIds)
      }
      // Les admins voient tous les chefs de zone

      const { data, error } = await query

      if (error) throw error
      setChefsZone(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des chefs de zone:', error)
    }
  }

  async function loadMembres() {
    try {
      let query = supabase
        .from('membres')
        .select('*')
        .order('membre_id', { ascending: true })

      // Les managers ne voient que les membres de leurs agents
      if (userProfile?.role === 'manager') {
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          query = query.in('agent_id', agentIds)
        } else {
          setMembres([])
          return
        }
      }

      const { data, error } = await query

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
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

  function openTransferDialog(chef: UserProfile) {
    // Récupérer les membres assignés à ce chef de zone
    const membresAssignes = assignations[chef.id] || []
    const membresDetails = membres.filter(m => membresAssignes.includes(m.membre_id))
    
    // Trouver les agents uniques de ces membres
    const agentIds = [...new Set(membresDetails.map(m => m.agent_id))]
    
    if (agentIds.length === 0) {
      setError('Ce chef de zone n\'a aucun membre assigné')
      return
    }
    
    if (agentIds.length > 1) {
      setError('Ce chef de zone a des membres assignés à plusieurs agents. Veuillez d\'abord réassigner les membres individuellement.')
      return
    }

    setTransferChefZone(chef)
    setTransferFromAgentId(agentIds[0])
    setTransferToAgentId('')
    setTransferDialogOpen(true)
  }

  async function handleTransferChefZone(e: React.FormEvent) {
    e.preventDefault()
    
    if (!transferChefZone || !transferFromAgentId || !transferToAgentId) {
      setError('Veuillez sélectionner un agent de destination')
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
      await loadMembres()
      await loadAssignations()
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

        {chefsZone.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Aucun chef de zone n'a été créé. Créez-en un dans la page Utilisateurs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {chefsZone.map((chef) => {
              const membresAssignes = assignations[chef.id] || []
              const membresNonAssignes = membres.filter(
                (m) => !membresAssignes.includes(m.membre_id)
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
                          {membresAssignes.length} membre(s) assigné(s)
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {membresAssignes.length > 0 && (userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTransferDialog(chef)}
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
                    {membresAssignes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Membres assignés</h3>
                        <div className="flex flex-wrap gap-2">
                          {membresAssignes.map((membreId) => {
                            const membre = membres.find((m) => m.membre_id === membreId)
                            return (
                              <Badge
                                key={membreId}
                                variant="default"
                                className="flex items-center gap-2"
                              >
                                {membre
                                  ? `${membre.prenom || ''} ${membre.nom || ''} (${membre.membre_id})`
                                  : membreId}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 hover:bg-red-100"
                                  onClick={() => handleUnassignMembre(chef.id, membreId)}
                                  disabled={saving}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {membresNonAssignes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Assigner un membre</h3>
                        <div className="flex flex-wrap gap-2">
                          {membresNonAssignes.map((membre) => (
                            <Button
                              key={membre.membre_id}
                              size="sm"
                              variant="outline"
                              onClick={() => handleAssignMembre(chef.id, membre.membre_id)}
                              disabled={saving}
                            >
                              <UserPlus className="w-4 h-4 mr-1" />
                              {membre.prenom || ''} {membre.nom || ''} ({membre.membre_id})
                            </Button>
                          ))}
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

        {/* Dialogue de transfert */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transférer les membres d'un chef de zone</DialogTitle>
              <DialogDescription>
                Transférer tous les membres assignés à ce chef de zone d'un agent de crédit à un autre.
              </DialogDescription>
            </DialogHeader>
            {transferChefZone && (
              <form onSubmit={handleTransferChefZone} className="space-y-4">
                <div className="space-y-2">
                  <Label>Chef de zone</Label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{transferChefZone.prenom} {transferChefZone.nom}</p>
                    <p className="text-sm text-gray-600">{transferChefZone.email}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Agent source</Label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">
                      {agents.find(a => a.agent_id === transferFromAgentId)?.agent_id || transferFromAgentId} - 
                      {agents.find(a => a.agent_id === transferFromAgentId) 
                        ? ` ${agents.find(a => a.agent_id === transferFromAgentId)?.nom} ${agents.find(a => a.agent_id === transferFromAgentId)?.prenom}`
                        : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      {assignations[transferChefZone.id]?.filter(mId => {
                        const m = membres.find(m => m.membre_id === mId)
                        return m && m.agent_id === transferFromAgentId
                      }).length || 0} membre(s) à transférer
                    </p>
                  </div>
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
            )}
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

