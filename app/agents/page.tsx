'use client'

import { useState, useEffect } from 'react'
import { supabase, type Agent } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, X, Loader2, Pencil, Trash, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { UserProfile } from '@/lib/supabase'

function AgentsPageContent() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadAgents()
    }
  }, [userProfile])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadAgents() {
    try {
      setLoading(true)
      let query = supabase
        .from('agents')
        .select('*')
      
      // Filtrer par manager_id si l'utilisateur est un manager
      if (userProfile?.role === 'manager') {
        query = query.eq('manager_id', userProfile.id)
      }
      // Admin voit tous les agents (pas de filtre)
      
      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error)
      alert('Erreur lors du chargement des agents')
    } finally {
      setLoading(false)
    }
  }

  const isManagerOrAdmin = userProfile?.role === 'manager' || userProfile?.role === 'admin'
  const isEditing = Boolean(editingAgent)

  function resetForm() {
    setFormData({ nom: '', prenom: '', email: '', telephone: '' })
    setEditingAgent(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!userProfile) {
        alert('Erreur: Profil utilisateur non trouvé')
        setSubmitting(false)
        return
      }

      if (isEditing && editingAgent) {
        const { error } = await supabase
          .from('agents')
          .update({
            nom: formData.nom,
            prenom: formData.prenom,
            email: formData.email || null,
            telephone: formData.telephone || null,
          })
          .eq('agent_id', editingAgent.agent_id)

        if (error) throw error
        alert('Agent mis à jour avec succès!')
      } else {
        // Pour les managers, générer l'agent_id uniquement parmi leurs agents
        // Pour les admins, générer globalement
        let query = supabase
          .from('agents')
          .select('agent_id')
          .order('agent_id', { ascending: false })
          .limit(1)

        if (userProfile.role === 'manager') {
          query = query.eq('manager_id', userProfile.id)
        }

        const { data: maxAgents } = await query

        let newAgentId = '00'
        if (maxAgents && maxAgents.length > 0 && maxAgents[0]) {
          const maxNum = parseInt(maxAgents[0].agent_id, 10)
          if (!isNaN(maxNum)) {
            newAgentId = String(maxNum + 1).padStart(2, '0')
          }
        }

        const insertData: any = {
          agent_id: newAgentId,
          ...formData,
        }

        // Assigner manager_id si l'utilisateur est un manager
        if (userProfile.role === 'manager') {
          insertData.manager_id = userProfile.id
        }

        const { error } = await supabase
          .from('agents')
          .insert([insertData])

        if (error) throw error
        alert('Agent créé avec succès!')
      }

      setShowForm(false)
      resetForm()
      loadAgents()
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error)
      alert('Erreur: ' + (error.message || 'Erreur inconnue'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleStartCreate() {
    if (showForm && !isEditing) {
      setShowForm(false)
      resetForm()
      return
    }
    resetForm()
    setShowForm((prev) => !prev)
  }

  function handleEdit(agent: Agent) {
    setEditingAgent(agent)
    setFormData({
      nom: agent.nom || '',
      prenom: agent.prenom || '',
      email: agent.email || '',
      telephone: agent.telephone || '',
    })
    setShowForm(true)
  }

  async function handleDelete(agent: Agent) {
    if (!confirm(`Supprimer l'agent ${agent.prenom} ${agent.nom} ?`)) {
      return
    }
    try {
      const { error } = await supabase.from('agents').delete().eq('agent_id', agent.agent_id)
      if (error) throw error
      alert('Agent supprimé avec succès.')
      if (editingAgent?.agent_id === agent.agent_id) {
        resetForm()
        setShowForm(false)
      }
      loadAgents()
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error)
      alert('Erreur lors de la suppression de l’agent.')
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Agents de Crédit</h1>
            <p className="text-muted-foreground mt-2">Gérer les agents et leurs portefeuilles</p>
          </div>
          <Button onClick={handleStartCreate} className="gap-2">
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                {isEditing ? 'Fermer' : 'Annuler'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Nouvel Agent
              </>
            )}
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? 'Modifier l’agent' : 'Créer un nouvel agent'}</CardTitle>
              <CardDescription>
                {isEditing
                  ? 'Mettez à jour les informations de votre agent.'
                  : 'Remplissez les informations pour créer un nouvel agent'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      required
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="Nom de l'agent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      required
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      placeholder="Prénom de l'agent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
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
                </div>
                <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isEditing ? 'Enregistrement...' : 'Création...'}
                    </>
                  ) : (
                    isEditing ? 'Mettre à jour' : 'Créer l\'agent'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des agents</CardTitle>
            <CardDescription>Total: {agents.length} agent(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucun agent enregistré</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Agent</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Date création</TableHead>
                      {isManagerOrAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.agent_id}</TableCell>
                        <TableCell>{agent.nom}</TableCell>
                        <TableCell>{agent.prenom}</TableCell>
                        <TableCell>{agent.email || '-'}</TableCell>
                        <TableCell>{agent.telephone || '-'}</TableCell>
                        <TableCell>
                          {new Date(agent.created_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        {isManagerOrAdmin && (
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/agents/${agent.agent_id}`)}
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(agent)}
                              title="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(agent)}
                              title="Supprimer"
                            >
                              <Trash className="w-4 h-4" />
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
    </DashboardLayout>
  )
}

export default function AgentsPage() {
  return (
    <ProtectedRoute requiredPermission="canCreateAgents">
      <AgentsPageContent />
    </ProtectedRoute>
  )
}
