'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase, type UserProfile } from '@/lib/supabase'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { getInterestRates } from '@/lib/systemSettings'
import { AlertTriangle, Loader2, TrendingUp, ArrowDownRight, Wallet, PiggyBank, RefreshCcw } from 'lucide-react'

type MonthlyRow = {
  key: string
  label: string
  interest: number
  expenses: number
  net: number
  commission: number
  netAfterCommission: number
}

type AgentRow = {
  agentId: string
  displayName: string
  interest: number
  expenses: number
  net: number
  commission: number
  netAfterCommission: number
}

type Summary = {
  interest: number
  expenses: number
  net: number
  commission: number
  netAfterCommission: number
}

export default function ProfitLossPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary>({
    interest: 0,
    expenses: 0,
    net: 0,
    commission: 0,
    netAfterCommission: 0,
  })
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([])
  const [agentRows, setAgentRows] = useState<AgentRow[]>([])
  const [commissionRatePercent, setCommissionRatePercent] = useState<number>(30)
  const [baseInterestRatePercent, setBaseInterestRatePercent] = useState<number>(15)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const commissionRateLabel = `${commissionRatePercent.toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
  })}%`
  const baseInterestRateLabel = `${baseInterestRatePercent.toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
  })}%`

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (!userProfile) return

    // Charger les données initiales
    loadProfitLoss()

    // Configurer les subscriptions Supabase Realtime pour rendre la page totalement dynamique
    const subscriptions: Array<{ channel: any; unsubscribe: () => void }> = []

    // Construire les filtres selon le rôle
    let remboursementsFilter = ''
    let pretsFilter = ''
    let expensesFilter = ''

    if (userProfile.role === 'agent' && userProfile.agent_id) {
      remboursementsFilter = `agent_id=eq.${userProfile.agent_id}`
      pretsFilter = `agent_id=eq.${userProfile.agent_id}`
      expensesFilter = `agent_id=eq.${userProfile.agent_id}`
    }

    // Subscription pour les remboursements individuels
    const remboursementsChannel = supabase
      .channel('pnl-remboursements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remboursements',
          filter: remboursementsFilter || undefined,
        },
        (payload) => {
          console.log('💰 Changement détecté dans remboursements (P&L):', payload.eventType)
          loadProfitLoss(false)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
          console.log('✅ Subscription remboursements P&L active')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erreur de subscription remboursements P&L')
          setRealtimeConnected(false)
        }
      })

    subscriptions.push({
      channel: remboursementsChannel,
      unsubscribe: () => remboursementsChannel.unsubscribe(),
    })

    // Subscription pour les remboursements de groupe (si la table existe)
    const groupRemboursementsChannel = supabase
      .channel('pnl-group-remboursements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_remboursements',
          filter: remboursementsFilter || undefined,
        },
        (payload) => {
          console.log('💰 Changement détecté dans group_remboursements (P&L):', payload.eventType)
          loadProfitLoss(false)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
          console.log('✅ Subscription group_remboursements P&L active')
        }
      })

    subscriptions.push({
      channel: groupRemboursementsChannel,
      unsubscribe: () => groupRemboursementsChannel.unsubscribe(),
    })

    // Subscription pour les dépenses
    const expensesChannel = supabase
      .channel('pnl-expenses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_expenses',
          filter: expensesFilter || undefined,
        },
        (payload) => {
          console.log('💸 Changement détecté dans agent_expenses (P&L):', payload.eventType)
          loadProfitLoss(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: expensesChannel,
      unsubscribe: () => expensesChannel.unsubscribe(),
    })

    // Subscription pour les prêts individuels
    const pretsChannel = supabase
      .channel('pnl-prets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prets',
          filter: pretsFilter || undefined,
        },
        (payload) => {
          console.log('📊 Changement détecté dans prets (P&L):', payload.eventType)
          loadProfitLoss(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: pretsChannel,
      unsubscribe: () => pretsChannel.unsubscribe(),
    })

    // Subscription pour les prêts de groupe (si la table existe)
    const groupPretsChannel = supabase
      .channel('pnl-group-prets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_prets',
          filter: pretsFilter || undefined,
        },
        (payload) => {
          console.log('📊 Changement détecté dans group_prets (P&L):', payload.eventType)
          loadProfitLoss(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: groupPretsChannel,
      unsubscribe: () => groupPretsChannel.unsubscribe(),
    })

    // Subscription pour les agents (pour les admins et managers)
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      const agentsChannel = supabase
        .channel('pnl-agents')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'agents',
          },
          (payload) => {
            console.log('👤 Changement détecté dans agents (P&L):', payload.eventType)
            loadProfitLoss(false)
          }
        )
        .subscribe()

      subscriptions.push({
        channel: agentsChannel,
        unsubscribe: () => agentsChannel.unsubscribe(),
      })
    }

    // Rafraîchissement périodique de secours (toutes les 60 secondes) au cas où les subscriptions échouent
    const intervalId = setInterval(() => {
      if (!realtimeConnected) {
        loadProfitLoss(false)
      }
    }, 60000) // 60 secondes comme backup

    // Nettoyer les subscriptions et l'intervalle lors du démontage
    return () => {
      console.log('🧹 Nettoyage des subscriptions P&L')
      subscriptions.forEach((sub) => sub.unsubscribe())
      clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  async function loadUserProfile() {
    try {
      const profile = await getUserProfile()
      if (!profile) {
        return
      }
      setUserProfile(profile)
    } finally {
      setLoading(false)
    }
  }

  // Helper function pour gérer les erreurs de tables optionnelles
  const safeQuery = async (query: any) => {
    try {
      const result = await query
      // Si la requête retourne une erreur (table n'existe pas, etc.), retourner un résultat vide
      if (result.error) {
        const errorCode = (result.error as any)?.code
        const errorStatus = (result.error as any)?.status
        if (errorCode === '42P01' || errorCode === 'PGRST116' || errorStatus === 404) {
          return { data: [], error: null }
        }
      }
      return result
    } catch (error: any) {
      // Si une exception est lancée, vérifier le code d'erreur
      if (error?.code === '42P01' || error?.code === 'PGRST116' || error?.status === 404) {
        return { data: [], error: null }
      }
      throw error
    }
  }

  async function loadProfitLoss(showLoading = true) {
    if (!userProfile) return
    if (showLoading) {
      setLoading(true)
    }
    try {
      if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        await loadProfitLossForAdmin()
      } else if (userProfile.role === 'agent' && userProfile.agent_id) {
        await loadProfitLossForAgent(userProfile.agent_id)
      }
    } catch (error) {
      console.error('Erreur lors du chargement du P&L:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await loadProfitLoss(true)
    } finally {
      setRefreshing(false)
    }
  }

  async function loadProfitLossForAdmin() {
    const [
      interestRates,
      agentsRes,
      pretsRes,
      remboursementsRes,
      groupPretsRes,
      groupRemboursementsRes,
      expensesRes,
    ] = await Promise.all([
      getInterestRates(),
      supabase.from('agents').select('agent_id, nom, prenom'),
      supabase.from('prets').select('pret_id, montant_pret, nombre_remboursements, agent_id'),
      supabase
        .from('remboursements')
        .select(
          'agent_id, montant, statut, pret_id, principal, interet, date_paiement, date_remboursement',
        ),
      safeQuery(supabase.from('group_prets').select('pret_id, montant_pret, nombre_remboursements, agent_id')),
      safeQuery(supabase
        .from('group_remboursements')
        .select(
          'agent_id, montant, statut, pret_id, principal, interet, date_paiement, date_remboursement',
        )),
      supabase.from('agent_expenses').select('agent_id, amount, expense_date'),
    ])

    if (agentsRes.error) throw agentsRes.error
    if (pretsRes.error) throw pretsRes.error
    if (remboursementsRes.error) throw remboursementsRes.error
    if (expensesRes.error) throw expensesRes.error
    
    const commissionRate =
      interestRates?.commissionRate !== undefined && !Number.isNaN(interestRates.commissionRate)
        ? interestRates.commissionRate
        : 0.3
    const commissionRatePercentValue = Number((commissionRate * 100).toFixed(2))
    setCommissionRatePercent(commissionRatePercentValue)
    const baseRate =
      interestRates?.baseInterestRate !== undefined && !Number.isNaN(interestRates.baseInterestRate)
        ? interestRates.baseInterestRate
        : 0.15
    const baseRatePercentValue = Number((baseRate * 100).toFixed(2))
    setBaseInterestRatePercent(baseRatePercentValue)

    // Combiner les prêts individuels et de groupe
    const allPrets = [
      ...(pretsRes.data || []),
      ...(groupPretsRes.data || []),
    ]

    // Combiner les remboursements individuels et de groupe
    const allRemboursements = [
      ...(remboursementsRes.data || []),
      ...(groupRemboursementsRes.data || []),
    ]

    computeProfitLoss(
      {
        agents: agentsRes.data || [],
        prets: allPrets,
        remboursements: allRemboursements,
        expenses: expensesRes.data || [],
      },
      commissionRate,
    )
  }

  async function loadProfitLossForAgent(agentId: string) {
    const [
      interestRates,
      pretsRes,
      remboursementsRes,
      groupPretsRes,
      groupRemboursementsRes,
      expensesRes,
    ] = await Promise.all([
      getInterestRates(),
      supabase
        .from('prets')
        .select('pret_id, montant_pret, nombre_remboursements, agent_id')
        .eq('agent_id', agentId),
      supabase
        .from('remboursements')
        .select(
          'agent_id, montant, statut, pret_id, principal, interet, date_paiement, date_remboursement',
        )
        .eq('agent_id', agentId),
      safeQuery(supabase
        .from('group_prets')
        .select('pret_id, montant_pret, nombre_remboursements, agent_id')
        .eq('agent_id', agentId)),
      safeQuery(supabase
        .from('group_remboursements')
        .select(
          'agent_id, montant, statut, pret_id, principal, interet, date_paiement, date_remboursement',
        )
        .eq('agent_id', agentId)),
      supabase.from('agent_expenses').select('agent_id, amount, expense_date').eq('agent_id', agentId),
    ])

    if (pretsRes.error) throw pretsRes.error
    if (remboursementsRes.error) throw remboursementsRes.error
    if (expensesRes.error) throw expensesRes.error
    
    const commissionRate =
      interestRates?.commissionRate !== undefined && !Number.isNaN(interestRates.commissionRate)
        ? interestRates.commissionRate
        : 0.3
    const commissionRatePercentValue = Number((commissionRate * 100).toFixed(2))
    setCommissionRatePercent(commissionRatePercentValue)
    const baseRate =
      interestRates?.baseInterestRate !== undefined && !Number.isNaN(interestRates.baseInterestRate)
        ? interestRates.baseInterestRate
        : 0.15
    const baseRatePercentValue = Number((baseRate * 100).toFixed(2))
    setBaseInterestRatePercent(baseRatePercentValue)

    // Combiner les prêts individuels et de groupe
    const allPrets = [
      ...(pretsRes.data || []),
      ...(groupPretsRes.data || []),
    ]

    // Combiner les remboursements individuels et de groupe
    const allRemboursements = [
      ...(remboursementsRes.data || []),
      ...(groupRemboursementsRes.data || []),
    ]

    computeProfitLoss(
      {
        agents: userProfile && userProfile.agent_id
          ? [
              {
                agent_id: userProfile.agent_id,
                nom: userProfile.nom ?? '',
                prenom: userProfile.prenom ?? '',
              },
            ]
          : [],
        prets: allPrets,
        remboursements: allRemboursements,
        expenses: expensesRes.data || [],
      },
      commissionRate,
    )
  }

  type ComputeProfitLossArgs = {
    agents: { agent_id: string; nom: string | null; prenom: string | null }[]
    prets: {
      pret_id: string
      montant_pret: number | null
      nombre_remboursements: number | null
      agent_id: string | null
    }[]
    remboursements: {
      agent_id: string | null
      montant: number | null
      statut: string | null
      pret_id: string | null
      principal: number | null
      interet: number | null
      date_paiement: string | null
      date_remboursement: string | null
    }[]
    expenses: { agent_id: string | null; amount: number | null; expense_date: string | null }[]
  }

  function computeProfitLoss(
    { agents, prets, remboursements, expenses }: ComputeProfitLossArgs,
    commissionRate: number,
  ) {
    const pretMap = new Map(
      prets.map((pret) => [pret.pret_id, pret]),
    )
    const agentDisplayMap = new Map(
      agents.map((agent) => [
        agent.agent_id,
        `${agent.prenom ?? ''} ${agent.nom ?? ''}`.trim() || agent.agent_id,
      ]),
    )

    const monthlyExpensesMap = new Map<string, number>()
    const monthlyExpensesByAgent = new Map<string, Map<string, number>>()
    const agentExpensesTotals = new Map<string, number>()
    let totalExpenses = 0

    for (const expense of expenses) {
      const amount = Number(expense.amount || 0)
      totalExpenses += amount
      const agentId = expense.agent_id ?? 'unknown'
      agentExpensesTotals.set(agentId, (agentExpensesTotals.get(agentId) ?? 0) + amount)

      if (expense.expense_date) {
        const dateObj = new Date(expense.expense_date)
        if (!Number.isNaN(dateObj.getTime())) {
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
          monthlyExpensesMap.set(key, (monthlyExpensesMap.get(key) ?? 0) + amount)
          if (!monthlyExpensesByAgent.has(agentId)) {
            monthlyExpensesByAgent.set(agentId, new Map())
          }
          const agentMonthly = monthlyExpensesByAgent.get(agentId)!
          agentMonthly.set(key, (agentMonthly.get(key) ?? 0) + amount)
        }
      }
    }

    const agentInterestTotals = new Map<string, number>()
    const monthlyInterestMap = new Map<string, number>()
    const monthlyInterestByAgent = new Map<string, Map<string, number>>()
    let totalInterest = 0

    const getPrincipalValue = (remboursement: {
      principal: number | null
      montant: number | null
      pret_id: string | null
    }) => {
      if (remboursement.principal != null) {
        return Number(remboursement.principal)
      }
      const pret =
        remboursement.pret_id != null ? pretMap.get(remboursement.pret_id) : undefined
      if (pret && pret.nombre_remboursements) {
        const base =
          Number(pret.montant_pret || 0) / Number(pret.nombre_remboursements || 1)
        return Math.round(base * 100) / 100
      }
      const fallback =
        Number(remboursement.montant || 0) / 1.15
      return Math.round(fallback * 100) / 100
    }

    for (const remboursement of remboursements) {
      if (remboursement.statut !== 'paye') continue
      const agentId = remboursement.agent_id ?? 'unknown'
      const principalValue = getPrincipalValue(remboursement)
      const interestValue =
        remboursement.interet != null
          ? Number(remboursement.interet)
          : Math.max(Number(remboursement.montant || 0) - principalValue, 0)
      if (interestValue <= 0) continue

      totalInterest += interestValue
      agentInterestTotals.set(agentId, (agentInterestTotals.get(agentId) ?? 0) + interestValue)

      const rawDate = remboursement.date_paiement || remboursement.date_remboursement
      if (!rawDate) continue
      const dateObj = new Date(rawDate)
      if (Number.isNaN(dateObj.getTime())) continue
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
      monthlyInterestMap.set(key, (monthlyInterestMap.get(key) ?? 0) + interestValue)
      if (!monthlyInterestByAgent.has(agentId)) {
        monthlyInterestByAgent.set(agentId, new Map())
      }
      const agentMonthly = monthlyInterestByAgent.get(agentId)!
      agentMonthly.set(key, (agentMonthly.get(key) ?? 0) + interestValue)
    }

    const net = totalInterest - totalExpenses
    const commission = net > 0 ? net * commissionRate : 0
    const netAfterCommission = net - commission

    setSummary({
      interest: totalInterest,
      expenses: totalExpenses,
      net,
      commission,
      netAfterCommission,
    })

    const monthlyKeys = new Set([
      ...monthlyInterestMap.keys(),
      ...monthlyExpensesMap.keys(),
    ])

    const monthlyRowsResult: MonthlyRow[] = Array.from(monthlyKeys)
      .map((key) => {
        const [year, month] = key.split('-').map((value) => Number(value))
        const label = new Date(year, month - 1).toLocaleDateString('fr-FR', {
          month: 'short',
          year: 'numeric',
        })
        const interest = monthlyInterestMap.get(key) ?? 0
        const expenses = monthlyExpensesMap.get(key) ?? 0
        const netValue = interest - expenses
        const commissionValue = netValue > 0 ? netValue * commissionRate : 0
        return {
          key,
          label,
          interest,
          expenses,
          net: netValue,
          commission: commissionValue,
          netAfterCommission: netValue - commissionValue,
        }
      })
      .sort((a, b) => a.key.localeCompare(b.key))

    setMonthlyRows(monthlyRowsResult)

    if (userProfile?.role === 'admin' || userProfile?.role === 'manager') {
      const agentIds = new Set([
        ...agentInterestTotals.keys(),
        ...agentExpensesTotals.keys(),
      ])

      const agentRowsResult: AgentRow[] = Array.from(agentIds).map((agentId) => {
        const interest = agentInterestTotals.get(agentId) ?? 0
        const expenses = agentExpensesTotals.get(agentId) ?? 0
        const netValue = interest - expenses
        const commissionValue = netValue > 0 ? netValue * commissionRate : 0
        return {
          agentId,
          displayName: agentDisplayMap.get(agentId) ?? agentId,
          interest,
          expenses,
          net: netValue,
          commission: commissionValue,
          netAfterCommission: netValue - commissionValue,
        }
      })

      setAgentRows(
        agentRowsResult.sort((a, b) => b.netAfterCommission - a.netAfterCommission),
      )
    } else {
      setAgentRows([])
    }
  }

  const summaryCards = useMemo(() => [
    {
      title: 'Intérêts collectés',
      value: formatCurrency(summary.interest),
      description: `Revenus bruts provenant des remboursements (${baseInterestRateLabel})`,
      icon: ArrowDownRight,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      title: 'Dépenses',
      value: formatCurrency(summary.expenses),
      description: 'Dépenses opérationnelles enregistrées',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Résultat net',
      value: formatCurrency(summary.net),
      description: 'Intérêts moins dépenses',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: `Commission agents (${commissionRateLabel})`,
      value: formatCurrency(summary.commission),
      description: `Part dédiée aux agents de crédit (${commissionRateLabel})`,
      icon: Wallet,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      title: 'Profit après commission',
      value: formatCurrency(summary.netAfterCommission),
      description: 'Résultat net après paiement des commissions',
      icon: PiggyBank,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ], [summary, commissionRateLabel, baseInterestRateLabel])

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

  if (loading && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!userProfile) {
    return null
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Profit &amp; Loss
            </h1>
            <p className="text-muted-foreground mt-2">
              Analyse des revenus, dépenses et commissions pour{' '}
              {userProfile.role === 'agent' ? 'votre portefeuille' : "l'ensemble de l'organisation"}.
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  {realtimeConnected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                  )}
                </span>
                {realtimeConnected ? 'Temps réel actif' : 'Connexion en cours...'}
              </span>
              <span>•</span>
              <span>Mise à jour instantanée des données</span>
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card, index) => {
            const Icon = card.icon
            return (
              <Card key={index} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-foreground">{card.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${card.bgColor}`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {agentRows.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Performance par agent</CardTitle>
              <CardDescription>
                Répartition des intérêts, dépenses et commissions par agent de crédit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Intérêts</TableHead>
                      <TableHead className="text-right">Dépenses</TableHead>
                      <TableHead className="text-right">Résultat net</TableHead>
                      <TableHead className="text-right">Commission {commissionRateLabel}</TableHead>
                      <TableHead className="text-right">Profit net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentRows.map((row) => (
                      <TableRow key={row.agentId}>
                        <TableCell className="font-medium">
                          {row.displayName}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.interest)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.expenses)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.net)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.commission)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {formatCurrency(row.netAfterCommission)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>P&amp;L mensuel</CardTitle>
            <CardDescription>
              Intérêts, dépenses et commissions calculés par mois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyRows.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <AlertTriangle className="w-6 h-6 mb-2 text-amber-500" />
                <p>Aucune donnée disponible pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">Intérêts</TableHead>
                      <TableHead className="text-right">Dépenses</TableHead>
                      <TableHead className="text-right">Résultat net</TableHead>
                      <TableHead className="text-right">Commission {commissionRateLabel}</TableHead>
                      <TableHead className="text-right">Profit net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.interest)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.expenses)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.net)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(row.commission)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {formatCurrency(row.netAfterCommission)}
                        </TableCell>
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

