'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/DashboardLayout'
import { getUserProfile, signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { UserProfile as UserProfileType } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

const EXPENSE_CATEGORIES = [
  { value: 'transport', label: 'Transport' },
  { value: 'communication', label: 'Communication' },
  { value: 'repas', label: 'Repas' },
  { value: 'logement', label: 'Logement' },
  { value: 'frais_bureau', label: 'Frais de bureau' },
  { value: 'autre', label: 'Autre' },
]

interface AgentDirectoryItem {
  agent_id: string
  nom?: string | null
  prenom?: string | null
}

interface AgentExpense {
  id: number
  agent_id: string
  amount: number
  category: string | null
  description: string | null
  expense_date: string
  created_at: string
  created_by?: string | null
}

export default function ExpensesPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [agentsDirectory, setAgentsDirectory] = useState<AgentDirectoryItem[]>([])
  const [expenses, setExpenses] = useState<AgentExpense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null)
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [selectedExpenseAgent, setSelectedExpenseAgent] = useState<string>('all')
  const [expenseForm, setExpenseForm] = useState({
    agent_id: '',
    amount: '',
    category: EXPENSE_CATEGORIES[0]?.value ?? 'transport',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
  })

  const isManager = userProfile?.role === 'manager'
  const isAgent = userProfile?.role === 'agent'

  useEffect(() => {
    loadUserProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!userProfile) return
    if (!isAgent && !isManager) return
    loadAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  useEffect(() => {
    if (!userProfile) return
    if (!isAgent && !isManager) return
    loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, selectedExpenseAgent])

  useEffect(() => {
    if (isAgent && userProfile?.agent_id) {
      setExpenseForm((prev) => ({
        ...prev,
        agent_id: userProfile.agent_id ?? '',
      }))
    }
  }, [isAgent, userProfile])

  useEffect(() => {
    if (isManager) {
      if (
        selectedExpenseAgent !== 'all' &&
        !agentsDirectory.some((agent) => agent.agent_id === selectedExpenseAgent)
      ) {
        setSelectedExpenseAgent('all')
      }
    } else {
      setSelectedExpenseAgent('all')
    }
  }, [agentsDirectory, selectedExpenseAgent, isManager])

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
      setLoadingProfile(false)
    }
  }

  async function loadAgents() {
    if (!userProfile) return
    if (!isManager) {
      if (isAgent && userProfile.agent_id) {
        setAgentsDirectory([
          { agent_id: userProfile.agent_id, nom: userProfile.nom, prenom: userProfile.prenom },
        ])
      }
      return
    }

    try {
      const { data, error } = await supabase
        .from('agents')
        .select('agent_id, nom, prenom')
        .order('agent_id', { ascending: true })

      if (error) throw error
      setAgentsDirectory(data ?? [])
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error)
    }
  }

  async function loadExpenses() {
    if (!userProfile) return
    if (!isAgent && !isManager) {
      setExpenses([])
      return
    }

    try {
      setExpensesLoading(true)
      setExpenseError(null)

      let query = supabase
        .from('agent_expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (isAgent && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (isManager && selectedExpenseAgent !== 'all') {
        query = query.eq('agent_id', selectedExpenseAgent)
      }

      const { data, error } = await query
      if (error) throw error

      setExpenses((data as AgentExpense[]) ?? [])
    } catch (error: any) {
      console.error('Erreur lors du chargement des dépenses:', error)
      setExpenseError(error.message ?? 'Erreur lors du chargement des dépenses.')
    } finally {
      setExpensesLoading(false)
    }
  }

  function prepareExpenseForm() {
    const today = new Date().toISOString().split('T')[0]
    let defaultAgentId = ''

    if (isAgent && userProfile?.agent_id) {
      defaultAgentId = userProfile.agent_id
    } else if (isManager) {
      if (selectedExpenseAgent !== 'all') {
        defaultAgentId = selectedExpenseAgent
      } else if (agentsDirectory.length > 0) {
        defaultAgentId = agentsDirectory[0].agent_id
      }
    }

    setExpenseForm({
      agent_id: defaultAgentId,
      amount: '',
      category: EXPENSE_CATEGORIES[0]?.value ?? 'transport',
      description: '',
      expense_date: today,
    })
    setExpenseFormError(null)
  }

  async function handleExpenseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userProfile) return
    if (!isAgent && !isManager) return

    const amountValue = Number(expenseForm.amount)
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setExpenseFormError('Veuillez saisir un montant valide.')
      return
    }

    let targetAgentId = ''
    if (isAgent) {
      targetAgentId = userProfile.agent_id ?? ''
    } else if (isManager) {
      targetAgentId =
        expenseForm.agent_id ||
        (selectedExpenseAgent !== 'all' ? selectedExpenseAgent : '')
    }

    if (!targetAgentId) {
      setExpenseFormError('Veuillez sélectionner un agent.')
      return
    }

    try {
      setExpenseSaving(true)
      setExpenseFormError(null)
      const payload = {
        agent_id: targetAgentId,
        amount: amountValue,
        category: expenseForm.category || null,
        description: expenseForm.description || null,
        expense_date: expenseForm.expense_date,
        created_by: userProfile.id,
      }

      const { error } = await supabase.from('agent_expenses').insert(payload)
      if (error) throw error

      setExpenseError(null)
      setExpenseDialogOpen(false)
      setExpenseForm({
        agent_id: isAgent ? targetAgentId : targetAgentId,
        amount: '',
        category: EXPENSE_CATEGORIES[0]?.value ?? 'transport',
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
      })
      await loadExpenses()
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement de la dépense:", error)
      setExpenseFormError(
        error.message ?? "Erreur lors de l'enregistrement de la dépense.",
      )
    } finally {
      setExpenseSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses],
  )

  const categorySummary = useMemo(() => {
    const summaryMap = expenses.reduce<Record<string, number>>((acc, expense) => {
      const key = (expense.category ?? 'autre').toLowerCase()
      acc[key] = (acc[key] ?? 0) + Number(expense.amount || 0)
      return acc
    }, {})
    return EXPENSE_CATEGORIES.map((category) => ({
      ...category,
      total: summaryMap[category.value] ?? 0,
    }))
  }, [expenses])

  const latestExpenses = useMemo(() => expenses.slice(0, 10), [expenses])

  const managerExpenseSummary = useMemo(() => {
    if (!isManager || selectedExpenseAgent !== 'all') return []
    return Array.from(
      expenses.reduce<Map<string, number>>((acc, expense) => {
        const current = acc.get(expense.agent_id) ?? 0
        acc.set(expense.agent_id, current + Number(expense.amount || 0))
        return acc
      }, new Map()),
    )
      .map(([agentId, total]) => ({
        agent_id: agentId,
        total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses, isManager, selectedExpenseAgent])

  const getAgentLabel = (agentId: string) => {
    const agent = agentsDirectory.find((item) => item.agent_id === agentId)
    const label = `${agent?.prenom ?? ''} ${agent?.nom ?? ''}`.trim()
    return label || agent?.agent_id || agentId
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!userProfile || (!isAgent && !isManager)) {
    router.push('/dashboard')
    return null
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gestion des dépenses
          </h1>
          <p className="text-muted-foreground mt-2">
            Suivi des dépenses opérationnelles {isManager ? 'des agents' : 'de vos activités'}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour au dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div />
            <div className="flex flex-wrap items-center gap-3">
              {isManager && (
                <Select value={selectedExpenseAgent} onValueChange={setSelectedExpenseAgent}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Tous les agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les agents</SelectItem>
                    {agentsDirectory.map((agent) => (
                      <SelectItem key={agent.agent_id} value={agent.agent_id}>
                        {getAgentLabel(agent.agent_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Dialog
                open={expenseDialogOpen}
                onOpenChange={(open) => {
                  setExpenseDialogOpen(open)
                  if (open) {
                    prepareExpenseForm()
                  } else {
                    setExpenseFormError(null)
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Enregistrer une dépense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouvelle dépense</DialogTitle>
                    <DialogDescription>
                      Saisissez les informations de la dépense à enregistrer.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleExpenseSubmit} className="space-y-4">
                    {isManager && (
                      <div className="space-y-2">
                        <Label>Agent concerné *</Label>
                        <Select
                          value={expenseForm.agent_id}
                          onValueChange={(value) =>
                            setExpenseForm((prev) => ({ ...prev, agent_id: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un agent" />
                          </SelectTrigger>
                          <SelectContent>
                            {agentsDirectory.map((agent) => (
                              <SelectItem key={agent.agent_id} value={agent.agent_id}>
                                {getAgentLabel(agent.agent_id)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {isAgent && (
                      <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Agent</p>
                        <p className="text-sm font-medium">
                          {getAgentLabel(userProfile.agent_id ?? '')}
                        </p>
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="expense-amount">Montant *</Label>
                        <Input
                          id="expense-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={expenseForm.amount}
                          onChange={(event) =>
                            setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Catégorie</Label>
                        <Select
                          value={expenseForm.category}
                          onValueChange={(value) =>
                            setExpenseForm((prev) => ({ ...prev, category: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une catégorie" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((category) => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expense-date">Date *</Label>
                        <Input
                          id="expense-date"
                          type="date"
                          required
                          value={expenseForm.expense_date}
                          onChange={(event) =>
                            setExpenseForm((prev) => ({
                              ...prev,
                              expense_date: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expense-description">Description</Label>
                      <Textarea
                        id="expense-description"
                        placeholder="Notes complémentaires..."
                        value={expenseForm.description}
                        onChange={(event) =>
                          setExpenseForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        rows={3}
                      />
                    </div>
                    {expenseFormError && (
                      <Alert variant="destructive">
                        <AlertDescription>{expenseFormError}</AlertDescription>
                      </Alert>
                    )}
                    <DialogFooter>
                      <Button type="submit" disabled={expenseSaving}>
                        {expenseSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enregistrement...
                          </>
                        ) : (
                          'Enregistrer'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {expenseError && (
            <Alert variant="destructive">
              <AlertDescription>{expenseError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Total des dépenses</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Nombre de dépenses</p>
              <p className="mt-2 text-2xl font-semibold">{expenses.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Dernière dépense</p>
              <p className="mt-2 text-2xl font-semibold">
                {expenses.length > 0 ? formatDate(expenses[0].expense_date) : '—'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-medium">Répartition par catégorie</h4>
              <div className="mt-3 space-y-2">
                {categorySummary.some((item) => item.total > 0) ? (
                  categorySummary.map((category) => (
                    <div
                      key={category.value}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{category.label}</span>
                      <span className="font-medium">
                        {category.total > 0 ? formatCurrency(category.total) : '—'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucune dépense enregistrée pour le moment.
                  </p>
                )}
              </div>
            </div>
            {isManager && selectedExpenseAgent === 'all' && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium">Total par agent</h4>
                <div className="mt-3 space-y-2">
                  {managerExpenseSummary.length > 0 ? (
                    managerExpenseSummary.map((item) => (
                      <div
                        key={item.agent_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{getAgentLabel(item.agent_id)}</span>
                        <span className="font-medium">{formatCurrency(item.total)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune dépense enregistrée pour le moment.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h4 className="text-sm font-semibold">Dernières dépenses</h4>
              {expensesLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {isManager && <TableHead>Agent</TableHead>}
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestExpenses.length > 0 ? (
                  latestExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.expense_date)}</TableCell>
                      {isManager && (
                        <TableCell>{getAgentLabel(expense.agent_id)}</TableCell>
                      )}
                      <TableCell className="capitalize">
                        {
                          EXPENSE_CATEGORIES.find(
                            (category) => category.value === (expense.category ?? 'autre'),
                          )?.label ?? 'Autre'
                        }
                      </TableCell>
                      <TableCell>{formatCurrency(Number(expense.amount || 0))}</TableCell>
                      <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                        {expense.description || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={isManager ? 5 : 4}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Aucune dépense enregistrée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}

