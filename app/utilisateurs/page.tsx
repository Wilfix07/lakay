'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, type UserProfile, type Agent } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'

function UtilisateursPageContent() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'agent' as 'manager' | 'agent',
    nom: '',
    prenom: '',
    agent_id: '', // Pour les agents seulement
  })
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editData, setEditData] = useState({
    email: '',
    role: 'agent' as 'manager' | 'agent',
    nom: '',
    prenom: '',
    agent_id: '',
    password: '',
  })
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  async function loadUsers() {
    try {
      setLoading(true)
      let query = supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      // Les managers ne voient que les agents
      if (userProfile?.role === 'manager') {
        query = query.eq('role', 'agent')
      }
      // Les admins voient tous les utilisateurs sauf les admins
      else if (userProfile?.role === 'admin') {
        query = query.in('role', ['manager', 'agent'])
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

      // Créer l'utilisateur dans Supabase Auth
      // Note: Cette opération nécessite la clé service_role côté serveur
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role,
          nom: formData.nom,
          prenom: formData.prenom,
          agent_id: formData.role === 'agent' ? formData.agent_id : null,
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
    if (userProfile?.role !== 'admin') return
    setEditingUser(user)
    setEditData({
      email: user.email,
      role: (user.role as 'manager' | 'agent') ?? 'agent',
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
      const payload: Record<string, any> = {
        id: editingUser.id,
        email: editData.email,
        role: editData.role,
        nom: editData.nom,
        prenom: editData.prenom,
        agent_id: editData.role === 'agent' ? editData.agent_id : null,
      }
      if (editData.password) {
        payload.password = editData.password
      }

      const response = await fetch('/api/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
    if (userProfile?.role !== 'admin') return
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l’utilisateur ${user.email} ?`)) {
      return
    }
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
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
    ? ['manager', 'agent'] 
    : userProfile?.role === 'manager'
    ? ['agent']
    : []

  if (loading && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
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
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'manager' | 'agent', agent_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {availableRoles.map(role => (
                      <option key={role} value={role}>
                        {role === 'manager' ? 'Manager' : 'Agent de crédit'}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.role === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent de crédit *
                    </label>
                    <select
                      value={formData.agent_id}
                      onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Sélectionner un agent</option>
                      {agents.map(agent => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.nom} {agent.prenom}
                        </option>
                      ))}
                    </select>
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

        {showEditForm && editingUser && userProfile?.role === 'admin' && (
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
                        role: e.target.value as 'manager' | 'agent',
                        agent_id: e.target.value === 'agent' ? editData.agent_id : '',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="manager">Manager</option>
                    <option value="agent">Agent de crédit</option>
                  </select>
                </div>
                {editData.role === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent de crédit *
                    </label>
                    <select
                      value={editData.agent_id}
                      onChange={(e) => setEditData({ ...editData, agent_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Sélectionner un agent</option>
                      {agents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.nom} {agent.prenom}
                        </option>
                      ))}
                    </select>
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
                    {userProfile?.role === 'admin' && (
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
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role === 'admin' ? 'Admin' :
                           user.role === 'manager' ? 'Manager' :
                           'Agent'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.agent_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      {userProfile?.role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStartEdit(user)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
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
    </div>
  )
}

export default function UtilisateursPage() {
  return (
    <ProtectedRoute requiredPermission="canCreateUsers">
      <UtilisateursPageContent />
    </ProtectedRoute>
  )
}

