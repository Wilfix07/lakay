'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  supabase,
  type Agent,
  type AgentExpense,
  type ExpenseCategory,
  type UserProfile,
} from '@/lib/supabase'
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
import { Loader2, Pencil, Trash2, Plus, Filter, RefreshCcw } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getExpenseCategories } from '@/lib/systemSettings'

type Filters = {
  agent_id: string
  category: string
  month: string
}

const DEFAULT_FORM = () => ({
  agent_id: '',
  category: '',
  amount: '',
  expense_date: new Date().toISOString().split('T')[0],
  description: '',
})

function ExpensesPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<AgentExpense[]>([])
  const [filters, setFilters] = useState<Filters>({ agent_id: '', category: '', month: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<AgentExpense | null>(null)
  const [formData, setFormData] = useState(DEFAULT_FORM)

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
    ;(async () => {
      const profile = await getUserProfile()
      setUserProfile(profile)
    })()
  }, [])

  useEffect(() => {
    if (!userProfile) return
    loadReferenceData()
  }, [userProfile])

  async function loadReferenceData() {
    setLoading(true)
    setError(null)
    try {
      let agentQuery = supabase.from('agents').select('*').order('agent_id', { ascending: true })
      
      if (userProfile?.role === 'manager') {
        agentQuery = agentQuery.eq('manager_id', userProfile.id)
      } else if (userProfile?.role === 'agent') {
        agentQuery = agentQuery.eq('agent_id', userProfile?.agent_id ?? '')
      }
      // Admin voit tous les agents (pas de filtre)

      const [{ data: agentsData, error: agentsError }] = await Promise.all([agentQuery])

      if (agentsError) throw agentsError

      setAgents(agentsData || [])
      
      // Charger les catégories de dépenses actives depuis les paramètres système
      const categoriesData = await getExpenseCategories()
      setCategories(categoriesData || [])
      const initialAgent =
        userProfile?.role === 'agent' && userProfile.agent_id ? userProfile.agent_id : ''
      setFormData((prev) => ({
        ...prev,
        agent_id: initialAgent,
      }))
      await loadExpenses(filters, agentsData || [])
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }

  async function loadExpenses(
    activeFilters: Filters,
    availableAgents: Agent[] = agents,
  ) {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('agent_expenses').select('*').order('expense_date', {
        ascending: false,
      })

      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Manager voit seulement les dépenses de ses agents
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          if (activeFilters.agent_id) {
            // Si un agent spécifique est filtré, vérifier qu'il appartient au manager
            if (agentIds.includes(activeFilters.agent_id)) {
              query = query.eq('agent_id', activeFilters.agent_id)
            } else {
              // Agent n'appartient pas au manager, retourner vide
              setExpenses([])
              return
            }
          } else {
            // Filtrer par tous les agents du manager
            query = query.in('agent_id', agentIds)
          }
        } else {
          // Si le manager n'a pas encore d'agents, retourner un tableau vide
          setExpenses([])
          return
        }
      } else if (activeFilters.agent_id) {
        query = query.eq('agent_id', activeFilters.agent_id)
      }

      if (activeFilters.category) {
        query = query.eq('category', activeFilters.category)
      }

      if (activeFilters.month) {
        const [year, month] = activeFilters.month.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]
        query = query.gte('expense_date', startDate).lte('expense_date', endDate)
      }

      const { data, error: expensesError } = await query
      if (expensesError) throw expensesError
      setExpenses(data || [])
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les dépenses.')
    } finally {
      setLoading(false)
    }
  }

  function resetFormData() {
    setFormData((prev) => ({
      ...DEFAULT_FORM(),
      agent_id: userProfile?.role === 'agent' ? userProfile.agent_id ?? '' : prev.agent_id,
    }))
    setEditingExpense(null)
  }

  function handleCreate() {
    resetFormData()
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  function handleEdit(expense: AgentExpense) {
    setEditingExpense(expense)
    setFormData({
      agent_id: expense.agent_id,
      category: expense.category ?? '',
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      description: expense.description ?? '',
    })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  async function handleDelete(expense: AgentExpense) {
    if (!confirm('Supprimer cette dépense ?')) return
    try {
      const { error: deleteError } = await supabase
        .from('agent_expenses')
        .delete()
        .eq('id', expense.id)
      if (deleteError) throw deleteError
      setSuccess('Dépense supprimée.')
      await loadExpenses(filters)
    } catch (err) {
      console.error(err)
      setError('Impossible de supprimer la dépense.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const amountValue = parseFloat(formData.amount)
    if (!formData.agent_id) {
      setError('Veuillez sélectionner un agent.')
      return
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setError('Montant invalide.')
      return
    }

    try {
      setSaving(true)
      const payload = {
        agent_id: formData.agent_id,
        amount: amountValue,
        category: formData.category || null,
        description: formData.description || null,
        expense_date: formData.expense_date,
        created_by: userProfile?.id ?? null,
      }

      if (editingExpense) {
        const { error: updateError } = await supabase
          .from('agent_expenses')
          .update(payload)
          .eq('id', editingExpense.id)
        if (updateError) throw updateError
        setSuccess('Dépense mise à jour.')
      } else {
        const { error: insertError } = await supabase.from('agent_expenses').insert(payload)
        if (insertError) throw insertError
        setSuccess('Dépense enregistrée.')
      }

      setShowForm(false)
      resetFormData()
      await loadExpenses(filters)
    } catch (err) {
      console.error(err)
      setError("Impossible d'enregistrer la dépense.")
    } finally {
      setSaving(false)
    }
  }

  const filteredAgents = useMemo(() => {
    if (userProfile?.role === 'agent' && userProfile.agent_id) {
      return agents.filter((agent) => agent.agent_id === userProfile.agent_id)
    }
    return agents
  }, [agents, userProfile])

  const summary = useMemo(() => {
    const byAgent = new Map<string, number>()
    const byCategory = new Map<string, number>()
    let total = 0

    for (const expense of expenses) {
      const value = Number(expense.amount || 0)
      total += value
      byAgent.set(expense.agent_id, (byAgent.get(expense.agent_id) ?? 0) + value)
      if (expense.category) {
        byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + value)
      }
    }

    return { total, byAgent, byCategory }
  }, [expenses])

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  const isAdmin = userProfile.role === 'admin'
  const canManage = userProfile.role !== 'manager' ? isAdmin || userProfile.role === 'agent' : true

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dépenses</h1>
            <p className="text-muted-foreground mt-2">
              Suivez et gérez les dépenses des agents de crédit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Accueil
            </Link>
            {canManage && (
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                Nouvelle dépense
              </Button>
            )}
            <Button variant="outline" onClick={() => loadExpenses(filters)} className="gap-2">
              <RefreshCcw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtres
            </CardTitle>
            <CardDescription>Affinez la liste en fonction d’un agent, d’une catégorie ou d’un mois.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label>Agent</Label>
                <select
                  value={filters.agent_id}
                  onChange={(e) => {
                    const next = { ...filters, agent_id: e.target.value }
                    setFilters(next)
                    loadExpenses(next)
                  }}
                  className="w-full mt-1 rounded-md border border-gray-300 px-3 py-2"
                  disabled={userProfile.role === 'agent'}
                >
                  <option value="">Tous</option>
                  {filteredAgents.map((agent) => (
                    <option key={agent.id} value={agent.agent_id}>
                      {agent.agent_id} - {agent.prenom} {agent.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Catégorie</Label>
                <select
                  value={filters.category}
                  onChange={(e) => {
                    const next = { ...filters, category: e.target.value }
                    setFilters(next)
                    loadExpenses(next)
                  }}
                  className="w-full mt-1 rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Toutes</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Mois</Label>
                <Input
                  type="month"
                  value={filters.month}
                  onChange={(e) => {
                    const next = { ...filters, month: e.target.value }
                    setFilters(next)
                    loadExpenses(next)
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const reset = { agent_id: '', category: '', month: '' }
                    setFilters(reset)
                    loadExpenses(reset)
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingExpense ? 'Modifier la dépense' : 'Enregistrer une dépense'}</CardTitle>
              <CardDescription>Renseignez les informations nécessaires puis validez.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              {success && <p className="text-sm text-emerald-600 mb-3">{success}</p>}
              <form className="grid md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label>Agent *</Label>
                  <select
                    required
                    value={formData.agent_id}
                    onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    disabled={userProfile.role === 'agent'}
                  >
                    <option value="">Sélectionner un agent</option>
                    {filteredAgents.map((agent) => (
                      <option key={agent.id} value={agent.agent_id}>
                        {agent.agent_id} - {agent.prenom} {agent.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="">Aucune</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Montant (HTG) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : editingExpense ? (
                      'Mettre à jour'
                    ) : (
                      'Enregistrer'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false)
                      resetFormData()
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dépenses enregistrées</CardTitle>
            <CardDescription>
              Total: {formatCurrency(summary.total)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Aucune dépense enregistrée.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>{isAdmin ? 'Actions' : ''}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.expense_date)}</TableCell>
                        <TableCell>
                          {expense.agent_id}
                          {(() => {
                            const agent = agents.find((a) => a.agent_id === expense.agent_id)
                            if (!agent) return ''
                            const fullName = `${agent.prenom ?? ''} ${agent.nom ?? ''}`.trim()
                            return fullName ? ` • ${fullName}` : ''
                          })()}
                        </TableCell>
                        <TableCell>{expense.category ?? '-'}</TableCell>
                        <TableCell className="max-w-sm truncate">
                          {expense.description ?? '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleEdit(expense)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => handleDelete(expense)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total par agent</CardTitle>
              <CardDescription>Somme des dépenses pour chaque agent.</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.byAgent.size === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {[...summary.byAgent.entries()].map(([agentId, total]) => {
                    const agent = agents.find((a) => a.agent_id === agentId)
                    const fullName = agent ? `${agent.prenom ?? ''} ${agent.nom ?? ''}`.trim() : ''
                    return (
                      <li key={agentId} className="flex justify-between">
                        <span>
                          {agentId}
                          {fullName ? ` • ${fullName}` : ''}
                        </span>
                        <span className="font-medium">{formatCurrency(total)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total par catégorie</CardTitle>
              <CardDescription>Répartition des dépenses par catégorie.</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.byCategory.size === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {[...summary.byCategory.entries()].map(([categoryName, total]) => (
                    <li key={categoryName} className="flex justify-between">
                      <span>{categoryName}</span>
                      <span className="font-medium">{formatCurrency(total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function ExpensesPage() {
  return (
    <ProtectedRoute requiredRole={['admin', 'manager', 'agent']}>
      <ExpensesPageContent />
    </ProtectedRoute>
  )
}

