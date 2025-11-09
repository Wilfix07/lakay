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
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
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
  const [interestSummary, setInterestSummary] = useState<{
    total: number
    monthly: { key: string; label: string; interest: number }[]
  }>({ total: 0, monthly: [] })
  const [expensesSummary, setExpensesSummary] = useState<number>(0)

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
        const [
          agentsRes,
          membresRes,
          pretsRes,
          remboursementsRes,
          expensesRes,
        ] = await Promise.all([
          supabase.from('agents').select('agent_id, nom, prenom'),
          supabase.from('membres').select('id', { count: 'exact', head: true }),
          supabase.from('prets').select('id, montant_pret, nombre_remboursements'),
          supabase.from('remboursements').select('id, statut, agent_id, montant, pret_id, date_remboursement, date_paiement, principal, interet'),
          supabase.from('agent_expenses').select('amount'),
        ])

        if (agentsRes.error) throw agentsRes.error
        if (membresRes.error) throw membresRes.error
        if (pretsRes.error) throw pretsRes.error
        if (remboursementsRes.error) throw remboursementsRes.error
        if (expensesRes.error) throw expensesRes.error

        const agentsData = agentsRes.data || []
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

        const pretMap = new Map(
          (pretsRes.data || []).map((pret) => [pret.id, pret]),
        )
        const interestMap = new Map<string, number>()
        let totalInterest = 0
        for (const remboursement of remboursementsRes.data || []) {
          if (remboursement.statut !== 'paye') continue
          const pret = pretMap.get(remboursement.pret_id)
          const fallbackPrincipal =
            pret && pret.nombre_remboursements
              ? Number(pret.montant_pret || 0) / Number(pret.nombre_remboursements || 1)
              : Number(remboursement.montant || 0) / 1.15
          const principalValue =
            remboursement.principal != null
              ? Number(remboursement.principal)
              : Math.round(fallbackPrincipal * 100) / 100
          const interestValue =
            remboursement.interet != null
              ? Number(remboursement.interet)
              : Math.max(Number(remboursement.montant || 0) - principalValue, 0)
          if (interestValue <= 0) continue
          totalInterest += interestValue
          const rawDate = remboursement.date_paiement || remboursement.date_remboursement
          if (!rawDate) continue
          const dateObj = new Date(rawDate)
          if (Number.isNaN(dateObj.getTime())) continue
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
          interestMap.set(key, (interestMap.get(key) ?? 0) + interestValue)
        }

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
        const expensesTotal =
          expensesRes.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
        setExpensesSummary(expensesTotal)
        const monthly = Array.from(interestMap.entries())
          .map(([key, interest]) => {
            const [year, month] = key.split('-').map((value) => Number(value))
            const label = new Date(year, month - 1).toLocaleDateString('fr-FR', {
              month: 'short',
              year: 'numeric',
            })
            return { key, label, interest }
          })
          .sort((a, b) => a.key.localeCompare(b.key))
        setInterestSummary({ total: totalInterest, monthly })
      } 
      // Stats pour Agent (seulement ses données)
      else if (userProfile.role === 'agent' && userProfile.agent_id) {
        const [membresRes, pretsRes, remboursementsRes, expensesRes] = await Promise.all([
          supabase.from('membres').select('id', { count: 'exact', head: true }).eq('agent_id', userProfile.agent_id),
          supabase.from('prets').select('id, montant_pret, nombre_remboursements').eq('agent_id', userProfile.agent_id),
          supabase.from('remboursements').select('id, statut, agent_id, montant, pret_id, date_remboursement, date_paiement, principal, interet').eq('agent_id', userProfile.agent_id),
          supabase.from('agent_expenses').select('amount').eq('agent_id', userProfile.agent_id),
        ])

        if (membresRes.error) throw membresRes.error
        if (pretsRes.error) throw pretsRes.error
        if (remboursementsRes.error) throw remboursementsRes.error
        if (expensesRes.error) throw expensesRes.error

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
        const expensesTotal =
          expensesRes.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
        setExpensesSummary(expensesTotal)
        const pretMap = new Map(
          (pretsRes.data || []).map((pret) => [pret.id, pret]),
        )
        const interestMap = new Map<string, number>()
        let totalInterest = 0
        for (const remboursement of remboursementsRes.data || []) {
          if (remboursement.statut !== 'paye') continue
          const pret = pretMap.get(remboursement.pret_id)
          const fallbackPrincipal =
            pret && pret.nombre_remboursements
              ? Number(pret.montant_pret || 0) / Number(pret.nombre_remboursements || 1)
              : Number(remboursement.montant || 0) / 1.15
          const principalValue =
            remboursement.principal != null
              ? Number(remboursement.principal)
              : Math.round(fallbackPrincipal * 100) / 100
          const interestValue =
            remboursement.interet != null
              ? Number(remboursement.interet)
              : Math.max(Number(remboursement.montant || 0) - principalValue, 0)
          if (interestValue <= 0) continue
          totalInterest += interestValue
          const rawDate = remboursement.date_paiement || remboursement.date_remboursement
          if (!rawDate) continue
          const dateObj = new Date(rawDate)
          if (Number.isNaN(dateObj.getTime())) continue
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
          interestMap.set(key, (interestMap.get(key) ?? 0) + interestValue)
        }
        const monthly = Array.from(interestMap.entries())
          .map(([key, interest]) => {
            const [year, month] = key.split('-').map((value) => Number(value))
            const label = new Date(year, month - 1).toLocaleDateString('fr-FR', {
              month: 'short',
              year: 'numeric',
            })
            return { key, label, interest }
          })
          .sort((a, b) => a.key.localeCompare(b.key))
        setInterestSummary({ total: totalInterest, monthly })
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error)
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
    {
      title: 'Intérêt brut',
      value: formatCurrency(interestSummary.total),
      icon: ArrowDownRight,
      description: 'Intérêt (15%) collecté',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      title: 'Total dépenses',
      value: formatCurrency(expensesSummary),
      icon: ArrowUpRight,
      description: 'Dépenses opérationnelles',
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
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
          ...(userProfile.role === 'manager'
            ? [
                {
                  title: 'Suivi des dépenses',
                  description: 'Analyser les dépenses des agents',
                  href: '/expenses',
                  icon: ArrowDownRight,
                  color: 'text-rose-600',
                  bgColor: 'bg-rose-50',
                  hoverColor: 'hover:bg-rose-100',
                },
              ]
            : []),
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
          ...(userProfile.role === 'agent'
            ? [
                {
                  title: 'Suivi des dépenses',
                  description: 'Enregistrer et suivre vos dépenses',
                  href: '/expenses',
                  icon: ArrowDownRight,
                  color: 'text-rose-600',
                  bgColor: 'bg-rose-50',
                  hoverColor: 'hover:bg-rose-100',
                },
              ]
            : []),
        ]
      : []),
  ]

  const hasCollections = agentCollections.length > 0

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

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Intérêt perçu (15%)</CardTitle>
              <CardDescription>
                Total des intérêts collectés sur les remboursements payés
              </CardDescription>
            </div>
            {interestSummary.total > 0 && (
              <Badge variant="secondary" className="bg-rose-50 text-rose-600">
                Total: {formatCurrency(interestSummary.total)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {interestSummary.monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={interestSummary.monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    formatter={(value: number) => formatCurrency(Number(value))}
                    labelFormatter={(label) => `Mois: ${label}`}
                  />
                  <Bar
                    dataKey="interest"
                    fill="var(--color-chart-5)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center">
                Aucune donnée d'intérêt disponible pour le moment.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </DashboardLayout>
  )
}
