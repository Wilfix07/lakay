'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, type UserProfile, type Agent, type Membre } from '@/lib/supabase'
import { getUserProfile, signOut } from '@/lib/auth'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/DashboardLayout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  CalendarDays,
  Loader2,
  RefreshCcw,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

type TransactionType = 
  | 'depot_epargne'
  | 'retrait_epargne'
  | 'depense'
  | 'remboursement_individuel'
  | 'remboursement_groupe'
  | 'depot_garantie'
  | 'retrait_garantie'

interface Transaction {
  id: string
  type: TransactionType
  date: string
  montant: number
  membre_id?: string
  membre_nom?: string
  agent_id: string
  agent_nom?: string
  pret_id?: string
  description?: string
  notes?: string
}

function ResumePageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [membres, setMembres] = useState<Membre[]>([])

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadData(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      if (!userProfile) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayDateString = today.toISOString().split('T')[0]

      // Charger les agents et membres pour les noms
      let agentsQuery = supabase.from('agents').select('*')
      let membresQuery = supabase.from('membres').select('*')

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        agentsQuery = agentsQuery.eq('agent_id', userProfile.agent_id)
        membresQuery = membresQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager') {
        const { data: managerAgents } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)
        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          agentsQuery = agentsQuery.in('agent_id', agentIds)
          membresQuery = membresQuery.in('agent_id', agentIds)
        } else {
          setTransactions([])
          setLoading(false)
          return
        }
      }

      const [{ data: agentsData, error: agentsError }, { data: membresData, error: membresError }] =
        await Promise.all([agentsQuery, membresQuery])

      if (agentsError) throw agentsError
      if (membresError) throw membresError

      setAgents(agentsData || [])
      setMembres(membresData || [])

      const allTransactions: Transaction[] = []

      // 1. Dépôts d'épargne
      let epargneDepotsQuery = supabase
        .from('epargne_transactions')
        .select('*')
        .eq('type', 'depot')
        .eq('date_operation', todayDateString)

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        epargneDepotsQuery = epargneDepotsQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager') {
        const agentIds = (agentsData || []).map(a => a.agent_id)
        if (agentIds.length > 0) {
          epargneDepotsQuery = epargneDepotsQuery.in('agent_id', agentIds)
        }
      }

      const { data: epargneDepots, error: epargneDepotsError } = await epargneDepotsQuery
      if (!epargneDepotsError && epargneDepots) {
        epargneDepots.forEach((t: any) => {
          allTransactions.push({
            id: `epargne_depot_${t.id}`,
            type: 'depot_epargne',
            date: t.date_operation,
            montant: Number(t.montant || 0),
            membre_id: t.membre_id,
            agent_id: t.agent_id,
            pret_id: undefined,
            description: `Dépôt d'épargne - ${t.membre_id}`,
            notes: t.notes,
          })
        })
      }

      // 2. Retraits d'épargne
      let epargneRetraitsQuery = supabase
        .from('epargne_transactions')
        .select('*')
        .eq('type', 'retrait')
        .eq('date_operation', todayDateString)

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        epargneRetraitsQuery = epargneRetraitsQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager') {
        const agentIds = (agentsData || []).map(a => a.agent_id)
        if (agentIds.length > 0) {
          epargneRetraitsQuery = epargneRetraitsQuery.in('agent_id', agentIds)
        }
      }

      const { data: epargneRetraits, error: epargneRetraitsError } = await epargneRetraitsQuery
      if (!epargneRetraitsError && epargneRetraits) {
        epargneRetraits.forEach((t: any) => {
          allTransactions.push({
            id: `epargne_retrait_${t.id}`,
            type: 'retrait_epargne',
            date: t.date_operation,
            montant: Number(t.montant || 0),
            membre_id: t.membre_id,
            agent_id: t.agent_id,
            pret_id: undefined,
            description: `Retrait d'épargne - ${t.membre_id}`,
            notes: t.notes,
          })
        })
      }

      // 3. Dépenses
      let expensesQuery = supabase
        .from('agent_expenses')
        .select('*')
        .eq('expense_date', todayDateString)

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        expensesQuery = expensesQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager') {
        const agentIds = (agentsData || []).map(a => a.agent_id)
        if (agentIds.length > 0) {
          expensesQuery = expensesQuery.in('agent_id', agentIds)
        }
      }

      const { data: expenses, error: expensesError } = await expensesQuery
      if (!expensesError && expenses) {
        expenses.forEach((e: any) => {
          allTransactions.push({
            id: `expense_${e.id}`,
            type: 'depense',
            date: e.expense_date,
            montant: Number(e.amount || 0),
            membre_id: undefined,
            agent_id: e.agent_id,
            pret_id: undefined,
            description: e.description || e.category || 'Dépense',
            notes: e.description,
          })
        })
      }

      // 4. Remboursements individuels
      let remboursementsQuery = supabase
        .from('remboursements')
        .select('*')
        .eq('date_paiement', todayDateString)
        .eq('statut', 'paye')

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        remboursementsQuery = remboursementsQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager') {
        const agentIds = (agentsData || []).map(a => a.agent_id)
        if (agentIds.length > 0) {
          remboursementsQuery = remboursementsQuery.in('agent_id', agentIds)
        }
      }

      const { data: remboursements, error: remboursementsError } = await remboursementsQuery
      if (!remboursementsError && remboursements) {
        remboursements.forEach((r: any) => {
          allTransactions.push({
            id: `remboursement_${r.id}`,
            type: 'remboursement_individuel',
            date: r.date_paiement,
            montant: Number(r.montant || 0),
            membre_id: r.membre_id,
            agent_id: r.agent_id,
            pret_id: r.pret_id,
            description: `Remboursement #${r.numero_remboursement} - Prêt ${r.pret_id}`,
            notes: undefined,
          })
        })
      }

      // 5. Remboursements de groupe
      let groupRemboursementsQuery = supabase
        .from('group_remboursements')
        .select('*')
        .eq('date_paiement', todayDateString)
        .eq('statut', 'paye')

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        groupRemboursementsQuery = groupRemboursementsQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager') {
        const agentIds = (agentsData || []).map(a => a.agent_id)
        if (agentIds.length > 0) {
          groupRemboursementsQuery = groupRemboursementsQuery.in('agent_id', agentIds)
        }
      }

      const { data: groupRemboursements, error: groupRemboursementsError } = await groupRemboursementsQuery
      if (!groupRemboursementsError && groupRemboursements) {
        groupRemboursements.forEach((r: any) => {
          allTransactions.push({
            id: `group_remboursement_${r.id}`,
            type: 'remboursement_groupe',
            date: r.date_paiement,
            montant: Number(r.montant || 0),
            membre_id: r.membre_id,
            agent_id: r.agent_id,
            pret_id: r.pret_id,
            description: `Remboursement groupe #${r.numero_remboursement} - Prêt ${r.pret_id}`,
            notes: undefined,
          })
        })
      }

      // 6. Dépôts de garantie
      let collateralsDepotsQuery = supabase
        .from('collaterals')
        .select('*')
        .eq('date_depot', todayDateString)
        .gt('montant_depose', 0)

      // Récupérer les prêts pour obtenir les agent_id
      let pretsForCollaterals: any[] = []
      if (userProfile.role === 'agent' && userProfile.agent_id) {
        const { data: pretsData } = await supabase
          .from('prets')
          .select('pret_id, agent_id')
          .eq('agent_id', userProfile.agent_id)
        pretsForCollaterals = pretsData || []
        const pretIds = pretsForCollaterals.map(p => p.pret_id)
        if (pretIds.length > 0) {
          collateralsDepotsQuery = collateralsDepotsQuery.in('pret_id', pretIds)
        } else {
          collateralsDepotsQuery = collateralsDepotsQuery.eq('pret_id', '')
        }
      } else if (userProfile.role === 'manager') {
        const agentIds = (agentsData || []).map(a => a.agent_id)
        if (agentIds.length > 0) {
          const { data: pretsData } = await supabase
            .from('prets')
            .select('pret_id, agent_id')
            .in('agent_id', agentIds)
          pretsForCollaterals = pretsData || []
          const pretIds = pretsForCollaterals.map(p => p.pret_id)
          if (pretIds.length > 0) {
            collateralsDepotsQuery = collateralsDepotsQuery.in('pret_id', pretIds)
          }
        }
      } else {
        // Admin - récupérer tous les prêts
        const { data: pretsData } = await supabase
          .from('prets')
          .select('pret_id, agent_id')
        pretsForCollaterals = pretsData || []
      }

      // Récupérer aussi les prêts de groupe
      let groupPretsForCollaterals: any[] = []
      try {
        let groupPretsQuery = supabase
          .from('group_prets')
          .select('pret_id, agent_id')
        if (userProfile.role === 'agent' && userProfile.agent_id) {
          groupPretsQuery = groupPretsQuery.eq('agent_id', userProfile.agent_id)
        } else if (userProfile.role === 'manager') {
          const agentIds = (agentsData || []).map(a => a.agent_id)
          if (agentIds.length > 0) {
            groupPretsQuery = groupPretsQuery.in('agent_id', agentIds)
          }
        }
        const { data: groupPretsData } = await groupPretsQuery
        groupPretsForCollaterals = groupPretsData || []
      } catch (error) {
        // Table group_prets peut ne pas exister
        console.warn('Table group_prets non disponible:', error)
      }

      const { data: collateralsDepots, error: collateralsDepotsError } = await collateralsDepotsQuery
      if (!collateralsDepotsError && collateralsDepots) {
        collateralsDepots.forEach((c: any) => {
          if (c.montant_depose > 0) {
            // Trouver l'agent_id via le prêt
            let agentId = ''
            if (c.pret_id) {
              const pret = pretsForCollaterals.find(p => p.pret_id === c.pret_id)
              agentId = pret?.agent_id || ''
            } else if (c.group_pret_id) {
              const groupPret = groupPretsForCollaterals.find(p => p.pret_id === c.group_pret_id)
              agentId = groupPret?.agent_id || ''
            }

            allTransactions.push({
              id: `collateral_depot_${c.id}`,
              type: 'depot_garantie',
              date: c.date_depot,
              montant: Number(c.montant_depose || 0),
              membre_id: c.membre_id,
              agent_id: agentId,
              pret_id: c.pret_id || c.group_pret_id || undefined,
              description: `Dépôt de garantie${c.pret_id ? ` - Prêt ${c.pret_id}` : c.group_pret_id ? ` - Prêt groupe ${c.group_pret_id}` : ''}`,
              notes: c.notes,
            })
          }
        })
      }

      // 7. Retraits de garantie
      let collateralsRetraitsQuery = supabase
        .from('collaterals')
        .select('*')
        .eq('date_remboursement', todayDateString)
        .not('date_remboursement', 'is', null)

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        const pretIds = pretsForCollaterals.map(p => p.pret_id)
        if (pretIds.length > 0) {
          collateralsRetraitsQuery = collateralsRetraitsQuery.in('pret_id', pretIds)
        } else {
          collateralsRetraitsQuery = collateralsRetraitsQuery.eq('pret_id', '')
        }
      } else if (userProfile.role === 'manager') {
        const pretIds = pretsForCollaterals.map(p => p.pret_id)
        if (pretIds.length > 0) {
          collateralsRetraitsQuery = collateralsRetraitsQuery.in('pret_id', pretIds)
        }
      }

      const { data: collateralsRetraits, error: collateralsRetraitsError } = await collateralsRetraitsQuery
      if (!collateralsRetraitsError && collateralsRetraits) {
        collateralsRetraits.forEach((c: any) => {
          // Pour les retraits, on vérifie si le montant restant a diminué
          // Un retrait signifie que montant_restant < montant_requis et date_remboursement est aujourd'hui
          if (c.date_remboursement === todayDateString && c.montant_restant < c.montant_requis) {
            // Le montant retiré est la différence entre le montant requis initial et le montant restant actuel
            // Mais on doit aussi considérer les dépôts précédents
            // Pour simplifier, on considère qu'un retrait a eu lieu si date_remboursement est aujourd'hui
            const montantRetire = Math.max(0, (c.montant_requis || 0) - (c.montant_restant || 0))
            
            if (montantRetire > 0) {
              // Trouver l'agent_id via le prêt
              let agentId = ''
              if (c.pret_id) {
                const pret = pretsForCollaterals.find(p => p.pret_id === c.pret_id)
                agentId = pret?.agent_id || ''
              } else if (c.group_pret_id) {
                const groupPret = groupPretsForCollaterals.find(p => p.pret_id === c.group_pret_id)
                agentId = groupPret?.agent_id || ''
              }

              allTransactions.push({
                id: `collateral_retrait_${c.id}`,
                type: 'retrait_garantie',
                date: c.date_remboursement,
                montant: montantRetire,
                membre_id: c.membre_id,
                agent_id: agentId,
                pret_id: c.pret_id || c.group_pret_id || undefined,
                description: `Retrait de garantie${c.pret_id ? ` - Prêt ${c.pret_id}` : c.group_pret_id ? ` - Prêt groupe ${c.group_pret_id}` : ''}`,
                notes: c.notes,
              })
            }
          }
        })
      }

      // Enrichir avec les noms des agents et membres
      const enrichedTransactions = allTransactions.map(t => {
        const agent = agentsData?.find(a => a.agent_id === t.agent_id)
        const membre = membresData?.find(m => m.membre_id === t.membre_id)
        return {
          ...t,
          agent_nom: agent ? `${agent.prenom} ${agent.nom}` : '',
          membre_nom: membre ? `${membre.prenom} ${membre.nom}` : '',
        }
      })

      // Trier par date/heure (plus récent en premier)
      enrichedTransactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })

      setTransactions(enrichedTransactions)
    } catch (error: any) {
      console.error('Erreur lors du chargement des transactions:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const totals = useMemo(() => {
    const totalsByType: Record<TransactionType, number> = {
      depot_epargne: 0,
      retrait_epargne: 0,
      depense: 0,
      remboursement_individuel: 0,
      remboursement_groupe: 0,
      depot_garantie: 0,
      retrait_garantie: 0,
    }

    transactions.forEach(t => {
      totalsByType[t.type] += t.montant
    })

    const totalEntrees =
      totalsByType.depot_epargne +
      totalsByType.remboursement_individuel +
      totalsByType.remboursement_groupe +
      totalsByType.depot_garantie

    const totalSorties =
      totalsByType.retrait_epargne +
      totalsByType.depense +
      totalsByType.retrait_garantie

    const solde = totalEntrees - totalSorties

    return {
      byType: totalsByType,
      entrees: totalEntrees,
      sorties: totalSorties,
      solde,
    }
  }, [transactions])

  function getTransactionTypeLabel(type: TransactionType): string {
    const labels: Record<TransactionType, string> = {
      depot_epargne: "Dépôt d'épargne",
      retrait_epargne: "Retrait d'épargne",
      depense: 'Dépense',
      remboursement_individuel: 'Remboursement individuel',
      remboursement_groupe: 'Remboursement groupe',
      depot_garantie: 'Dépôt de garantie',
      retrait_garantie: 'Retrait de garantie',
    }
    return labels[type]
  }

  function getTransactionIcon(type: TransactionType) {
    switch (type) {
      case 'depot_epargne':
      case 'depot_garantie':
        return <ArrowDownRight className="h-4 w-4 text-green-600" />
      case 'retrait_epargne':
      case 'retrait_garantie':
      case 'depense':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />
      case 'remboursement_individuel':
      case 'remboursement_groupe':
        return <DollarSign className="h-4 w-4 text-blue-600" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  function getTransactionBadgeColor(type: TransactionType): string {
    switch (type) {
      case 'depot_epargne':
      case 'depot_garantie':
        return 'bg-green-100 text-green-800'
      case 'retrait_epargne':
      case 'retrait_garantie':
      case 'depense':
        return 'bg-red-100 text-red-800'
      case 'remboursement_individuel':
      case 'remboursement_groupe':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Résumé des Transactions</h1>
            <p className="text-gray-600 mt-2">
              Toutes les transactions du jour - {formatDate(new Date().toISOString())}
            </p>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Actualiser
          </button>
        </div>

        {/* Cartes de résumé */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entrées</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totals.entrees)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter(t =>
                  ['depot_epargne', 'remboursement_individuel', 'remboursement_groupe', 'depot_garantie'].includes(t.type)
                ).length} transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sorties</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totals.sorties)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter(t =>
                  ['retrait_epargne', 'depense', 'retrait_garantie'].includes(t.type)
                ).length} transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solde du Jour</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totals.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.solde)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {totals.solde >= 0 ? 'Bénéfice' : 'Déficit'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <CalendarDays className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {transactions.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Transactions aujourd'hui</p>
            </CardContent>
          </Card>
        </div>

        {/* Détails par type */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Remboursements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-blue-600">
                {formatCurrency(
                  totals.byType.remboursement_individuel + totals.byType.remboursement_groupe
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter(t =>
                  t.type === 'remboursement_individuel' || t.type === 'remboursement_groupe'
                ).length}{' '}
                transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Épargnes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(totals.byType.depot_epargne)}
              </div>
              <div className="text-sm text-red-600">
                -{formatCurrency(totals.byType.retrait_epargne)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter(t =>
                  t.type === 'depot_epargne' || t.type === 'retrait_epargne'
                ).length}{' '}
                transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Garanties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(totals.byType.depot_garantie)}
              </div>
              <div className="text-sm text-red-600">
                -{formatCurrency(totals.byType.retrait_garantie)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter(t =>
                  t.type === 'depot_garantie' || t.type === 'retrait_garantie'
                ).length}{' '}
                transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dépenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-red-600">
                {formatCurrency(totals.byType.depense)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter(t => t.type === 'depense').length} transaction(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tableau des transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des Transactions</CardTitle>
            <CardDescription>
              Liste complète de toutes les transactions effectuées aujourd'hui
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune transaction enregistrée aujourd'hui
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Date/Heure</TableHead>
                      <TableHead>Membre</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Prêt</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(transaction.type)}
                            <Badge className={getTransactionBadgeColor(transaction.type)}>
                              {getTransactionTypeLabel(transaction.type)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(transaction.date)}
                        </TableCell>
                        <TableCell>
                          {transaction.membre_nom || transaction.membre_id || '-'}
                        </TableCell>
                        <TableCell>
                          {transaction.agent_nom || transaction.agent_id || '-'}
                        </TableCell>
                        <TableCell>
                          {transaction.pret_id || '-'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{transaction.description}</div>
                            {transaction.notes && (
                              <div className="text-xs text-gray-500 mt-1">
                                {transaction.notes}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${
                              ['depot_epargne', 'remboursement_individuel', 'remboursement_groupe', 'depot_garantie'].includes(
                                transaction.type
                              )
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                          >
                            {['depot_epargne', 'remboursement_individuel', 'remboursement_groupe', 'depot_garantie'].includes(
                              transaction.type
                            )
                              ? '+'
                              : '-'}
                            {formatCurrency(transaction.montant)}
                          </span>
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

export default function ResumePage() {
  return (
    <ProtectedRoute requiredPermission="canProcessRemboursements">
      <ResumePageContent />
    </ProtectedRoute>
  )
}

