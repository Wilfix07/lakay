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
  RefreshCcw,
  CalendarDays,
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
  const [refreshing, setRefreshing] = useState(false)
  const [previousPortefeuilleActif, setPreviousPortefeuilleActif] = useState<number>(0)
  const [portefeuilleActifChanged, setPortefeuilleActifChanged] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [previousStats, setPreviousStats] = useState<typeof stats | null>(null)
  const [changedCards, setChangedCards] = useState<Set<string>>(new Set())
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
    if (!userProfile) return

    // Charger les stats initiales
    loadStats()

    // Configurer les subscriptions Supabase Realtime pour rendre le dashboard totalement dynamique
    const subscriptions: Array<{ channel: any; unsubscribe: () => void }> = []

    // Construire les filtres selon le rôle
    let pretsFilter = ''
    let remboursementsFilter = ''
    let membresFilter = ''
    let expensesFilter = ''
    let epargnesFilter = ''

    if (userProfile.role === 'agent' && userProfile.agent_id) {
      pretsFilter = `agent_id=eq.${userProfile.agent_id}`
      remboursementsFilter = `agent_id=eq.${userProfile.agent_id}`
      membresFilter = `agent_id=eq.${userProfile.agent_id}`
      expensesFilter = `agent_id=eq.${userProfile.agent_id}`
      epargnesFilter = `agent_id=eq.${userProfile.agent_id}`
    } else if (userProfile.role === 'manager') {
      // Pour les managers, on écoute tous les changements mais on filtre côté client
      // Les politiques RLS s'occupent déjà du filtrage
    } else if (userProfile.role === 'chef_zone') {
      // Pour les chefs de zone, on écoute tous les changements mais on filtre côté client dans loadStats
      // car nous devons filtrer par membre_id (via chef_zone_membres), pas par agent_id
      // Les filtres Realtime ne peuvent pas filtrer directement par membre_id de manière dynamique
    }

    // Subscription pour les prêts
    const pretsChannel = supabase
      .channel('dashboard-prets')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'prets',
          filter: pretsFilter || undefined,
        },
        (payload) => {
          console.log('📊 Changement détecté dans prets:', payload.eventType)
          // Mettre à jour immédiatement sans afficher le spinner de rafraîchissement
          loadStats(false)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
          console.log('✅ Subscription prets active')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erreur de subscription prets')
          setRealtimeConnected(false)
        }
      })

    subscriptions.push({ channel: pretsChannel, unsubscribe: () => pretsChannel.unsubscribe() })

    // Subscription pour les remboursements
    const remboursementsChannel = supabase
      .channel('dashboard-remboursements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remboursements',
          filter: remboursementsFilter || undefined,
        },
        (payload) => {
          console.log('💰 Changement détecté dans remboursements:', payload.eventType)
          // Mettre à jour immédiatement sans afficher le spinner de rafraîchissement
          loadStats(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: remboursementsChannel,
      unsubscribe: () => remboursementsChannel.unsubscribe(),
    })

    // Subscription pour les remboursements de groupe
    const groupRemboursementsChannel = supabase
      .channel('dashboard-group-remboursements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_remboursements',
          filter: remboursementsFilter || undefined,
        },
        (payload) => {
          console.log('💰 Changement détecté dans group_remboursements:', payload.eventType)
          loadStats(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: groupRemboursementsChannel,
      unsubscribe: () => groupRemboursementsChannel.unsubscribe(),
    })

    // Subscription pour les prêts de groupe
    const groupPretsChannel = supabase
      .channel('dashboard-group-prets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_prets',
          filter: pretsFilter || undefined,
        },
        (payload) => {
          console.log('📊 Changement détecté dans group_prets:', payload.eventType)
          loadStats(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: groupPretsChannel,
      unsubscribe: () => groupPretsChannel.unsubscribe(),
    })

    // Subscription pour les membres
    const membresChannel = supabase
      .channel('dashboard-membres')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'membres',
          filter: membresFilter || undefined,
        },
        (payload) => {
          console.log('👥 Changement détecté dans membres:', payload.eventType)
          // Mettre à jour immédiatement sans afficher le spinner de rafraîchissement
          loadStats(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: membresChannel,
      unsubscribe: () => membresChannel.unsubscribe(),
    })

    // Subscription pour les dépenses
    const expensesChannel = supabase
      .channel('dashboard-expenses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_expenses',
          filter: expensesFilter || undefined,
        },
        (payload) => {
          console.log('💸 Changement détecté dans agent_expenses:', payload.eventType)
          // Mettre à jour immédiatement sans afficher le spinner de rafraîchissement
          loadStats(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: expensesChannel,
      unsubscribe: () => expensesChannel.unsubscribe(),
    })

    // Subscription pour les épargnes
    const epargnesChannel = supabase
      .channel('dashboard-epargnes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'epargne_transactions',
          filter: epargnesFilter || undefined,
        },
        (payload) => {
          console.log('🏦 Changement détecté dans epargne_transactions:', payload.eventType)
          // Mettre à jour immédiatement sans afficher le spinner de rafraîchissement
          loadStats(false)
        }
      )
      .subscribe()

    subscriptions.push({
      channel: epargnesChannel,
      unsubscribe: () => epargnesChannel.unsubscribe(),
    })

    // Subscription pour les agents (pour les admins et managers)
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      const agentsChannel = supabase
        .channel('dashboard-agents')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'agents',
          },
          (payload) => {
            console.log('👤 Changement détecté dans agents:', payload.eventType)
            // Mettre à jour immédiatement sans afficher le spinner de rafraîchissement
            loadStats(false)
          }
        )
        .subscribe()

      subscriptions.push({
        channel: agentsChannel,
        unsubscribe: () => agentsChannel.unsubscribe(),
      })
    }

    // Rafraîchissement périodique de secours (toutes les 60 secondes) au cas où les subscriptions échouent
    // Note: Ceci est un backup. Les subscriptions Realtime devraient mettre à jour en temps réel
    const intervalId = setInterval(() => {
      if (!realtimeConnected) {
        // Si Realtime n'est pas connecté, rafraîchir plus souvent
        loadStats(false)
      }
    }, 60000) // 60 secondes comme backup

    // Nettoyer les subscriptions et l'intervalle lors du démontage
    return () => {
      console.log('🧹 Nettoyage des subscriptions du dashboard')
      subscriptions.forEach((sub) => sub.unsubscribe())
      clearInterval(intervalId)
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

  async function loadStats(showRefreshing = false) {
    if (!userProfile) return

    try {
      if (showRefreshing) {
        setRefreshing(true)
      }
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
        let groupPretsQuery = supabase.from('group_prets').select('id, pret_id, montant_pret, nombre_remboursements, statut, capital_restant, agent_id')
        let groupRemboursementsQuery = supabase.from('group_remboursements').select('id, statut, agent_id, montant, pret_id, date_remboursement, date_paiement, principal, interet')
        let expensesQuery = supabase.from('agent_expenses').select('amount, expense_date')
        let epargnesQuery = supabase.from('epargne_transactions').select('type, montant')

        // Filtrer par manager_id si nécessaire
        if (userProfile.role === 'manager' && managerAgentIds) {
          agentsQuery = agentsQuery.eq('manager_id', userProfile.id)
          membresQuery = membresQuery.in('agent_id', managerAgentIds)
          pretsQuery = pretsQuery.in('agent_id', managerAgentIds)
          remboursementsQuery = remboursementsQuery.in('agent_id', managerAgentIds)
          groupPretsQuery = groupPretsQuery.in('agent_id', managerAgentIds)
          groupRemboursementsQuery = groupRemboursementsQuery.in('agent_id', managerAgentIds)
          expensesQuery = expensesQuery.in('agent_id', managerAgentIds)
          epargnesQuery = epargnesQuery.in('agent_id', managerAgentIds)
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

        const [
          interestRates,
          agentsRes,
          membresRes,
          pretsRes,
          remboursementsRes,
          groupPretsRes,
          groupRemboursementsRes,
          expensesRes,
          epargnesRes,
        ] = await Promise.all([
          getInterestRates(),
          agentsQuery,
          membresQuery,
          pretsQuery,
          remboursementsQuery,
          safeQuery(groupPretsQuery), // Ignorer si la table n'existe pas
          safeQuery(groupRemboursementsQuery), // Ignorer si la table n'existe pas
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
        const activeGroupPrets =
          (groupPretsRes.data || []).filter((pret) => pret.statut === 'actif') || []
        const totalActivePrincipal =
          activePrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0) +
          activeGroupPrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0)
        const totalRemboursements = (remboursementsRes.data?.length || 0) + (groupRemboursementsRes.data?.length || 0)
        const remboursementsPayes =
          (remboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0) +
          (groupRemboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0)

        const pretMapByNumericId = new Map(
          (pretsRes.data || []).map((pret) => [pret.id, pret]),
        )
        const pretMapByCode = new Map(
          (pretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )
        const groupPretMapByCode = new Map(
          (groupPretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayDateString = today.toISOString().split('T')[0]
        const todayRemboursements = (remboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayGroupRemboursements = (groupRemboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayRemboursementsCount = todayRemboursements.length + todayGroupRemboursements.length
        const todayRemboursementsAmount = todayRemboursements.reduce(
          (sum, remboursement) => sum + Number(remboursement.montant || 0),
          0,
        ) + todayGroupRemboursements.reduce(
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
            pretMapByCode.get(remboursement.pret_id as string) ||
            groupPretMapByCode.get(remboursement.pret_id as string)
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

        const activePretIds = new Set([
          ...activePrets.map((pret) => pret.pret_id),
          ...activeGroupPrets.map((pret) => pret.pret_id),
        ])

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

        const overdueGroupRemboursements =
          groupRemboursementsRes.data?.filter((r) => {
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

        const impayesCount = overdueRemboursements.length + overdueGroupRemboursements.length
        const impayesPrincipal =
          overdueRemboursements.reduce((sum, remboursement) => {
            return sum + getPrincipalValue(remboursement)
          }, 0) +
          overdueGroupRemboursements.reduce((sum, remboursement) => {
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
            }, 0) +
          (groupRemboursementsRes.data || [])
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

        // Ajouter les remboursements de groupe à la collection
        for (const remboursement of groupRemboursementsRes.data || []) {
          if (qualifyingStatuses.has(remboursement.statut) && remboursement.agent_id) {
            const key = remboursement.agent_id
            const current = collectionMap.get(key) ?? 0
            collectionMap.set(key, current + Number(remboursement.montant || 0))
          }
        }

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
        
        // Ajouter les intérêts des remboursements de groupe
        for (const remboursement of groupRemboursementsRes.data || []) {
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

        // Détecter les changements pour toutes les cartes
        const newStats = {
          agents: agentsData.length || 0,
          membres: membresRes.count || 0,
          prets: (pretsRes.data?.length || 0) + (groupPretsRes.data?.length || 0),
          remboursements: totalRemboursements,
          remboursementsPayes,
          montantTotal: portefeuilleActif,
          impayesCount,
          impayesRate,
          impayesPrincipal,
          todayRemboursementsCount,
          todayRemboursementsAmount,
        }

        // Détecter quelles cartes ont changé
        const changed = new Set<string>()
        if (previousStats) {
          if (previousStats.agents !== newStats.agents) changed.add('agents')
          if (previousStats.membres !== newStats.membres) changed.add('membres')
          if (previousStats.prets !== newStats.prets) changed.add('prets')
          if (previousStats.remboursements !== newStats.remboursements) changed.add('remboursements')
          if (previousStats.impayesCount !== newStats.impayesCount || previousStats.impayesRate !== newStats.impayesRate) changed.add('impayes')
          if (previousPortefeuilleActif !== portefeuilleActif) {
            changed.add('portefeuille')
            setPortefeuilleActifChanged(true)
            setTimeout(() => setPortefeuilleActifChanged(false), 2000)
          }
          if (previousStats.todayRemboursementsCount !== newStats.todayRemboursementsCount) changed.add('remboursements-jour')
        }
        setChangedCards(changed)
        setTimeout(() => setChangedCards(new Set()), 2000) // Réinitialiser après 2 secondes
        
        setPreviousPortefeuilleActif(portefeuilleActif)
        setPreviousStats(newStats)
        setStats(newStats)
        setAgentCollections(
          collections.sort((a, b) => b.total_collected - a.total_collected),
        )
        const expensesTotal =
          expensesRes.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
        
        // Calculer le total des épargnes (dépôts - retraits)
        const epargnesTotal = (epargnesRes.data || []).reduce((sum, transaction) => {
          const montant = Number(transaction.montant || 0)
          return sum + (transaction.type === 'depot' ? montant : -montant)
        }, 0)
        
        // Détecter les changements dans les intérêts, dépenses et épargnes
        const previousInterestTotal = interestSummary.total
        const previousExpensesTotal = expensesSummary
        const previousEpargnesTotal = totalEpargnes
        
        if (previousStats && previousInterestTotal !== totalInterest) changed.add('interet')
        if (previousStats && previousExpensesTotal !== expensesTotal) changed.add('depenses')
        if (previousStats && previousEpargnesTotal !== epargnesTotal) changed.add('epargnes')
        
        setExpensesSummary(expensesTotal)
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
      // Stats pour Chef de Zone (seulement ses membres assignés)
      else if (userProfile.role === 'chef_zone') {
        // Charger les membres assignés
        const { data: assignations, error: assignationsError } = await supabase
          .from('chef_zone_membres')
          .select('membre_id')
          .eq('chef_zone_id', userProfile.id)

        if (assignationsError) throw assignationsError

        const membreIds = assignations?.map(a => a.membre_id) || []
        
        if (membreIds.length === 0) {
          // Aucun membre assigné
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

        // Charger les groupes qui contiennent les membres assignés
        const { data: groupMembersData, error: groupMembersError } = await supabase
          .from('membre_group_members')
          .select('group_id')
          .in('membre_id', membreIds)

        if (groupMembersError) throw groupMembersError

        const groupIds = [...new Set((groupMembersData || []).map(gm => gm.group_id))]

        // Charger les données pour les membres assignés
        // Charger seulement les prêts actifs (pas les terminés, annulés, etc.)
        const { data: pretsData, error: pretsError } = await supabase
          .from('prets')
          .select('id, pret_id, montant_pret, nombre_remboursements, statut, capital_restant, membre_id')
          .in('membre_id', membreIds)
          .eq('statut', 'actif') // Seulement les prêts actifs

        if (pretsError) throw pretsError

        // Charger seulement les prêts de groupe actifs pour les groupes contenant les membres assignés
        let groupPretsData: any[] = []
        let groupPretIds: string[] = []
        if (groupIds.length > 0) {
          const { data: groupPretsDataRes, error: groupPretsError } = await supabase
            .from('group_prets')
            .select('id, pret_id, montant_pret, nombre_remboursements, statut, capital_restant, group_id')
            .in('group_id', groupIds)
            .eq('statut', 'actif') // Seulement les prêts actifs

          if (groupPretsError && groupPretsError.code !== '42P01' && groupPretsError.code !== 'PGRST116') {
            throw groupPretsError
          }
          groupPretsData = groupPretsDataRes || []
          groupPretIds = groupPretsData.map(gp => gp.pret_id)
        }

        const pretIds = (pretsData || []).map(p => p.pret_id)

        // Charger les remboursements individuels et de groupe (seulement ceux en attente, en retard, ou payés)
        // Ne pas charger les remboursements terminés/annulés pour les prêts inactifs
        const [membresRes, remboursementsRes, groupRemboursementsRes, epargnesRes, collateralsRes] = await Promise.all([
          supabase.from('membres').select('id', { count: 'exact', head: true }).in('membre_id', membreIds),
          pretIds.length > 0 
            ? supabase.from('remboursements')
                .select('id, statut, montant, pret_id, date_remboursement, date_paiement, principal, interet')
                .in('pret_id', pretIds)
                .in('statut', ['en_attente', 'en_retard', 'paye', 'paye_partiel']) // Exclure les statuts inactifs
            : Promise.resolve({ data: [], error: null }),
          groupPretIds.length > 0
            ? supabase.from('group_remboursements')
                .select('id, statut, montant, pret_id, date_remboursement, date_paiement, principal, interet, membre_id')
                .in('pret_id', groupPretIds)
                .in('membre_id', membreIds)
                .in('statut', ['en_attente', 'en_retard', 'paye', 'paye_partiel']) // Exclure les statuts inactifs
            : Promise.resolve({ data: [], error: null }),
          supabase.from('epargne_transactions').select('type, montant').in('membre_id', membreIds),
          supabase.from('collaterals').select('montant').in('membre_id', membreIds),
        ])

        const pretsRes = { data: pretsData, error: pretsError }
        const groupPretsRes = { data: groupPretsData, error: null }

        if (membresRes.error) throw membresRes.error
        if (pretsRes.error) throw pretsRes.error
        if (remboursementsRes.error) throw remboursementsRes.error
        // Ignorer les erreurs pour group_remboursements si la table n'existe pas
        if (groupRemboursementsRes.error && groupRemboursementsRes.error.code !== '42P01' && groupRemboursementsRes.error.code !== 'PGRST116') {
          console.error('Erreur lors du chargement des remboursements de groupe:', groupRemboursementsRes.error)
        }

        // Les prêts sont déjà filtrés pour être actifs uniquement
        const activePrets = pretsRes.data || []
        const activeGroupPrets = groupPretsRes.data || []
        const totalActivePrincipal = 
          activePrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0) +
          activeGroupPrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0)
        const totalRemboursements = (remboursementsRes.data?.length || 0) + (groupRemboursementsRes.data?.length || 0)
        const remboursementsPayes = 
          (remboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0) +
          (groupRemboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0)

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayDateString = today.toISOString().split('T')[0]
        const todayRemboursements = (remboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayGroupRemboursements = (groupRemboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayRemboursementsCount = todayRemboursements.length + todayGroupRemboursements.length
        const todayRemboursementsAmount = 
          todayRemboursements.reduce((sum, remboursement) => sum + Number(remboursement.montant || 0), 0) +
          todayGroupRemboursements.reduce((sum, remboursement) => sum + Number(remboursement.montant || 0), 0)

        const pretMapByCode = new Map(
          (pretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )
        const groupPretMapByCode = new Map(
          (groupPretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )

        const getPrincipalValue = (remboursement: {
          principal: number | null
          montant: number | null
          pret_id: number | string | null
        }) => {
          if (remboursement.principal != null) {
            return Number(remboursement.principal)
          }
          // Essayer d'abord les prêts individuels, puis les prêts de groupe
          const pret = pretMapByCode.get(remboursement.pret_id as string) || 
                      groupPretMapByCode.get(remboursement.pret_id as string)
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

        const activePretIds = new Set([
          ...activePrets.map((pret) => pret.pret_id),
          ...activeGroupPrets.map((pret) => pret.pret_id),
        ])

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

        const overdueGroupRemboursements =
          groupRemboursementsRes.data?.filter((r) => {
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

        const impayesCount = overdueRemboursements.length + overdueGroupRemboursements.length
        const impayesPrincipal =
          overdueRemboursements.reduce((sum, remboursement) => {
            return sum + getPrincipalValue(remboursement)
          }, 0) +
          overdueGroupRemboursements.reduce((sum, remboursement) => {
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
            }, 0) +
          (groupRemboursementsRes.data || [])
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

        // Détecter les changements pour toutes les cartes (section Chef de Zone)
        const newStatsChefZone = {
          agents: 0,
          membres: membresRes.count || 0,
          prets: (pretsRes.data?.length || 0) + (groupPretsRes.data?.length || 0),
          remboursements: totalRemboursements,
          remboursementsPayes,
          montantTotal: portefeuilleActif,
          impayesCount,
          impayesRate,
          impayesPrincipal,
          todayRemboursementsCount,
          todayRemboursementsAmount,
        }

        const changedChefZone = new Set<string>()
        if (previousStats) {
          if (previousStats.membres !== newStatsChefZone.membres) changedChefZone.add('membres')
          if (previousStats.prets !== newStatsChefZone.prets) changedChefZone.add('prets')
          if (previousStats.remboursements !== newStatsChefZone.remboursements) changedChefZone.add('remboursements')
          if (previousStats.impayesCount !== newStatsChefZone.impayesCount || previousStats.impayesRate !== newStatsChefZone.impayesRate) changedChefZone.add('impayes')
          if (previousPortefeuilleActif !== portefeuilleActif) {
            changedChefZone.add('portefeuille')
            setPortefeuilleActifChanged(true)
            setTimeout(() => setPortefeuilleActifChanged(false), 2000)
          }
          if (previousStats.todayRemboursementsCount !== newStatsChefZone.todayRemboursementsCount) changedChefZone.add('remboursements-jour')
        }
        setChangedCards(changedChefZone)
        setTimeout(() => setChangedCards(new Set()), 2000)
        
        setPreviousPortefeuilleActif(portefeuilleActif)
        setPreviousStats(newStatsChefZone)
        setStats(newStatsChefZone)
        setAgentCollections([]) // Les chefs de zone ne gèrent pas d'agents

        // Calculer le total des épargnes
        const epargnesTotal = (epargnesRes.data || []).reduce((sum, transaction) => {
          const montant = Number(transaction.montant || 0)
          return sum + (transaction.type === 'depot' ? montant : -montant)
        }, 0)
        setTotalEpargnes(epargnesTotal)

        // Calculer le total des garanties
        const garantiesTotal = (collateralsRes.data || []).reduce((sum, c) => sum + Number(c.montant || 0), 0)
        
        // Initialiser les valeurs manquantes pour chef_zone
        setInterestSummary({ total: 0, commissionTotal: 0, monthly: [] })
        setExpensesSummary(0)
      } 
      // Stats pour Agent (seulement ses données)
      else if (userProfile.role === 'agent' && userProfile.agent_id) {
        // Helper function pour gérer les erreurs de tables optionnelles
        const safeQuery = async (query: any) => {
          try {
            const result = await query
            if (result.error) {
              const errorCode = (result.error as any)?.code
              const errorStatus = (result.error as any)?.status
              if (errorCode === '42P01' || errorCode === 'PGRST116' || errorStatus === 404) {
                return { data: [], error: null }
              }
            }
            return result
          } catch (error: any) {
            if (error?.code === '42P01' || error?.code === 'PGRST116' || error?.status === 404) {
              return { data: [], error: null }
            }
            throw error
          }
        }

        const [interestRates, membresRes, pretsRes, remboursementsRes, groupPretsRes, groupRemboursementsRes, expensesRes, epargnesRes] = await Promise.all([
          getInterestRates(),
          supabase.from('membres').select('id', { count: 'exact', head: true }).eq('agent_id', userProfile.agent_id),
          supabase.from('prets').select('id, pret_id, montant_pret, nombre_remboursements, statut, capital_restant').eq('agent_id', userProfile.agent_id),
          supabase.from('remboursements').select('id, statut, agent_id, montant, pret_id, date_remboursement, date_paiement, principal, interet').eq('agent_id', userProfile.agent_id),
          safeQuery(supabase.from('group_prets').select('id, pret_id, montant_pret, nombre_remboursements, statut, capital_restant').eq('agent_id', userProfile.agent_id)),
          safeQuery(supabase.from('group_remboursements').select('id, statut, agent_id, montant, pret_id, date_remboursement, date_paiement, principal, interet').eq('agent_id', userProfile.agent_id)),
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
        const activeGroupPrets =
          (groupPretsRes.data || []).filter((pret) => pret.statut === 'actif') || []
        const totalActivePrincipal =
          activePrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0) +
          activeGroupPrets.reduce((sum, pret) => sum + Number(pret.montant_pret || 0), 0)
        const totalRemboursements = (remboursementsRes.data?.length || 0) + (groupRemboursementsRes.data?.length || 0)
        const remboursementsPayes =
          (remboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0) +
          (groupRemboursementsRes.data?.filter((r) => r.statut === 'paye').length || 0)
        const pretMapById = new Map(
          (pretsRes.data || []).map((pret) => [pret.id, pret]),
        )
        const pretMapByCode = new Map(
          (pretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )
        const groupPretMapByCode = new Map(
          (groupPretsRes.data || []).map((pret) => [pret.pret_id, pret]),
        )
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayDateString = today.toISOString().split('T')[0]
        const todayRemboursements = (remboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayGroupRemboursements = (groupRemboursementsRes.data || []).filter(
          (r) => r.date_remboursement === todayDateString,
        )
        const todayRemboursementsCount = todayRemboursements.length + todayGroupRemboursements.length
        const todayRemboursementsAmount = 
          todayRemboursements.reduce((sum, remboursement) => sum + Number(remboursement.montant || 0), 0) +
          todayGroupRemboursements.reduce((sum, remboursement) => sum + Number(remboursement.montant || 0), 0)

        const getPrincipalValue = (remboursement: {
          principal: number | null
          montant: number | null
          pret_id: number | string | null
        }) => {
          if (remboursement.principal != null) {
            return Number(remboursement.principal)
          }
          // Essayer d'abord les prêts individuels, puis les prêts de groupe
          const pret =
            pretMapById.get(remboursement.pret_id as number) ||
            pretMapByCode.get(remboursement.pret_id as string) ||
            groupPretMapByCode.get(remboursement.pret_id as string)
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

        const activePretIds = new Set([
          ...activePrets.map((pret) => pret.pret_id),
          ...activeGroupPrets.map((pret) => pret.pret_id),
        ])

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

        const overdueGroupRemboursements =
          groupRemboursementsRes.data?.filter((r) => {
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

        const impayesCount = overdueRemboursements.length + overdueGroupRemboursements.length
        const impayesPrincipal =
          overdueRemboursements.reduce((sum, remboursement) => {
            return sum + getPrincipalValue(remboursement)
          }, 0) +
          overdueGroupRemboursements.reduce((sum, remboursement) => {
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
            }, 0) +
          (groupRemboursementsRes.data || [])
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

        // Détecter les changements pour toutes les cartes (section Agent)
        const newStatsAgent = {
          agents: 0,
          membres: membresRes.count || 0,
          prets: (pretsRes.data?.length || 0) + (groupPretsRes.data?.length || 0),
          remboursements: totalRemboursements,
          remboursementsPayes,
          montantTotal: portefeuilleActif,
          impayesCount,
          impayesRate,
          impayesPrincipal,
          todayRemboursementsCount,
          todayRemboursementsAmount,
        }

        // Détecter quelles cartes ont changé
        const changedAgent = new Set<string>()
        if (previousStats) {
          if (previousStats.membres !== newStatsAgent.membres) changedAgent.add('membres')
          if (previousStats.prets !== newStatsAgent.prets) changedAgent.add('prets')
          if (previousStats.remboursements !== newStatsAgent.remboursements) changedAgent.add('remboursements')
          if (previousStats.impayesCount !== newStatsAgent.impayesCount || previousStats.impayesRate !== newStatsAgent.impayesRate) changedAgent.add('impayes')
          if (previousPortefeuilleActif !== portefeuilleActif) {
            changedAgent.add('portefeuille')
            setPortefeuilleActifChanged(true)
            setTimeout(() => setPortefeuilleActifChanged(false), 2000)
          }
          if (previousStats.todayRemboursementsCount !== newStatsAgent.todayRemboursementsCount) changedAgent.add('remboursements-jour')
        }
        setChangedCards(changedAgent)
        setTimeout(() => setChangedCards(new Set()), 2000) // Réinitialiser après 2 secondes
        
        setPreviousPortefeuilleActif(portefeuilleActif)
        setPreviousStats(newStatsAgent)
        setStats(newStatsAgent)
        const qualifyingStatuses = new Set(['paye', 'paye_partiel'])

        const totalCollected =
          (remboursementsRes.data
            ?.filter((item) => qualifyingStatuses.has(item.statut))
            .reduce((sum, item) => sum + Number(item.montant || 0), 0) || 0) +
          (groupRemboursementsRes.data
            ?.filter((item) => qualifyingStatuses.has(item.statut))
            .reduce((sum, item) => sum + Number(item.montant || 0), 0) || 0)
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
        // Détecter les changements dans les dépenses et épargnes (section Agent)
        const previousExpensesTotalAgent = expensesSummary
        const previousEpargnesTotalAgent = totalEpargnes
        
        // Calculer le total des épargnes (dépôts - retraits)
        const epargnesTotal = (epargnesRes.data || []).reduce((sum, transaction) => {
          const montant = Number(transaction.montant || 0)
          return sum + (transaction.type === 'depot' ? montant : -montant)
        }, 0)
        
        if (previousStats && previousExpensesTotalAgent !== expensesTotal) changedAgent.add('depenses')
        if (previousStats && previousEpargnesTotalAgent !== epargnesTotal) changedAgent.add('epargnes')
        
        setExpensesSummary(expensesTotal)
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
        
        // Ajouter les intérêts des remboursements de groupe (section Agent)
        for (const remboursement of groupRemboursementsRes.data || []) {
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
        
        // Détecter les changements dans les intérêts (section Agent)
        if (previousStats && interestSummary.total !== totalInterest) {
          changedAgent.add('interet')
        }
        
        setInterestSummary({
          total: totalInterest,
          commissionTotal,
          monthly,
        })
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error)
    } finally {
      if (showRefreshing) {
        setRefreshing(false)
      }
    }
  }

  async function handleRefresh() {
    await loadStats(true)
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
      description: userProfile.role === 'chef_zone' ? 'Membres assignés' : 'Total membres',
      gradient: 'bg-gradient-to-r from-fuchsia-500 to-purple-700',
      href: userProfile.role === 'chef_zone' ? '/membres-assignes' : '/membres',
    },
    ...(userProfile.role !== 'chef_zone'
      ? [{
          title: 'Prêts',
          value: stats.prets,
          icon: CreditCard,
          description: 'Prêts actifs',
          gradient: 'bg-gradient-to-r from-emerald-500 to-green-600',
          href: '/prets',
        }]
      : []),
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
    ...(userProfile.role !== 'chef_zone'
      ? [{
          title: 'Portefeuille actif',
          value: formatCurrency(stats.montantTotal),
          icon: TrendingUp,
          description: 'Principal restant sur prêts actifs',
          gradient: 'bg-gradient-to-r from-cyan-500 to-teal-600',
          href: '/prets',
          isDynamic: true, // Marquer cette carte comme dynamique
        }]
      : []),
    // Intérêts et commissions: seulement pour admin, manager et agent
    ...(userProfile.role !== 'chef_zone'
      ? [
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
        ]
      : []),
    ...(userProfile.role !== 'chef_zone'
      ? [{
          title: 'Total épargnes',
          value: formatCurrency(totalEpargnes),
          icon: PiggyBank,
          description: 'Solde total des épargnes (dépôts - retraits)',
          gradient: 'bg-gradient-to-r from-emerald-500 to-teal-600',
          href: '/epargne',
        }]
      : []),
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
    // Épargnes: accessible depuis le dashboard pour tous les rôles sauf chef_zone
    ...(userProfile.role !== 'chef_zone'
      ? [{
          title: 'Épargnes',
          description: 'Gérer dépôts et retraits des membres',
          href: '/epargne',
          icon: Wallet,
          gradient: 'bg-gradient-to-r from-teal-500 to-green-600',
        }]
      : []),
    // Actions spécifiques pour Chef de Zone
    ...(userProfile.role === 'chef_zone'
      ? [
          {
            title: 'Membres Assignés',
            description: 'Voir les membres qui vous sont assignés',
            href: '/membres-assignes',
            icon: Users,
            gradient: 'bg-gradient-to-r from-blue-500 to-cyan-600',
          },
          {
            title: 'Gestion des Présences',
            description: 'Marquer la présence des membres',
            href: '/presences',
            icon: CalendarDays,
            gradient: 'bg-gradient-to-r from-purple-500 to-pink-600',
          },
        ]
      : []),
  ]

  const hasCollections = agentCollections.length > 0

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Bienvenue, {userProfile.nom && userProfile.prenom 
              ? `${userProfile.prenom} ${userProfile.nom}`
              : userProfile.email}
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
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          // Identifier quelle carte a changé
          const cardKey = stat.title.toLowerCase().replace(/\s+/g, '-')
          const hasChanged = changedCards.has(cardKey) || 
            (stat.title === 'Portefeuille actif' && portefeuilleActifChanged) ||
            (stat.title === 'Intérêt brut' && changedCards.has('interet')) ||
            (stat.title.includes('Commission') && changedCards.has('interet')) ||
            (stat.title === 'Total dépenses' && changedCards.has('depenses')) ||
            (stat.title === 'Total épargnes' && changedCards.has('epargnes')) ||
            (stat.title === 'Remboursements' && changedCards.has('remboursements-jour'))
          
          const cardContent = (
            <Card
              className={`border-0 shadow-sm overflow-hidden text-white ${stat.gradient} ${stat.href ? 'transition-transform hover:-translate-y-1 hover:shadow-lg cursor-pointer' : ''} ${hasChanged ? 'animate-pulse ring-2 ring-white/50' : ''}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/90">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-white/20 ${hasChanged ? 'animate-bounce' : ''}`}>
                  <Icon className={`w-4 h-4 text-white transition-all duration-300`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold text-white mb-1 transition-all duration-500 ${hasChanged ? 'scale-110' : ''}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-white/80 flex items-center gap-2">
                  {stat.description}
                  <span className="text-[10px] opacity-75 flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`${hasChanged ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-white opacity-75`}></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                    </span>
                    Temps réel
                  </span>
                </p>
                {stat.badgeContent ? (
                  <Badge className={`mt-3 bg-white/25 text-white border border-white/40 font-medium ${hasChanged ? 'animate-pulse' : ''}`}>
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

      {/* Agent Collections - Masqué pour chef_zone */}
      {userProfile.role !== 'chef_zone' && (
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
      )}

      {/* Intérêt perçu - Masqué pour chef_zone */}
      {userProfile.role !== 'chef_zone' && (
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
      )}

    </DashboardLayout>
  )
}
