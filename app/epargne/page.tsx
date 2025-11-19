'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/DashboardLayout'
import { supabase, type UserProfile, type Membre } from '@/lib/supabase'
import { getUserProfile, signOut } from '@/lib/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Pencil, Trash2 } from 'lucide-react'

type TransactionType = 'depot' | 'retrait'

type EpargneTransaction = {
  id: number
  membre_id: string
  agent_id: string
  type: TransactionType
  montant: number
  date_operation: string
  notes: string | null
  created_at: string
}

function EpargnePageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [membres, setMembres] = useState<Membre[]>([])
  const [selectedMembreId, setSelectedMembreId] = useState<string>('')
  const [transactions, setTransactions] = useState<EpargneTransaction[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [formData, setFormData] = useState<{
    type: TransactionType
    montant: string
    date_operation: string
    notes: string
  }>({
    type: 'depot',
    montant: '',
    date_operation: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const solde = useMemo(() => {
    return transactions.reduce((sum, t) => {
      return sum + (t.type === 'depot' ? Number(t.montant || 0) : -Number(t.montant || 0))
    }, 0)
  }, [transactions])

  // Fonction helper pour vérifier si un agent peut modifier/supprimer une transaction
  // Les agents peuvent modifier/supprimer seulement les transactions du jour même
  function canAgentModifyTransaction(transaction: EpargneTransaction): boolean {
    if (userProfile?.role !== 'agent') return true // Les managers et admins peuvent toujours modifier
    const today = new Date().toISOString().split('T')[0]
    return transaction.date_operation === today
  }

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadMembres()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  useEffect(() => {
    if (selectedMembreId) {
      loadTransactions(selectedMembreId)
    } else {
      setTransactions([])
    }
  }, [selectedMembreId])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
    setLoading(false)
  }

  async function loadMembres() {
    try {
      setLoading(true)
      let query = supabase
        .from('membres')
        .select('*')
        .order('created_at', { ascending: false })

      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Charger uniquement les membres des agents du manager
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
      console.error('Erreur chargement membres:', error)
      setMembres([])
    } finally {
      setLoading(false)
    }
  }

  async function loadTransactions(membreId: string) {
    try {
      setErrorMessage(null)
      const { data, error } = await supabase
        .from('epargne_transactions')
        .select('*')
        .eq('membre_id', membreId)
        .order('date_operation', { ascending: false })

      if (error) {
        // Table manquante -> message d'aide
        // Postgres undefined_table: 42P01
        if ((error as any).code === '42P01') {
          setErrorMessage(
            "La table 'epargne_transactions' n'existe pas encore. Veuillez créer la table côté Supabase pour activer l'épargne."
          )
        } else {
          setErrorMessage('Erreur lors du chargement des opérations.')
        }
        setTransactions([])
        return
      }

      setTransactions((data || []) as EpargneTransaction[])
    } catch (error) {
      console.error('Erreur chargement opérations épargne:', error)
      setErrorMessage('Erreur lors du chargement des opérations.')
      setTransactions([])
    }
  }

  const [editingTransaction, setEditingTransaction] = useState<EpargneTransaction | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMembreId) {
      alert('Veuillez sélectionner un membre.')
      return
    }
    const montant = parseFloat(formData.montant)
    if (!(montant > 0)) {
      alert('Veuillez saisir un montant positif.')
      return
    }
    if (formData.type === 'retrait' && montant > solde) {
      alert('Montant du retrait supérieur au solde disponible.')
      return
    }

    try {
      setSubmitting(true)
      setErrorMessage(null)

      // Déterminer l'agent_id applicable
      let finalAgentId = userProfile?.agent_id || ''
      if (!finalAgentId && userProfile?.role !== 'agent') {
        // Admin/manager doivent sélectionner un membre, on infère son agent_id
        const membre = membres.find(m => m.membre_id === selectedMembreId)
        finalAgentId = membre?.agent_id || ''
      }
      if (!finalAgentId) {
        alert("Agent de crédit introuvable pour cette opération.")
        return
      }

      if (editingTransaction) {
        // Mise à jour d'une transaction existante
        const { error } = await supabase
          .from('epargne_transactions')
          .update({
            type: formData.type,
            montant,
            date_operation: formData.date_operation,
          })
          .eq('id', editingTransaction.id)

        if (error) {
          console.error('Erreur lors de la mise à jour de l\'opération d\'épargne:', error)
          const errorMessage = error.message || 'Erreur inconnue'
          setErrorMessage(`Erreur lors de la mise à jour de l'opération: ${errorMessage}`)
          return
        }

        setEditingTransaction(null)
        alert('Opération mise à jour avec succès.')
      } else {
        // Création d'une nouvelle transaction
        const { error } = await supabase
          .from('epargne_transactions')
          .insert([{
            membre_id: selectedMembreId,
            agent_id: finalAgentId,
            type: formData.type,
            montant,
            date_operation: formData.date_operation,
            // Note: La colonne 'notes' n'existe pas dans la table epargne_transactions
          }])

        if (error) {
          console.error('Erreur lors de l\'enregistrement de l\'opération d\'épargne:', error)
          if ((error as any).code === '42P01') {
            setErrorMessage(
              "La table 'epargne_transactions' n'existe pas encore. Veuillez créer la table côté Supabase pour activer l'épargne."
            )
          } else {
            const errorMessage = error.message || 'Erreur inconnue'
            setErrorMessage(`Erreur lors de l'enregistrement de l'opération: ${errorMessage}`)
          }
          return
        }

        alert('Opération enregistrée avec succès.')
      }

      setFormData({
        type: 'depot',
        montant: '',
        date_operation: new Date().toISOString().split('T')[0],
        notes: '',
      })
      await loadTransactions(selectedMembreId)
    } catch (error) {
      console.error('Erreur enregistrement épargne:', error)
      setErrorMessage('Erreur lors de l\'enregistrement de l\'opération.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(transaction: EpargneTransaction) {
    setEditingTransaction(transaction)
    setFormData({
      type: transaction.type,
      montant: transaction.montant.toString(),
      date_operation: transaction.date_operation,
      notes: transaction.notes || '',
    })
  }

  function handleCancelEdit() {
    setEditingTransaction(null)
    setFormData({
      type: 'depot',
      montant: '',
      date_operation: new Date().toISOString().split('T')[0],
      notes: '',
    })
  }

  async function handleDelete(transaction: EpargneTransaction) {
    if (!confirm('Supprimer cette transaction ?')) return
    try {
      const { error } = await supabase
        .from('epargne_transactions')
        .delete()
        .eq('id', transaction.id)
      if (error) throw error
      alert('Transaction supprimée avec succès.')
      await loadTransactions(selectedMembreId)
    } catch (err: any) {
      console.error(err)
      setErrorMessage('Impossible de supprimer la transaction: ' + (err.message || 'Erreur inconnue'))
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  const filteredMembres = useMemo(() => {
    if (userProfile?.role === 'agent') return membres
    return membres
  }, [membres, userProfile])

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  const canOperate = userProfile.role === 'agent' || userProfile.role === 'admin'

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Épargne</h1>
            <p className="text-muted-foreground mt-2">
              Collecte d’épargne des membres. Les agents peuvent enregistrer dépôts et retraits.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Membre *
              </label>
              <select
                value={selectedMembreId}
                onChange={(e) => setSelectedMembreId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner un membre</option>
                {filteredMembres.map((membre) => (
                  <option key={membre.id} value={membre.membre_id}>
                    {membre.membre_id} — {membre.prenom} {membre.nom} ({membre.agent_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Solde actuel
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                {formatCurrency(solde)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date du jour
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                {formatDate(new Date().toISOString().split('T')[0])}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d’opération *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!canOperate || !selectedMembreId}
                >
                  <option value="depot">Dépôt</option>
                  <option value="retrait">Retrait</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant (HTG) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!canOperate || !selectedMembreId}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de l’opération *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_operation}
                  onChange={(e) => setFormData({ ...formData, date_operation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!canOperate || !selectedMembreId}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Dépôt hebdomadaire, retrait exceptionnel, etc."
                rows={3}
                disabled={!canOperate || !selectedMembreId}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!canOperate || !selectedMembreId || submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Enregistrement...' : editingTransaction ? 'Mettre à jour' : "Enregistrer l'opération"}
              </button>
              {editingTransaction && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Historique des opérations</h2>
            {!selectedMembreId && (
              <p className="text-sm text-gray-600 mt-1">Sélectionnez un membre pour voir l’historique.</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  {(userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'agent') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedMembreId && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={(userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'agent') ? 5 : 4} className="px-6 py-4 text-center text-gray-500">
                      Aucune opération enregistrée
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(t.date_operation)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            t.type === 'depot'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.type === 'depot' ? 'Dépôt' : 'Retrait'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatCurrency(t.montant)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {t.notes || '-'}
                      </td>
                      {(userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'agent') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(t)}
                              disabled={!canAgentModifyTransaction(t)}
                              className={`p-2 rounded ${
                                canAgentModifyTransaction(t)
                                  ? 'text-blue-600 hover:bg-blue-50'
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              title={
                                !canAgentModifyTransaction(t)
                                  ? 'Vous ne pouvez modifier que les transactions du jour même. Contactez votre manager pour modifier les transactions des jours précédents.'
                                  : 'Modifier la transaction'
                              }
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              disabled={!canAgentModifyTransaction(t)}
                              className={`p-2 rounded ${
                                canAgentModifyTransaction(t)
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              title={
                                !canAgentModifyTransaction(t)
                                  ? 'Vous ne pouvez supprimer que les transactions du jour même. Contactez votre manager pour supprimer les transactions des jours précédents.'
                                  : 'Supprimer la transaction'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function EpargnePage() {
  // Lecture: tout le monde connecté. Opérations: agents/admins via contrôles UI.
  return (
    <ProtectedRoute>
      <EpargnePageContent />
    </ProtectedRoute>
  )
}


