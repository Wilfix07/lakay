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
  AlertTriangle,
  Wallet,
  PiggyBank,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getInterestRates } from '@/lib/systemSettings'
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
  Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

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
    impayesCount: 0,
    impayesRate: 0,
    impayesPrincipal: 0,
    todayRemboursementsCount: 0,
    todayRemboursementsAmount: 0,
  })
  const [agentCollections, setAgentCollections] = useState<
    { agent_id: string; total_collected: number; displayName: string }[]
  >([])
  const [interestSummary, setInterestSummary] = useState<{
    total: number
    commissionTotal: number
    monthly: {
      key: string
      label: string
      interest: number
      expenses: number
      net: number
      commission: number
    }[]
  }>({ total: 0, commissionTotal: 0, monthly: [] })
  const [expensesSummary, setExpensesSummary] = useState<number>(0)
  const [totalEpargnes, setTotalEpargnes] = useState<number>(0)
  const [commissionRatePercent, setCommissionRatePercent] = useState<number>(30)
  const [baseInterestRatePercent, setBaseInterestRatePercent] = useState<number>(15)
  const commissionRateLabel = `${commissionRatePercent.toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
  })}%`
  const baseInterestRateLabel = `${baseInterestRatePercent.toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
  })}%`
  const agentBarColors = [
    '#2563eb', // blue-600
    '#16a34a', // green-600
    '#f97316', // orange-500
    '#dc2626', // red-600
    '#0ea5e9', // sky-500
    '#9333ea', // purple-600
    '#facc15', // yellow-500
    '#14b8a6', // teal-500
  ]

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
      // Récupérer les IDs des agents du manager si nécessaire
      let managerAgentIds: string[] | null = null
      if (userProfile.role === 'manager') {
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError
        managerAgentIds = managerAgents?.map(a => a.agent_id) || []
        if (managerAgentIds.length === 0) {
          // Si le manager n'a pas encore d'agents, initialiser les stats à zéro
          setStats({
            agents: 0,
            membres: 0,
            prets: 0,
            remboursements: 0,
            remboursementsPayes: 0,
            montantTotal: 0,
            impayesCount: 0,
            impayesRate: 0,
            impayesPrincipal: 0,
            todayRemboursementsCount: 0,
            todayRemboursementsAmount: 0,
          })
          setAgentCollections([])
          setInterestSummary({ total: 0, commissionTotal: 0, monthly: [] })
          setExpensesSummary(0)
          setTotalEpargnes(0)
          return
        }
      }

      // Stats pour Admin et Manager
      if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        // Construire les requêtes avec filtres appropriés
        let agentsQuery = supabase.from('agents').select('agent_id, nom, prenom')
        let membresQuery = supabase.from('membres').select('id', { count: 'exact', head: true })
        let pretsQuery = supabase.from('prets').select('id, pret_id, montant_pret, nombre_remboursements, statut, capital_restant')
        let remboursementsQuery = supabase.from('remboursements').select('id, statut, agent_id, montant, pret_id, date_remboursement, date_paiement, principal, interet')
        let expensesQuery = supabase.from('agent_expenses').select('amount, expense_date')
        let epargnesQuery = supabase.from('epargne_transactions').select('type, montant')

        // Filtrer par manager_id si nécessaire
        if (userProfile.role === 'manager' && managerAgentIds) {
          agentsQuery = agentsQuery.eq('manager_id', userProfile.id)
          membresQuery = membresQuery.in('agent_id', managerAgentIds)
          pretsQuery = pretsQuery.in('agent_id', managerAgentIds)
          remboursementsQuery = remboursementsQuery.in('agent_id', managerAgentIds)
          expensesQuery = expensesQuery.in('agent_id', managerAgentIds)
          epargnesQuery = epargnesQuery.in('agent_id', managerAgentIds)
        }

        const [
          interestRates,
          agentsRes,
          membresRes,
          pretsRes,
          remboursementsRes,
          expensesRes,
          epargnesRes,
        ] = await Promise.all([
          getInterestRates(),
          agentsQuery,
          membresQuery,
          pretsQuery,
          remboursementsQuery,
          expensesQuery,
          epargnesQuery,
        ])

        if (agentsRes.error) throw agentsRes.error
        if (membresRes.error) throw membresRes.error
        if (pretsRes.error) throw pretsRes.error
        if (remboursementsRes.error) throw remboursementsRes.error
        if (expensesRes.error) throw expensesRes.error
        // Ignorer l'erreur si la table epargne_transactions n'existe pas encore
        if (epargnesRes.error && (epargnesRes.error as any).code !== '42P01') {
          console.error('Erreur lors du chargement des épargnes:', epargnesRes.error)
        }

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

        const agentsData = agentsRes.data || []
        const activePrets =
          pretsRes.data?.filter((pret) => pret.statut === 'actif') || []
        const totalActivePrincipal =
          activePrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0) || 0
        const totalRemboursements = remboursementsRes.data?.length || 0
        const remboursementsPayes =
          remboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0

        const pretMapByNumericId = new Map(
          (pretsRes.data || []).map((pret) => [pret.id, pret]),
        )
        const pretMapByCode = new Map(
          (pretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayDateString = today.toISOString().split('T')[0]
        const todayRemboursements = (remboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayRemboursementsCount = todayRemboursements.length
        const todayRemboursementsAmount = todayRemboursements.reduce(
          (sum, remboursement) => sum + Number(remboursement.montant || 0),
          0,
        )

        const getPrincipalValue = (remboursement: {
          principal: number | null
          montant: number | null
          pret_id: number | string | null
        }) => {
          if (remboursement.principal != null) {
            return Number(remboursement.principal)
          }
          const pret =
            pretMapByNumericId.get(remboursement.pret_id as number) ||
            pretMapByCode.get(remboursement.pret_id as string)
          if (pret && pret.nombre_remboursements) {
            const base =
              Number(pret.montant_pret || 0) /
              Number(pret.nombre_remboursements || 1)
            return Math.round(base * 100) / 100
          }
          const fallback =
            Number(remboursement.montant || 0) / 1.15
          return Math.round(fallback * 100) / 100
        }

        const activePretIds = new Set(
          activePrets.map((pret) => pret.pret_id),
        )

        const overdueRemboursements =
          remboursementsRes.data?.filter((r) => {
            if (r.statut === 'paye') return false
            if (r.statut === 'en_retard') return true
            if (r.statut === 'en_attente' && r.date_remboursement) {
              const dueDate = new Date(r.date_remboursement)
              if (Number.isNaN(dueDate.getTime())) return false
              dueDate.setHours(0, 0, 0, 0)
              return dueDate < today
            }
            return false
          }) || []

        const impayesCount = overdueRemboursements.length
        const impayesPrincipal =
          overdueRemboursements.reduce((sum, remboursement) => {
            return sum + getPrincipalValue(remboursement)
          }, 0) || 0
        const principalPayesActifs =
          (remboursementsRes.data || [])
            .filter(
              (remboursement) =>
                remboursement.statut === 'paye' &&
                activePretIds.has(remboursement.pret_id),
            )
            .reduce((sum, remboursement) => {
              return sum + getPrincipalValue(remboursement)
            }, 0) || 0
        const portefeuilleActif = Math.max(totalActivePrincipal - principalPayesActifs, 0)

        const impayesRate =
          totalRemboursements > 0 ? (impayesCount / totalRemboursements) * 100 : 0

        const qualifyingStatuses = new Set(['paye', 'paye_partiel'])

        const collectionMap = (remboursementsRes.data || [])
          .filter((item) => qualifyingStatuses.has(item.statut) && item.agent_id)
          .reduce<Map<string, number>>((acc, item) => {
            const key = item.agent_id!
            const current = acc.get(key) ?? 0
            acc.set(key, current + Number(item.montant || 0))
            return acc
          }, new Map())

        const interestMap = new Map<string, number>()
        let totalInterest = 0
        for (const remboursement of remboursementsRes.data || []) {
          if (!qualifyingStatuses.has(remboursement.statut)) continue
          const principalValue = getPrincipalValue(remboursement)
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
          montantTotal: portefeuilleActif,
          impayesCount,
          impayesRate,
          impayesPrincipal,
          todayRemboursementsCount,
          todayRemboursementsAmount,
        })
        setAgentCollections(
          collections.sort((a, b) => b.total_collected - a.total_collected),
        )
        const expensesTotal =
          expensesRes.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
        setExpensesSummary(expensesTotal)

        // Calculer le total des épargnes (dépôts - retraits)
        const epargnesTotal = (epargnesRes.data || []).reduce((sum, transaction) => {
          const montant = Number(transaction.montant || 0)
          return sum + (transaction.type === 'depot' ? montant : -montant)
        }, 0)
        setTotalEpargnes(epargnesTotal)

        const monthlyExpensesMap = new Map<string, number>()
        for (const expense of expensesRes.data || []) {
          if (!expense.expense_date) continue
          const expenseDate = new Date(expense.expense_date)
          if (Number.isNaN(expenseDate.getTime())) continue
          const key = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`
          monthlyExpensesMap.set(key, (monthlyExpensesMap.get(key) ?? 0) + Number(expense.amount || 0))
        }
        const monthlyKeys = new Set([
          ...interestMap.keys(),
          ...monthlyExpensesMap.keys(),
        ])
        const monthly = Array.from(monthlyKeys)
          .map((key) => {
            const [year, month] = key.split('-').map((value) => Number(value))
            const label = new Date(year, month - 1).toLocaleDateString('fr-FR', {
              month: 'short',
              year: 'numeric',
            })
            const interest = interestMap.get(key) ?? 0
            const expenses = monthlyExpensesMap.get(key) ?? 0
            const net = interest - expenses
            const commission = net > 0 ? net * commissionRate : 0
            return { key, label, interest, expenses, net, commission }
          })
          .sort((a, b) => a.key.localeCompare(b.key))
        const commissionTotal =
          monthly.reduce((sum, entry) => sum + entry.commission, 0) || 0
        setInterestSummary({
          total: totalInterest,
          commissionTotal,
          monthly,
        })
      } 
      // Stats pour Agent (seulement ses données)
      else if (userProfile.role === 'agent' && userProfile.agent_id) {
        const [interestRates, membresRes, pretsRes, remboursementsRes, expensesRes, epargnesRes] = await Promise.all([
          getInterestRates(),
          supabase.from('membres').select('id', { count: 'exact', head: true }).eq('agent_id', userProfile.agent_id),
          supabase.from('prets').select('id, pret_id, montant_pret, nombre_remboursements, statut, capital_restant').eq('agent_id', userProfile.agent_id),
          supabase.from('remboursements').select('id, statut, agent_id, montant, pret_id, date_remboursement, date_paiement, principal, interet').eq('agent_id', userProfile.agent_id),
          supabase.from('agent_expenses').select('amount, expense_date').eq('agent_id', userProfile.agent_id),
          supabase.from('epargne_transactions').select('type, montant').eq('agent_id', userProfile.agent_id),
        ])

        if (membresRes.error) throw membresRes.error
        if (pretsRes.error) throw pretsRes.error
        if (remboursementsRes.error) throw remboursementsRes.error
        if (expensesRes.error) throw expensesRes.error
        // Ignorer l'erreur si la table epargne_transactions n'existe pas encore
        if (epargnesRes.error && (epargnesRes.error as any).code !== '42P01') {
          console.error('Erreur lors du chargement des épargnes:', epargnesRes.error)
        }

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

        const activePrets =
          pretsRes.data?.filter((pret) => pret.statut === 'actif') || []
        const totalActivePrincipal =
          activePrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0) || 0
        const totalRemboursements = remboursementsRes.data?.length || 0
        const remboursementsPayes =
          remboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0
        const pretMapById = new Map(
          (pretsRes.data || []).map((pret) => [pret.id, pret]),
        )
        const pretMapByCode = new Map(
          (pretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayDateString = today.toISOString().split('T')[0]
        const todayRemboursements = (remboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayRemboursementsCount = todayRemboursements.length
        const todayRemboursementsAmount = todayRemboursements.reduce(
          (sum, remboursement) => sum + Number(remboursement.montant || 0),
          0,
        )

        const getPrincipalValue = (remboursement: {
          principal: number | null
          montant: number | null
          pret_id: number | string | null
        }) => {
          if (remboursement.principal != null) {
            return Number(remboursement.principal)
          }
          const pret =
            pretMapById.get(remboursement.pret_id as number) ||
            pretMapByCode.get(remboursement.pret_id as string)
          if (pret && pret.nombre_remboursements) {
            const base =
              Number(pret.montant_pret || 0) /
              Number(pret.nombre_remboursements || 1)
            return Math.round(base * 100) / 100
          }
          const fallback =
            Number(remboursement.montant || 0) / 1.15
          return Math.round(fallback * 100) / 100
        }

        const activePretIds = new Set(activePrets.map((pret) => pret.pret_id))

        const overdueRemboursements =
          remboursementsRes.data?.filter((r) => {
            if (r.statut === 'paye') return false
            if (r.statut === 'en_retard') return true
            if (r.statut === 'en_attente' && r.date_remboursement) {
              const dueDate = new Date(r.date_remboursement)
              if (Number.isNaN(dueDate.getTime())) return false
              dueDate.setHours(0, 0, 0, 0)
              return dueDate < today
            }
            return false
          }) || []

        const impayesCount = overdueRemboursements.length
        const impayesPrincipal =
          overdueRemboursements.reduce((sum, remboursement) => {
            return sum + getPrincipalValue(remboursement)
          }, 0) || 0
        const principalPayesActifs =
          (remboursementsRes.data || [])
            .filter(
              (remboursement) =>
                remboursement.statut === 'paye' &&
                activePretIds.has(remboursement.pret_id),
            )
            .reduce((sum, remboursement) => {
              return sum + getPrincipalValue(remboursement)
            }, 0) || 0
        const portefeuilleActif = Math.max(totalActivePrincipal - principalPayesActifs, 0)

        const impayesRate =
          totalRemboursements > 0 ? (impayesCount / totalRemboursements) * 100 : 0

        setStats({
          agents: 0,
          membres: membresRes.count || 0,
          prets: pretsRes.data?.length || 0,
          remboursements: remboursementsRes.data?.length || 0,
          remboursementsPayes,
          montantTotal: portefeuilleActif,
          impayesCount,
          impayesRate,
          impayesPrincipal,
          todayRemboursementsCount,
          todayRemboursementsAmount,
        })
        const qualifyingStatuses = new Set(['paye', 'paye_partiel'])

        const totalCollected =
          remboursementsRes.data
            ?.filter((item) => qualifyingStatuses.has(item.statut))
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

        // Calculer le total des épargnes (dépôts - retraits)
        const epargnesTotal = (epargnesRes.data || []).reduce((sum, transaction) => {
          const montant = Number(transaction.montant || 0)
          return sum + (transaction.type === 'depot' ? montant : -montant)
        }, 0)
        setTotalEpargnes(epargnesTotal)

        const interestMap = new Map<string, number>()
        let totalInterest = 0
        for (const remboursement of remboursementsRes.data || []) {
          if (!qualifyingStatuses.has(remboursement.statut)) continue
          const principalValue = getPrincipalValue(remboursement)
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
        const monthlyExpensesMap = new Map<string, number>()
        for (const expense of expensesRes.data || []) {
          if (!expense.expense_date) continue
          const expenseDate = new Date(expense.expense_date)
          if (Number.isNaN(expenseDate.getTime())) continue
          const key = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`
          monthlyExpensesMap.set(key, (monthlyExpensesMap.get(key) ?? 0) + Number(expense.amount || 0))
        }
        const monthlyKeys = new Set([
          ...interestMap.keys(),
          ...monthlyExpensesMap.keys(),
        ])
        const monthly = Array.from(monthlyKeys)
          .map((key) => {
            const [year, month] = key.split('-').map((value) => Number(value))
            const label = new Date(year, month - 1).toLocaleDateString('fr-FR', {
              month: 'short',
              year: 'numeric',
            })
            const interest = interestMap.get(key) ?? 0
            const expenses = monthlyExpensesMap.get(key) ?? 0
            const net = interest - expenses
            const commission = net > 0 ? net * commissionRate : 0
            return { key, label, interest, expenses, net, commission }
          })
          .sort((a, b) => a.key.localeCompare(b.key))
        const commissionTotal =
          monthly.reduce((sum, entry) => sum + entry.commission, 0) || 0
        setInterestSummary({
          total: totalInterest,
          commissionTotal,
          monthly,
        })
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      // Forcer le rechargement complet de la page pour nettoyer l'état
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      // Forcer la redirection même en cas d'erreur
      window.location.href = '/login'
    }
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
          gradient: 'bg-gradient-to-r from-sky-500 to-blue-700',
          href: '/agents',
        }]
      : []),
    {
      title: 'Membres',
      value: stats.membres,
      icon: Users,
      description: 'Total membres',
      gradient: 'bg-gradient-to-r from-fuchsia-500 to-purple-700',
      href: '/membres',
    },
    {
      title: 'Prêts',
      value: stats.prets,
      icon: CreditCard,
      description: 'Prêts actifs',
      gradient: 'bg-gradient-to-r from-emerald-500 to-green-600',
      href: '/prets',
    },
    {
      title: 'Remboursements',
      value: stats.todayRemboursementsCount,
      icon: DollarSign,
      description: `Montant du jour: ${formatCurrency(stats.todayRemboursementsAmount)}`,
      gradient: 'bg-gradient-to-r from-orange-500 to-red-500',
      href: '/remboursements/aujourdhui',
      badgeContent: null,
    },
    {
      title: "Taux d'impayés",
      value: `${stats.impayesRate.toFixed(1)}%`,
      icon: AlertTriangle,
      description: `Principal impayé: ${formatCurrency(stats.impayesPrincipal)}`,
      gradient: 'bg-gradient-to-r from-rose-500 to-pink-600',
      href: '/impayes',
      badgeContent:
        stats.impayesCount > 0
          ? `${stats.impayesCount} impayé${stats.impayesCount > 1 ? 's' : ''}`
          : null,
    },
    {
      title: 'Portefeuille actif',
      value: formatCurrency(stats.montantTotal),
      icon: TrendingUp,
      description: 'Principal restant sur prêts actifs',
      gradient: 'bg-gradient-to-r from-cyan-500 to-teal-600',
      href: '/prets',
    },
    {
      title: 'Intérêt brut',
      value: formatCurrency(interestSummary.total),
      icon: ArrowDownRight,
      description: `Intérêt (${baseInterestRateLabel}) collecté`,
      gradient: 'bg-gradient-to-r from-violet-500 to-indigo-700',
      href: '/pnl',
    },
    {
      title: `Commission agents (${commissionRateLabel})`,
      value: formatCurrency(interestSummary.commissionTotal),
      icon: Wallet,
      description: `${commissionRateLabel} des intérêts nets mensuels`,
      gradient: 'bg-gradient-to-r from-teal-500 to-emerald-600',
      href: '/pnl',
    },
    {
      title: 'Total dépenses',
      value: formatCurrency(expensesSummary),
      icon: ArrowUpRight,
      description: 'Dépenses opérationnelles',
      gradient: 'bg-gradient-to-r from-slate-600 to-gray-900',
      href: '/expenses',
    },
    {
      title: 'Total épargnes',
      value: formatCurrency(totalEpargnes),
      icon: PiggyBank,
      description: 'Solde total des épargnes (dépôts - retraits)',
      gradient: 'bg-gradient-to-r from-emerald-500 to-teal-600',
      href: '/epargne',
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
            gradient: 'bg-gradient-to-r from-purple-500 to-fuchsia-600',
          },
          {
            title: 'Gérer les Agents',
            description: 'Créer et modifier les agents',
            href: '/agents',
            icon: UserPlus,
            gradient: 'bg-gradient-to-r from-sky-500 to-blue-600',
          },
          ...(userProfile.role === 'manager'
            ? [
                {
                  title: 'Suivi des dépenses',
                  description: 'Analyser les dépenses des agents',
                  href: '/expenses',
                  icon: ArrowDownRight,
                  gradient: 'bg-gradient-to-r from-rose-500 to-orange-500',
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
            gradient: 'bg-gradient-to-r from-emerald-500 to-teal-600',
          },
          {
            title: 'Gérer les Prêts',
            description: 'Créer et décaisser les prêts',
            href: '/prets',
            icon: CreditCard,
            gradient: 'bg-gradient-to-r from-indigo-500 to-violet-600',
          },
          {
            title: 'Remboursements',
            description: 'Enregistrer les paiements',
            href: '/remboursements',
            icon: DollarSign,
            gradient: 'bg-gradient-to-r from-amber-500 to-orange-600',
          },
          ...(userProfile.role === 'agent'
            ? [
                {
                  title: 'Suivi des dépenses',
                  description: 'Enregistrer et suivre vos dépenses',
                  href: '/expenses',
                  icon: ArrowDownRight,
                  gradient: 'bg-gradient-to-r from-pink-500 to-red-500',
                },
              ]
            : []),
        ]
      : []),
    // Épargnes: accessible depuis le dashboard pour tous les rôles
    {
      title: 'Épargnes',
      description: 'Gérer dépôts et retraits des membres',
      href: '/epargne',
      icon: Wallet,
      gradient: 'bg-gradient-to-r from-teal-500 to-green-600',
    },
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
          const cardContent = (
            <Card
              className={`border-0 shadow-sm overflow-hidden text-white ${stat.gradient} ${stat.href ? 'transition-transform hover:-translate-y-1 hover:shadow-lg cursor-pointer' : ''}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/90">
                  {stat.title}
                </CardTitle>
                <div className="p-2 rounded-lg bg-white/20">
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-1">
                  {stat.value}
                </div>
                <p className="text-xs text-white/80 flex items-center gap-2">
                  {stat.description}
                </p>
                {stat.badgeContent ? (
                  <Badge className="mt-3 bg-white/25 text-white border border-white/40 font-medium">
                    {stat.badgeContent}
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          )
          if (stat.href) {
            return (
              <Link key={index} href={stat.href}>
                {cardContent}
              </Link>
            )
          }
          return (
            <div key={index}>
              {cardContent}
            </div>
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
                <Card className={`border-0 shadow-sm text-white overflow-hidden ${action.gradient} transition-transform hover:-translate-y-1 hover:shadow-lg`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-lg bg-white/20">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-white/70" />
                    </div>
                    <CardTitle className="text-base font-semibold mt-4 text-white">
                      {action.title}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1 text-white/80">
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
                    <Bar dataKey="total_collected" radius={[6, 6, 0, 0]}>
                      {agentCollections.map((entry, index) => (
                        <Cell
                          key={`agent-bar-${entry.agent_id}`}
                          fill={agentBarColors[index % agentBarColors.length]}
                        />
                      ))}
                    </Bar>
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
              <CardTitle>Intérêt perçu ({baseInterestRateLabel})</CardTitle>
              <CardDescription>
                Total des intérêts collectés sur les remboursements payés
              </CardDescription>
            </div>
            {loading ? (
              <Skeleton className="w-48 h-7 rounded-md" />
            ) : interestSummary.total > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-rose-50 text-rose-600">
                  Total: {formatCurrency(interestSummary.total)}
                </Badge>
                <Badge variant="secondary" className="bg-teal-50 text-teal-600">
                Commission ({commissionRateLabel}): {formatCurrency(interestSummary.commissionTotal)}
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Skeleton className="w-full h-64" />
              </div>
            ) : interestSummary.monthly.length > 0 ? (
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
