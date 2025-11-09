'use client'

import { useState, useEffect } from 'react'
import { supabase, type Membre, type Agent, type UserProfile } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function MembresPageContent() {
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferMember, setTransferMember] = useState<Membre | null>(null)
  const [transferAgentId, setTransferAgentId] = useState<string>('')
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    agent_id: '',
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadAgents()
      loadMembres()
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        setFormData(prev => ({ ...prev, agent_id: userProfile.agent_id! }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadAgents() {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('agent_id', { ascending: true })

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error)
    }
  }

  async function loadMembres() {
    try {
      setLoading(true)
      let query = supabase
        .from('membres')
        .select('*')
        .order('created_at', { ascending: false })

      // Les agents ne voient que leurs propres membres
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      }

      const { data, error } = await query

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
      alert('Erreur lors du chargement des membres')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      // Générer le membre_id automatiquement
      const { data: maxMembres } = await supabase
        .from('membres')
        .select('membre_id')
        .order('membre_id', { ascending: false })
        .limit(1)

      let newMembreId = '0000'
      if (maxMembres && maxMembres.length > 0 && maxMembres[0]) {
        const maxNum = parseInt(maxMembres[0].membre_id, 10)
        if (!isNaN(maxNum)) {
          newMembreId = String(maxNum + 1).padStart(4, '0')
        }
      }

      const { error } = await supabase
        .from('membres')
        .insert([{
          membre_id: newMembreId,
          ...formData,
        }])

      if (error) throw error

      alert('Membre créé avec succès!')
      setShowForm(false)
      setFormData({ agent_id: '', nom: '', prenom: '', telephone: '', adresse: '' })
      loadMembres()
    } catch (error: any) {
      console.error('Erreur lors de la création:', error)
      alert('Erreur: ' + (error.message || 'Erreur inconnue'))
    } finally {
      setSubmitting(false)
    }
  }

  function openTransferDialog(member: Membre) {
    setTransferMember(member)
    setTransferAgentId(member.agent_id)
    setTransferError(null)
    setTransferDialogOpen(true)
  }

  async function handleTransferSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!transferMember || !transferAgentId) {
      setTransferError('Veuillez sélectionner un agent de destination.')
      return
    }

    if (transferAgentId === transferMember.agent_id) {
      setTransferError('Le membre est déjà assigné à cet agent.')
      return
    }

    try {
      setTransferSaving(true)
      setTransferError(null)

      const { error: memberError } = await supabase
        .from('membres')
        .update({ agent_id: transferAgentId })
        .eq('id', transferMember.id)

      if (memberError) throw memberError

      const { error: pretsError } = await supabase
        .from('prets')
        .update({ agent_id: transferAgentId })
        .eq('membre_id', transferMember.membre_id)

      if (pretsError) {
        await supabase
          .from('membres')
          .update({ agent_id: transferMember.agent_id })
          .eq('id', transferMember.id)
        throw new Error(pretsError.message)
      }

      const { error: remboursementsError } = await supabase
        .from('remboursements')
        .update({ agent_id: transferAgentId })
        .eq('membre_id', transferMember.membre_id)

      if (remboursementsError) {
        await supabase
          .from('membres')
          .update({ agent_id: transferMember.agent_id })
          .eq('id', transferMember.id)
        await supabase
          .from('prets')
          .update({ agent_id: transferMember.agent_id })
          .eq('membre_id', transferMember.membre_id)
        throw new Error(remboursementsError.message)
      }

      setTransferDialogOpen(false)
      setTransferMember(null)
      setTransferAgentId('')
      alert('Membre transféré avec succès.')
      loadMembres()
    } catch (error: any) {
      console.error('Erreur lors du transfert du membre:', error)
      setTransferError(error.message ?? 'Une erreur est survenue pendant le transfert.')
    } finally {
      setTransferSaving(false)
    }
  }

  async function handleSignOut() {
    // This will be handled by DashboardLayout
  }

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Membres</h1>
            <p className="text-muted-foreground mt-2">Créer et gérer les membres</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Annuler
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Nouveau Membre
              </>
            )}
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Créer un nouveau membre</CardTitle>
              <CardDescription>Remplissez les informations pour créer un nouveau membre</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent_id">Agent de Crédit *</Label>
                  <Select
                    required
                    value={formData.agent_id}
                    onValueChange={(value) => setFormData({ ...formData, agent_id: value })}
                    disabled={userProfile?.role === 'agent'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.prenom} {agent.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      required
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="Nom du membre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      required
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      placeholder="Prénom du membre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input
                      id="telephone"
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      placeholder="+509 XX XX XX XX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adresse">Adresse</Label>
                    <Input
                      id="adresse"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Adresse du membre"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Créer le membre'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des membres</CardTitle>
            <CardDescription>Total: {membres.length} membre(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {membres.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucun membre enregistré</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Membre</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Date création</TableHead>
                      {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membres.map((membre) => (
                      <TableRow key={membre.id}>
                        <TableCell className="font-medium">{membre.membre_id}</TableCell>
                        <TableCell>{membre.agent_id}</TableCell>
                        <TableCell>{membre.nom}</TableCell>
                        <TableCell>{membre.prenom}</TableCell>
                        <TableCell>{membre.telephone || '-'}</TableCell>
                        <TableCell>
                          {new Date(membre.created_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTransferDialog(membre)}
                            >
                              Transférer
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transférer le membre</DialogTitle>
              <DialogDescription>
                Sélectionnez l’agent vers lequel transférer ce membre.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <Label>Membre</Label>
                <div className="mt-1 rounded-lg border bg-muted/40 p-3 text-sm">
                  {transferMember
                    ? `${transferMember.prenom} ${transferMember.nom} • ${transferMember.membre_id}`
                    : 'Aucun membre sélectionné'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nouvel agent</Label>
                <Select value={transferAgentId} onValueChange={setTransferAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents
                      .filter((agent) => agent.agent_id !== transferMember?.agent_id)
                      .map((agent) => (
                        <SelectItem key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.prenom} {agent.nom}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {transferError && (
                <p className="text-sm text-red-600">{transferError}</p>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={transferSaving}>
                  {transferSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transfert...
                    </>
                  ) : (
                    'Confirmer'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  )
}

export default function MembresPage() {
  return (
    <ProtectedRoute requiredPermission="canCreateMembers">
      <MembresPageContent />
    </ProtectedRoute>
  )
}
