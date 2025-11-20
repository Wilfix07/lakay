'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, type UserProfile, type Agent } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useRouter } from 'next/navigation'

function UtilisateursPageContent() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'agent' as 'manager' | 'agent' | 'chef_zone',
    nom: '',
    prenom: '',
    agent_id: '', // Pour les agents seulement
  })
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editData, setEditData] = useState({
    email: '',
    role: 'agent' as 'manager' | 'agent' | 'chef_zone',
    nom: '',
    prenom: '',
    agent_id: '',
    password: '',
  })
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadUsers()
      if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        loadAgents()
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

  // Fonction helper pour charger les chefs de zone du portefeuille d'un manager
  async function loadChefsZoneForManager(agentIds: string[]): Promise<any[]> {
    try {
      // 1. Charger les chefs de zone attachés directement aux agents du manager (via agent_id)
      const { data: chefsZoneWithAgent, error: error1 } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'chef_zone')
        .in('agent_id', agentIds)

      if (error1) throw error1

      // 2. Charger les chefs de zone qui ont des membres assignés appartenant aux agents du manager
      // D'abord, récupérer les membres des agents du manager
      const { data: membres, error: membresError } = await supabase
        .from('membres')
        .select('membre_id')
        .in('agent_id', agentIds)

      if (membresError) throw membresError

      const membreIds = membres?.map(m => m.membre_id) || []

      // Si aucun membre, retourner seulement les chefs de zone avec agent_id
      if (membreIds.length === 0) {
        return chefsZoneWithAgent || []
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
        return chefsZoneWithAgent || []
      }

      // Charger les profils des chefs de zone qui ont des membres du portefeuille
      const { data: chefsZoneByMembres, error: error2 } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'chef_zone')
        .in('id', chefZoneIds)

      if (error2) throw error2

      // Combiner les deux listes (chefs de zone avec agent_id + chefs de zone avec membres du portefeuille)
      const allChefsZone = [
        ...(chefsZoneWithAgent || []),
        ...(chefsZoneByMembres || [])
      ]

      // Enlever les doublons (même ID)
      const uniqueChefsZone = Array.from(
        new Map(allChefsZone.map(cz => [cz.id, cz])).values()
      )

      // Trier par date de création
      uniqueChefsZone.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      return uniqueChefsZone
    } catch (error) {
      console.error('Erreur lors du chargement des chefs de zone pour le manager:', error)
      return []
    }
  }

  async function loadUsers() {
    try {
      setLoading(true)
      let query = supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      // Les managers voient leurs agents et les chefs de zone de leur portefeuille
      if (userProfile?.role === 'manager') {
        // Récupérer d'abord les agent_id des agents du manager
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        
        // Charger les agents du manager et les chefs de zone de son portefeuille
        const [agentsResult, chefsZoneResult] = await Promise.all([
          // Charger les agents du manager
          agentIds.length > 0
            ? supabase
                .from('user_profiles')
                .select('*')
                .eq('role', 'agent')
                .in('agent_id', agentIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          // Charger les chefs de zone du portefeuille du manager
          agentIds.length > 0
            ? loadChefsZoneForManager(agentIds)
            : Promise.resolve([])
        ])

        if (agentsResult.error) throw agentsResult.error

        // Combiner les résultats (enlever les doublons basés sur l'ID)
        const chefsZoneMap = new Map((chefsZoneResult || []).map(cz => [cz.id, cz]))
        const agentsMap = new Map((agentsResult.data || []).map(a => [a.id, a]))
        
        // Combiner en évitant les doublons
        const combinedUsers = [
          ...agentsMap.values(),
          ...chefsZoneMap.values()
        ]
        
        // Trier par date de création décroissante
        combinedUsers.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        
        setUsers(combinedUsers)
        setLoading(false)
        return
      }
      // Les admins voient tous les utilisateurs sauf les admins (managers, agents, chefs de zone)
      else if (userProfile?.role === 'admin') {
        query = query.in('role', ['manager', 'agent', 'chef_zone'])
      }

      const { data, error } = await query

      if (error) throw error
      setUsers(data || [])
    } catch (error: any) {
      console.error('Erreur lors du chargement des utilisateurs:', error)
      setError('Erreur lors du chargement des utilisateurs')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      // Validation
      if (!formData.email || !formData.password) {
        setError('Email et mot de passe sont requis')
        return
      }

      if (formData.role === 'agent' && !formData.agent_id) {
        setError('Veuillez sélectionner un agent de crédit')
        return
      }

      if (!formData.nom || !formData.prenom) {
        setError('Nom et prénom sont requis')
        return
      }

      // Obtenir le token de session pour l'authentification
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Session expirée. Veuillez vous reconnecter.')
      }

      // Créer l'utilisateur dans Supabase Auth
      // Note: Cette opération nécessite la clé service_role côté serveur
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role,
          nom: formData.nom,
          prenom: formData.prenom,
          agent_id: (formData.role === 'agent' || formData.role === 'chef_zone') ? formData.agent_id : null,
        }),
      })

      // Vérifier le Content-Type avant de parser
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Réponse non-JSON reçue:', text.substring(0, 200))
        throw new Error('Erreur serveur: La réponse n\'est pas au format JSON. Vérifiez que la route API existe et que SUPABASE_SERVICE_ROLE_KEY est configurée.')
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création de l\'utilisateur')
      }

      setSuccess(`Utilisateur ${formData.role} créé avec succès!`)
      setShowForm(false)
      setFormData({
        email: '',
        password: '',
        role: 'agent',
        nom: '',
        prenom: '',
        agent_id: '',
      })
      loadUsers()
    } catch (error: any) {
      console.error('Erreur lors de la création:', error)
      setError(error.message || 'Erreur lors de la création de l\'utilisateur')
    }
  }

  function handleStartEdit(user: UserProfile) {
    // Vérifier les permissions : admin peut modifier tous les utilisateurs, manager peut modifier ses agents et ses chefs de zone
    if (userProfile?.role === 'admin' || userProfile?.role === 'manager') {
      // Si c'est un manager, vérifier que l'utilisateur est un agent qui lui appartient ou un chef de zone
      if (userProfile?.role === 'manager') {
        if (user.role !== 'agent' && user.role !== 'chef_zone') {
          setError('Vous ne pouvez modifier que vos agents et vos chefs de zone')
          return
        }
        // Pour les agents, la vérification que l'agent appartient au manager sera faite côté serveur dans l'API
        // Pour les chefs de zone, on vérifie qu'ils ont des membres assignés qui appartiennent aux agents du manager
        if (user.role === 'chef_zone') {
          // La vérification sera faite côté serveur, mais on permet l'édition ici
        }
      }
      
      setEditingUser(user)
      setEditData({
        email: user.email,
        role: (user.role as 'manager' | 'agent' | 'chef_zone') ?? 'agent',
        nom: user.nom ?? '',
        prenom: user.prenom ?? '',
        agent_id: user.agent_id ?? '',
        password: '',
      })
      setShowEditForm(true)
      setShowForm(false)
      setError('')
      setSuccess('')
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setError('')
    setSuccess('')

    if (!editData.email || !editData.nom || !editData.prenom) {
      setError('Email, nom et prénom sont requis')
      return
    }

    if (editData.role === 'agent' && !editData.agent_id) {
      setError('Veuillez sélectionner un agent de crédit')
      return
    }

    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Vous devez être connecté pour effectuer cette action')
        return
      }

      const payload: Record<string, any> = {
        id: editingUser.id,
        email: editData.email,
        role: editData.role,
        nom: editData.nom,
        prenom: editData.prenom,
        agent_id: (editData.role === 'agent' || editData.role === 'chef_zone') ? editData.agent_id : null,
      }
      if (editData.password) {
        payload.password = editData.password
      }

      const response = await fetch('/api/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const contentType = response.headers.get('content-type')
      const data = contentType && contentType.includes('application/json')
        ? await response.json()
        : { error: 'Réponse serveur invalide' }

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour de l’utilisateur')
      }

      setSuccess('Utilisateur mis à jour avec succès')
      setShowEditForm(false)
      setEditingUser(null)
      setEditData({
        email: '',
        role: 'agent',
        nom: '',
        prenom: '',
        agent_id: '',
        password: '',
      })
      loadUsers()
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error)
      setError(error.message || 'Erreur lors de la modification de l’utilisateur')
    }
  }

  async function handleDeleteUser(user: UserProfile) {
    // Vérifier les permissions : admin peut supprimer tous les utilisateurs, manager peut supprimer ses agents et ses chefs de zone
    if (userProfile?.role !== 'admin' && userProfile?.role !== 'manager') return
    
    // Si c'est un manager, vérifier que l'utilisateur est un agent ou un chef de zone
    if (userProfile?.role === 'manager' && user.role !== 'agent' && user.role !== 'chef_zone') {
      setError('Vous ne pouvez supprimer que vos agents et vos chefs de zone')
      return
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.email} ?`)) {
      return
    }
    setError('')
    setSuccess('')

    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Vous devez être connecté pour effectuer cette action')
        return
      }

      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: user.id }),
      })

      const contentType = response.headers.get('content-type')
      const data = contentType && contentType.includes('application/json')
        ? await response.json()
        : { error: 'Réponse serveur invalide' }

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression de l’utilisateur')
      }

      setSuccess('Utilisateur supprimé avec succès')
      if (editingUser?.id === user.id) {
        setEditingUser(null)
        setShowEditForm(false)
      }
      loadUsers()
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error)
      setError(error.message || 'Erreur lors de la suppression de l’utilisateur')
    }
  }

  // Déterminer les rôles disponibles selon l'utilisateur connecté
  const availableRoles = userProfile?.role === 'admin' 
    ? ['manager', 'agent', 'chef_zone'] 
    : userProfile?.role === 'manager'
    ? ['agent', 'chef_zone']
    : []

  // Rôles éditables : admins peuvent modifier tous les rôles, managers peuvent modifier leurs agents et leurs chefs de zone
  const editableRoles = userProfile?.role === 'admin'
    ? ['manager', 'agent', 'chef_zone']
    : userProfile?.role === 'manager'
    ? ['agent', 'chef_zone'] // Managers peuvent modifier leurs agents et leurs chefs de zone
    : []

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
          {availableRoles.length > 0 && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showForm ? 'Annuler' : 'Créer un utilisateur'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Créer un nouvel utilisateur</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'manager' | 'agent' | 'chef_zone', agent_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {availableRoles.map(role => (
                      <option key={role} value={role}>
                        {role === 'manager' 
                          ? 'Manager' 
                          : role === 'chef_zone'
                          ? 'Chef de zone'
                          : 'Agent de crédit'}
                      </option>
                    ))}
                  </select>
                </div>

                {(formData.role === 'agent' || formData.role === 'chef_zone') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.role === 'agent' ? 'Agent de crédit *' : 'Agent de crédit'}
                    </label>
                    <select
                      value={formData.agent_id}
                      onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required={formData.role === 'agent'}
                    >
                      <option value="">Sélectionner un agent</option>
                      {agents.map(agent => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.nom} {agent.prenom}
                        </option>
                      ))}
                    </select>
                    {formData.role === 'chef_zone' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Optionnel : Attacher ce chef de zone à un agent de crédit spécifique
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Créer l'utilisateur
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({
                      email: '',
                      password: '',
                      role: 'agent',
                      nom: '',
                      prenom: '',
                      agent_id: '',
                    })
                    setError('')
                    setSuccess('')
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {showEditForm && editingUser && (userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Modifier l’utilisateur</h2>
              <button
                onClick={() => {
                  setShowEditForm(false)
                  setEditingUser(null)
                  setEditData({
                    email: '',
                    role: 'agent',
                    nom: '',
                    prenom: '',
                    agent_id: '',
                    password: '',
                  })
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Fermer
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={editData.password}
                    onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    minLength={6}
                    placeholder="Laisser vide pour conserver le mot de passe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle *
                  </label>
                  <select
                    value={editData.role}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        role: e.target.value as 'manager' | 'agent' | 'chef_zone',
                        agent_id: (e.target.value === 'agent' || e.target.value === 'chef_zone') ? editData.agent_id : '',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {editableRoles.map(role => (
                      <option key={role} value={role}>
                        {role === 'manager' 
                          ? 'Manager' 
                          : role === 'chef_zone'
                          ? 'Chef de zone'
                          : 'Agent de crédit'}
                      </option>
                    ))}
                  </select>
                </div>
                {(editData.role === 'agent' || editData.role === 'chef_zone') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editData.role === 'agent' ? 'Agent de crédit *' : 'Agent de crédit'}
                    </label>
                    <select
                      value={editData.agent_id}
                      onChange={(e) => setEditData({ ...editData, agent_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required={editData.role === 'agent'}
                    >
                      <option value="">Sélectionner un agent</option>
                      {agents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.nom} {agent.prenom}
                        </option>
                      ))}
                    </select>
                    {editData.role === 'chef_zone' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Optionnel : Attacher ce chef de zone à un agent de crédit spécifique
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={editData.nom}
                    onChange={(e) => setEditData({ ...editData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={editData.prenom}
                    onChange={(e) => setEditData({ ...editData, prenom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Mettre à jour
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Liste des utilisateurs</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center">Chargement...</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-gray-500">Aucun utilisateur trouvé</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rôle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date de création
                    </th>
                    {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.nom} {user.prenom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'chef_zone' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role === 'admin' ? 'Admin' :
                           user.role === 'manager' ? 'Manager' :
                           user.role === 'chef_zone' ? 'Chef de zone' :
                           'Agent'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.agent_id 
                          ? `${user.agent_id}${user.role === 'chef_zone' ? ' (attaché)' : ''}`
                          : user.role === 'chef_zone' 
                          ? 'Non attaché' 
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStartEdit(user)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              disabled={
                                userProfile?.role === 'manager' && 
                                user.role !== 'agent' && 
                                user.role !== 'chef_zone'
                              }
                              title={
                                userProfile?.role === 'manager' && user.role !== 'agent' && user.role !== 'chef_zone'
                                  ? 'Vous ne pouvez modifier que vos agents et vos chefs de zone'
                                  : ''
                              }
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              disabled={
                                userProfile?.role === 'manager' && 
                                user.role !== 'agent' && 
                                user.role !== 'chef_zone'
                              }
                              title={
                                userProfile?.role === 'manager' && user.role !== 'agent' && user.role !== 'chef_zone'
                                  ? 'Vous ne pouvez supprimer que vos agents et vos chefs de zone'
                                  : ''
                              }
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800"
          >
            ← Retour au dashboard
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function UtilisateursPage() {
  return (
    <ProtectedRoute requiredRole={['admin', 'manager']}>
      <UtilisateursPageContent />
    </ProtectedRoute>
  )
}

