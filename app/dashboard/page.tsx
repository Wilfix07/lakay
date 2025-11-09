'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserProfile, signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { UserProfile as UserProfileType } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  CreditCard,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Plus,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

const EXPENSE_CATEGORIES = [
  { value: 'transport', label: 'Transport' },
  { value: 'communication', label: 'Communication' },
  { value: 'repas', label: 'Repas' },
  { value: 'logement', label: 'Logement' },
  { value: 'frais_bureau', label: 'Frais de bureau' },
  { value: 'autre', label: 'Autre' },
]

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

export default function DashboardPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    agents: 0,
    membres: 0,
    prets: 0,
    remboursements: 0,
    remboursementsPayes: 0,
    montantTotal: 0,
  })
  const [agentCollections, setAgentCollections] = useState<
    { agent_id: string; total_collected: number; displayName: string }[]
  >([])
  const [agentsDirectory, setAgentsDirectory] = useState<
    { agent_id: string; nom?: string | null; prenom?: string | null }[]
  >([])
  const [expenses, setExpenses] = useState<AgentExpense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null)
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [selectedExpenseAgent, setSelectedExpenseAgent] = useState<string>('all')
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    agent_id: '',
    amount: '',
    category: EXPENSE_CATEGORIES[0]?.value ?? 'transport',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadUserProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (userProfile) {
      loadStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  useEffect(() => {
    if (!userProfile) return
    if (userProfile.role !== 'agent' && userProfile.role !== 'manager') return
    loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, selectedExpenseAgent])

  useEffect(() => {
    if (userProfile?.role === 'agent' && userProfile.agent_id) {
      setExpenseForm((prev) => ({
        ...prev,
        agent_id: userProfile.agent_id ?? '',
      }))
    }
  }, [userProfile])

  useEffect(() => {
    if (userProfile?.role === 'manager') {
      if (
        selectedExpenseAgent !== 'all' &&
        !agentsDirectory.some((agent) => agent.agent_id === selectedExpenseAgent)
      ) {
        setSelectedExpenseAgent('all')
      }
    } else {
      setSelectedExpenseAgent('all')
    }
  }, [agentsDirectory, selectedExpenseAgent, userProfile])

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

  async function loadStats() {
    if (!userProfile) return

    try {
      // Stats pour Admin et Manager (tous les agents)
      if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        const [agentsRes, membresRes, pretsRes, remboursementsRes] = await Promise.all([
          supabase.from('agents').select('agent_id, nom, prenom'),
          supabase.from('membres').select('id', { count: 'exact', head: true }),
          supabase.from('prets').select('id, montant_pret'),
          supabase.from('remboursements').select('id, statut, agent_id, montant'),
        ])

        if (agentsRes.error) throw agentsRes.error
        if (membresRes.error) throw membresRes.error
        if (pretsRes.error) throw pretsRes.error
        if (remboursementsRes.error) throw remboursementsRes.error

        const agentsData = agentsRes.data || []
        setAgentsDirectory(agentsData)
        const montantTotal =
          pretsRes.data?.reduce((sum, p) => sum + Number(p.montant_pret || 0), 0) || 0
        const remboursementsPayes =
          remboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0

        const collectionMap = (remboursementsRes.data || [])
          .filter((item) => item.statut === 'paye' && item.agent_id)
          .reduce<Map<string, number>>((acc, item) => {
            const key = item.agent_id!
            const current = acc.get(key) ?? 0
            acc.set(key, current + Number(item.montant || 0))
            return acc
          }, new Map())

        const collections = Array.from(collectionMap.entries()).map(([agentId, total]) => {
          const agent = agentsData.find((a) => a.agent_id === agentId)
          const displayName = agent
            ? `${agent.prenom ?? ''} ${agent.nom ?? ''}`.trim() || agent.agent_id
            : agentId
          return { agent_id: agentId, total_collected: total, displayName }
        })

        setStats({
          agents: agentsData.length || 0,
          membres: membresRes.count || 0,
          prets: pretsRes.data?.length || 0,
          remboursements: remboursementsRes.data?.length || 0,
          remboursementsPayes,
          montantTotal,
        })
        setAgentCollections(
          collections.sort((a, b) => b.total_collected - a.total_collected),
        )
      } 
      // Stats pour Agent (seulement ses données)
      else if (userProfile.role === 'agent' && userProfile.agent_id) {
        const [membresRes, pretsRes, remboursementsRes] = await Promise.all([
          supabase.from('membres').select('id', { count: 'exact', head: true }).eq('agent_id', userProfile.agent_id),
          supabase.from('prets').select('id, montant_pret').eq('agent_id', userProfile.agent_id),
          supabase.from('remboursements').select('id, statut, agent_id, montant').eq('agent_id', userProfile.agent_id),
        ])

        if (membresRes.error) throw membresRes.error
        if (pretsRes.error) throw pretsRes.error
        if (remboursementsRes.error) throw remboursementsRes.error

        const montantTotal = pretsRes.data?.reduce((sum, p) => sum + Number(p.montant_pret || 0), 0) || 0
        const remboursementsPayes = remboursementsRes.data?.filter(r => r.statut === 'paye').length || 0

        setStats({
          agents: 0,
          membres: membresRes.count || 0,
          prets: pretsRes.data?.length || 0,
          remboursements: remboursementsRes.data?.length || 0,
          remboursementsPayes,
          montantTotal,
        })
        setAgentsDirectory([
          {
            agent_id: userProfile.agent_id,
            nom: userProfile.nom,
            prenom: userProfile.prenom,
          },
        ])
        const totalCollected =
          remboursementsRes.data
            ?.filter((item) => item.statut === 'paye')
            .reduce((sum, item) => sum + Number(item.montant || 0), 0) || 0
        const displayName =
          `${userProfile.prenom ?? ''} ${userProfile.nom ?? ''}`.trim() || userProfile.agent_id || 'Vous'
        const collections =
          totalCollected > 0
            ? [
                {
                  agent_id: userProfile.agent_id || 'self',
                  total_collected: totalCollected,
                  displayName,
                },
              ]
            : []
        setAgentCollections(collections)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error)
    }
  }

  async function loadExpenses() {
    if (!userProfile) return
    if (userProfile.role !== 'agent' && userProfile.role !== 'manager') {
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

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager' && selectedExpenseAgent !== 'all') {
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

    if (userProfile?.role === 'agent') {
      defaultAgentId = userProfile.agent_id ?? ''
    } else if (userProfile?.role === 'manager') {
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

    const role = userProfile.role
    if (role !== 'agent' && role !== 'manager') return

    const amountValue = Number(expenseForm.amount)
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setExpenseFormError('Veuillez saisir un montant valide.')
      return
    }

    let targetAgentId = ''
    if (role === 'agent') {
      targetAgentId = userProfile.agent_id ?? ''
    } else {
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
        agent_id: role === 'agent' ? targetAgentId : targetAgentId,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  if (!userProfile) {
    return null
  }

  const statCards = [
    ...(userProfile.role === 'admin' || userProfile.role === 'manager' 
      ? [{
          title: 'Agents',
          value: stats.agents,
          icon: UserPlus,
          description: 'Total agents',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        }]
      : []),
    {
      title: 'Membres',
      value: stats.membres,
      icon: Users,
      description: 'Total membres',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Prêts',
      value: stats.prets,
      icon: CreditCard,
      description: 'Prêts actifs',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Remboursements',
      value: stats.remboursements,
      icon: DollarSign,
      description: `${stats.remboursementsPayes} payés`,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      badge: stats.remboursementsPayes > 0 ? (
        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
          {stats.remboursementsPayes} payés
        </Badge>
      ) : null,
    },
    {
      title: 'Montant Total',
      value: formatCurrency(stats.montantTotal),
      icon: TrendingUp,
      description: 'Total prêté',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ]

  const actionCards = [
    ...(userProfile.role === 'admin' || userProfile.role === 'manager'
      ? [
          {
            title: 'Gérer les Utilisateurs',
            description: userProfile.role === 'admin' ? 'Créer managers et agents' : 'Créer des agents',
            href: '/utilisateurs',
            icon: Users,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            hoverColor: 'hover:bg-purple-100',
          },
          {
            title: 'Gérer les Agents',
            description: 'Créer et modifier les agents',
            href: '/agents',
            icon: UserPlus,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            hoverColor: 'hover:bg-blue-100',
          },
        ]
      : []),
    ...(userProfile.role === 'admin' || userProfile.role === 'agent'
      ? [
          {
            title: 'Gérer les Membres',
            description: 'Créer et modifier les membres',
            href: '/membres',
            icon: Users,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            hoverColor: 'hover:bg-green-100',
          },
          {
            title: 'Gérer les Prêts',
            description: 'Créer et décaisser les prêts',
            href: '/prets',
            icon: CreditCard,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            hoverColor: 'hover:bg-indigo-100',
          },
          {
            title: 'Remboursements',
            description: 'Enregistrer les paiements',
            href: '/remboursements',
            icon: DollarSign,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            hoverColor: 'hover:bg-orange-100',
          },
        ]
      : []),
  ]

  const hasCollections = agentCollections.length > 0
  const showExpenseManagement =
    userProfile.role === 'agent' || userProfile.role === 'manager'
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  )
  const categorySummaryMap = expenses.reduce<Record<string, number>>(
    (acc, expense) => {
      const key = (expense.category ?? 'autre').toLowerCase()
      acc[key] = (acc[key] ?? 0) + Number(expense.amount || 0)
      return acc
    },
    {},
  )
  const categorySummary = EXPENSE_CATEGORIES.map((category) => ({
    ...category,
    total: categorySummaryMap[category.value] ?? 0,
  }))
  const latestExpenses = expenses.slice(0, 8)
  const managerExpenseSummary =
    userProfile.role === 'manager' && selectedExpenseAgent === 'all'
      ? Array.from(
          expenses.reduce<Map<string, number>>((acc, expense) => {
            const current = acc.get(expense.agent_id) ?? 0
            acc.set(expense.agent_id, current + Number(expense.amount || 0))
            return acc
          }, new Map()),
        )
          .map(([agentId, total]) => {
            const agent = agentsDirectory.find(
              (agent) => agent.agent_id === agentId,
            )
            const displayName =
              agent && `${agent.prenom ?? ''} ${agent.nom ?? ''}`.trim()
                ? `${agent.prenom ?? ''} ${agent.nom ?? ''}`.trim()
                : agent?.agent_id || agentId
            return { agent_id: agentId, total, displayName }
          })
          .sort((a, b) => b.total - a.total)
      : []

  const getAgentLabel = (agentId: string) => {
    const agent = agentsDirectory.find((item) => item.agent_id === agentId)
    const label = `${agent?.prenom ?? ''} ${agent?.nom ?? ''}`.trim()
    return label || agent?.agent_id || agentId
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Bienvenue, {userProfile.nom && userProfile.prenom 
            ? `${userProfile.prenom} ${userProfile.nom}`
            : userProfile.email}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  {stat.description}
                  {stat.badge}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Action Cards */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4 text-foreground">
          Actions rapides
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actionCards.map((action, index) => {
            const Icon = action.icon
            return (
              <Link key={index} href={action.href}>
                <Card className={`border transition-all cursor-pointer ${action.hoverColor} hover:shadow-md`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-lg ${action.bgColor}`}>
                        <Icon className={`w-5 h-5 ${action.color}`} />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-base font-semibold mt-4">
                      {action.title}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Agent Collections */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Performance des agents</CardTitle>
              <CardDescription>
                Total collecté par agent de crédit (remboursements payés)
              </CardDescription>
            </div>
            {hasCollections && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Total HTG collecté: {formatCurrency(agentCollections.reduce((sum, item) => sum + item.total_collected, 0))}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="h-80">
              {hasCollections ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentCollections}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      formatter={(value: number) => formatCurrency(Number(value))}
                      labelFormatter={(label) => `Agent: ${label}`}
                    />
                    <Bar dataKey="total_collected" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center">
                  Aucune donnée de collecte disponible pour le moment.
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Total collecté</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hasCollections ? (
                    agentCollections.map((item) => (
                      <TableRow key={item.agent_id}>
                        <TableCell className="font-medium">{item.displayName}</TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(item.total_collected)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                        Aucune donnée de collecte disponible.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {showExpenseManagement && (
        <Card className="mt-8">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Gestion des dépenses</CardTitle>
                <CardDescription>
                  Suivi des dépenses opérationnelles {userProfile.role === 'manager' ? 'des agents' : 'de vos activités'}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {userProfile.role === 'manager' && (
                  <Select
                    value={selectedExpenseAgent}
                    onValueChange={setSelectedExpenseAgent}
                  >
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
                      {userProfile.role === 'manager' && (
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
                      {userProfile.role === 'agent' && (
                        <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">Agent</p>
                          <p className="text-sm font-medium">{getAgentLabel(userProfile.agent_id ?? '')}</p>
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
              {userProfile.role === 'manager' && selectedExpenseAgent === 'all' && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium">Total par agent</h4>
                  <div className="mt-3 space-y-2">
                    {managerExpenseSummary.length > 0 ? (
                      managerExpenseSummary.map((item) => (
                        <div
                          key={item.agent_id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground">{item.displayName}</span>
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
                    {userProfile.role === 'manager' && (
                      <TableHead>Agent</TableHead>
                    )}
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
                        {userProfile.role === 'manager' && (
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
                        colSpan={userProfile.role === 'manager' ? 5 : 4}
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
      )}
    </DashboardLayout>
  )
}
