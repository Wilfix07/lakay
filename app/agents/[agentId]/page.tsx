'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Agent, type Membre, type Pret, type GroupPret, type Remboursement, type GroupRemboursement, type Collateral, type EpargneTransaction, type AgentExpense, type UserProfile, type MembreGroup } from '@/lib/supabase'
import { getUserProfile, signOut } from '@/lib/auth'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { getInterestRates } from '@/lib/systemSettings'
import { 
  Loader2, 
  ArrowLeft, 
  User, 
  Users, 
  CreditCard, 
  Wallet, 
  PiggyBank, 
  TrendingUp, 
  AlertTriangle,
  DollarSign,
  FileText,
  RefreshCcw
} from 'lucide-react'

type ActiveTab = 'overview' | 'credits-individuels' | 'credits-groupe' | 'depenses' | 'membres-individuels' | 'membres-groupe' | 'chefs-zone' | 'garanties' | 'epargnes' | 'impayes' | 'pnl'

function AgentDetailsPageContent() {
  const params = useParams()
  const router = useRouter()
  const agentId = params?.agentId as string

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [refreshing, setRefreshing] = useState(false)

  // Data states
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [groupMembres, setGroupMembres] = useState<Membre[]>([])
  const [membreGroups, setMembreGroups] = useState<MembreGroup[]>([])
  const [expenses, setExpenses] = useState<AgentExpense[]>([])
  const [collaterals, setCollaterals] = useState<Collateral[]>([])
  const [epargneTransactions, setEpargneTransactions] = useState<EpargneTransaction[]>([])
  const [remboursements, setRemboursements] = useState<Remboursement[]>([])
  const [groupRemboursements, setGroupRemboursements] = useState<GroupRemboursement[]>([])
  const [chefsZone, setChefsZone] = useState<UserProfile[]>([])
  const [chefZoneMembres, setChefZoneMembres] = useState<Record<string, Membre[]>>({})

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile && agentId) {
      // Vérifier que l'utilisateur est manager ou admin
      if (userProfile.role !== 'manager' && userProfile.role !== 'admin') {
        alert('Accès refusé. Seuls les managers et admins peuvent voir les détails des agents.')
        router.push('/agents')
        return
      }

      // Si manager, vérifier que l'agent appartient à ce manager
      if (userProfile.role === 'manager') {
        loadAgentAndVerify()
      } else {
        loadAgent()
      }
    }
  }, [userProfile, agentId])

  useEffect(() => {
    if (agent && userProfile) {
      loadAllData()
    }
  }, [agent, userProfile])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadAgentAndVerify() {
    try {
      const { data: agentData, error } = await supabase
        .from('agents')
        .select('*')
        .eq('agent_id', agentId)
        .single()

      if (error) throw error

      if (!agentData) {
        alert('Agent non trouvé')
        router.push('/agents')
        return
      }

      // Vérifier que l'agent appartient au manager
      if (userProfile?.role === 'manager' && agentData.manager_id !== userProfile.id) {
        alert('Accès refusé. Cet agent ne vous appartient pas.')
        router.push('/agents')
        return
      }

      setAgent(agentData)
    } catch (error: any) {
      console.error('Erreur lors du chargement de l\'agent:', error)
      alert('Erreur lors du chargement de l\'agent')
      router.push('/agents')
    }
  }

  async function loadAgent() {
    try {
      const { data: agentData, error } = await supabase
        .from('agents')
        .select('*')
        .eq('agent_id', agentId)
        .single()

      if (error) throw error
      if (!agentData) {
        alert('Agent non trouvé')
        router.push('/agents')
        return
      }

      setAgent(agentData)
    } catch (error: any) {
      console.error('Erreur lors du chargement de l\'agent:', error)
      alert('Erreur lors du chargement de l\'agent')
      router.push('/agents')
    }
  }

  async function loadAllData(showRefreshing = false) {
    if (!agent || !agentId) return

    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // Charger toutes les données en parallèle
      const [
        pretsRes,
        groupPretsRes,
        membresRes,
        expensesRes,
        collateralsRes,
        epargneRes,
        remboursementsRes,
        groupRemboursementsRes,
        groupsRes,
        chefsZoneRes,
      ] = await Promise.all([
        supabase.from('prets').select('*').eq('agent_id', agentId),
        supabase.from('group_prets').select('*').eq('agent_id', agentId),
        supabase.from('membres').select('*').eq('agent_id', agentId),
        supabase.from('agent_expenses').select('*').eq('agent_id', agentId),
        supabase.from('collaterals').select('*'),
        supabase.from('epargne_transactions').select('*').eq('agent_id', agentId),
        supabase.from('remboursements').select('*').eq('agent_id', agentId),
        supabase.from('group_remboursements').select('*').eq('agent_id', agentId),
        supabase.from('membre_groups').select('*').eq('agent_id', agentId),
        // Charger uniquement les chefs de zone attachés à cet agent spécifique
        supabase.from('user_profiles').select('*').eq('role', 'chef_zone').eq('agent_id', agentId),
      ])

      if (pretsRes.error) throw pretsRes.error
      if (groupPretsRes.error) throw groupPretsRes.error
      if (membresRes.error) throw membresRes.error
      if (expensesRes.error) throw expensesRes.error
      if (epargneRes.error) throw epargneRes.error
      if (remboursementsRes.error) throw remboursementsRes.error
      if (groupRemboursementsRes.error) throw groupRemboursementsRes.error
      if (groupsRes.error) throw groupsRes.error

      setPrets(pretsRes.data || [])
      setGroupPrets(groupPretsRes.data || [])
      setMembres(membresRes.data || [])
      setExpenses(expensesRes.data || [])
      setEpargneTransactions(epargneRes.data || [])
      setRemboursements(remboursementsRes.data || [])
      setGroupRemboursements(groupRemboursementsRes.data || [])

      // Gérer les garanties (filtrer celles liées aux prêts de cet agent)
      if (!collateralsRes.error && collateralsRes.data) {
        const pretIds = pretsRes.data?.map(p => p.pret_id) || []
        const groupPretIds = groupPretsRes.data?.map(p => p.pret_id) || []
        const filteredCollaterals = collateralsRes.data.filter((c: any) => {
          return (c.pret_id && pretIds.includes(c.pret_id)) || 
                 (c.group_pret_id && groupPretIds.includes(c.group_pret_id))
        })
        setCollaterals(filteredCollaterals as any)
      }

      // Gérer les groupes et leurs membres
      let allGroupMembres: Membre[] = []
      if (groupsRes.data) {
        setMembreGroups(groupsRes.data as any)
        
        // Charger les membres de chaque groupe
        const groupIds = groupsRes.data.map((g: any) => g.id)
        if (groupIds.length > 0) {
          const { data: groupMembersData, error: groupMembersError } = await supabase
            .from('membre_group_members')
            .select('group_id, membre_id')
            .in('group_id', groupIds)

          if (!groupMembersError && groupMembersData) {
            const membreIds = [...new Set(groupMembersData.map((gm: any) => gm.membre_id))]
            if (membreIds.length > 0) {
              const { data: membresData, error: membresError } = await supabase
                .from('membres')
                .select('*')
                .in('membre_id', membreIds)

              if (!membresError && membresData) {
                allGroupMembres = membresData
                setGroupMembres(membresData)
                
                // Associer les membres aux groupes
                const groupsWithMembers = groupsRes.data.map((group: any) => {
                  const groupMemberIds = groupMembersData
                    .filter((gm: any) => gm.group_id === group.id)
                    .map((gm: any) => gm.membre_id)
                  return {
                    ...group,
                    members: membresData.filter((m: Membre) => groupMemberIds.includes(m.membre_id))
                  }
                })
                setMembreGroups(groupsWithMembers as any)
              }
            }
          }
        }
      }

      // Charger les chefs de zone et leurs membres assignés (après avoir chargé tous les membres)
      if (chefsZoneRes.data) {
        setChefsZone(chefsZoneRes.data)
        // Utiliser les membres déjà chargés
        const allMembres = [...membresRes.data || [], ...allGroupMembres]
        await loadChefZoneMembres(chefsZoneRes.data, allMembres)
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des données:', error)
      alert('Erreur lors du chargement des données: ' + (error.message || 'Erreur inconnue'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadChefZoneMembres(chefs: UserProfile[], allMembres: Membre[]) {
    try {
      const allMembreIds = allMembres.map(m => m.membre_id)
      if (allMembreIds.length === 0) return

      const { data: assignations, error } = await supabase
        .from('chef_zone_membres')
        .select('chef_zone_id, membre_id')
        .in('membre_id', allMembreIds)

      if (error) throw error

      const map: Record<string, Membre[]> = {}
      chefs.forEach(chef => {
        map[chef.id] = []
      })

      assignations?.forEach(assignation => {
        const membre = allMembres.find(m => m.membre_id === assignation.membre_id)
        if (membre && map[assignation.chef_zone_id]) {
          map[assignation.chef_zone_id].push(membre)
        }
      })

      setChefZoneMembres(map)
    } catch (error: any) {
      console.error('Erreur lors du chargement des assignations chef de zone:', error)
    }
  }

  // Calculs pour l'onglet Overview
  const overviewStats = useMemo(() => {
    const totalPrets = prets.length + groupPrets.length
    const totalMembres = membres.length + groupMembres.length
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const totalEpargne = epargneTransactions.reduce((sum, t) => {
      return sum + (t.type === 'depot' ? Number(t.montant || 0) : -Number(t.montant || 0))
    }, 0)
    const totalCollaterals = collaterals.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0)
    
    const activePrets = [...prets, ...groupPrets].filter(p => 
      p.statut === 'actif' || p.statut === 'en_attente_garantie' || p.statut === 'en_attente_approbation'
    ).length

    return {
      totalPrets,
      activePrets,
      totalMembres,
      totalExpenses,
      totalEpargne,
      totalCollaterals,
    }
  }, [prets, groupPrets, membres, groupMembres, expenses, epargneTransactions, collaterals])

  // Calculs pour les impayés
  const impayes = useMemo(() => {
    const allImpayes: Array<{
      pretId: string
      membreId: string
      membreName: string
      numero: number
      montant: number
      principal: number
      interet: number
      dueDate: string
      statut: string
      daysLate: number
      type: 'individuel' | 'groupe'
    }> = []

    // Impayés individuels
    remboursements.forEach(rem => {
      if (rem.statut === 'en_retard' || rem.statut === 'en_attente' || rem.statut === 'paye_partiel') {
        const dueDate = new Date(rem.date_remboursement)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysLate > 0 || rem.statut === 'en_retard') {
          const membre = membres.find(m => m.membre_id === rem.membre_id)
          allImpayes.push({
            pretId: rem.pret_id,
            membreId: rem.membre_id,
            membreName: membre ? `${membre.prenom} ${membre.nom}` : rem.membre_id,
            numero: rem.numero_remboursement,
            montant: Number(rem.montant || 0),
            principal: Number(rem.principal || 0),
            interet: Number(rem.interet || 0),
            dueDate: rem.date_remboursement,
            statut: rem.statut,
            daysLate: daysLate > 0 ? daysLate : 0,
            type: 'individuel',
          })
        }
      }
    })

    // Impayés de groupe
    groupRemboursements.forEach(rem => {
      if (rem.statut === 'en_retard' || rem.statut === 'en_attente' || rem.statut === 'paye_partiel') {
        const dueDate = new Date(rem.date_remboursement)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysLate > 0 || rem.statut === 'en_retard') {
          const membre = groupMembres.find(m => m.membre_id === rem.membre_id)
          allImpayes.push({
            pretId: rem.pret_id,
            membreId: rem.membre_id,
            membreName: membre ? `${membre.prenom} ${membre.nom}` : rem.membre_id,
            numero: rem.numero_remboursement,
            montant: Number(rem.montant || 0),
            principal: Number(rem.principal || 0),
            interet: Number(rem.interet || 0),
            dueDate: rem.date_remboursement,
            statut: rem.statut,
            daysLate: daysLate > 0 ? daysLate : 0,
            type: 'groupe',
          })
        }
      }
    })

    return allImpayes.sort((a, b) => b.daysLate - a.daysLate)
  }, [remboursements, groupRemboursements, membres, groupMembres])

  // Calculs PNL
  const pnlData = useMemo(async () => {
    const interestRates = await getInterestRates()
    const commissionRate = interestRates?.commissionRate || 0.3

    // Calculer les intérêts collectés
    const interestCollected = [...remboursements, ...groupRemboursements]
      .filter(r => r.statut === 'paye' || r.statut === 'paye_partiel')
      .reduce((sum, r) => sum + Number(r.interet || 0), 0)

    // Calculer les dépenses
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

    // Net avant commission
    const net = interestCollected - totalExpenses

    // Commission
    const commission = net * commissionRate

    // Net après commission
    const netAfterCommission = net - commission

    return {
      interestCollected,
      totalExpenses,
      net,
      commission,
      netAfterCommission,
      commissionRate,
    }
  }, [remboursements, groupRemboursements, expenses])

  const [pnlStats, setPnlStats] = useState({
    interestCollected: 0,
    totalExpenses: 0,
    net: 0,
    commission: 0,
    netAfterCommission: 0,
    commissionRate: 0.3,
  })

  useEffect(() => {
    async function calculatePnl() {
      const data = await pnlData
      setPnlStats(data)
    }
    calculatePnl()
  }, [pnlData])

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

  if (loading || !userProfile || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  const tabs: Array<{ id: ActiveTab; label: string; icon: any }> = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: FileText },
    { id: 'credits-individuels', label: 'Crédits Individuels', icon: CreditCard },
    { id: 'credits-groupe', label: 'Crédits Groupe', icon: Users },
    { id: 'depenses', label: 'Dépenses', icon: DollarSign },
    { id: 'membres-individuels', label: 'Membres Individuels', icon: User },
    { id: 'membres-groupe', label: 'Membres Groupe', icon: Users },
    { id: 'chefs-zone', label: 'Chefs de Zone', icon: User },
    { id: 'garanties', label: 'Garanties', icon: Wallet },
    { id: 'epargnes', label: 'Épargnes', icon: PiggyBank },
    { id: 'impayes', label: 'Impayés', icon: AlertTriangle },
    { id: 'pnl', label: 'PNL', icon: TrendingUp },
  ]

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/agents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Détails de l'Agent: {agent.prenom} {agent.nom}
              </h1>
              <p className="text-muted-foreground mt-2">
                ID: {agent.agent_id} | {agent.email || agent.telephone || 'Pas de contact'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAllData(true)}
            disabled={refreshing}
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'ghost'}
                  onClick={() => setActiveTab(tab.id)}
                  className="gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Prêts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{overviewStats.totalPrets}</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {overviewStats.activePrets} actifs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Membres
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{overviewStats.totalMembres}</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {membres.length} individuels, {groupMembres.length} en groupe
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Dépenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(overviewStats.totalExpenses)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PiggyBank className="w-5 h-5" />
                    Épargnes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(overviewStats.totalEpargne)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Garanties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(overviewStats.totalCollaterals)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Impayés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{impayes.length}</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Total: {formatCurrency(impayes.reduce((sum, i) => sum + i.montant, 0))}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'credits-individuels' && (
            <Card>
              <CardHeader>
                <CardTitle>Crédits Individuels</CardTitle>
                <CardDescription>Total: {prets.length} prêt(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {prets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun prêt individuel</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Prêt</TableHead>
                          <TableHead>Membre</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date Décaissement</TableHead>
                          <TableHead>Capital Restant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prets.map((pret) => {
                          const membre = membres.find(m => m.membre_id === pret.membre_id)
                          return (
                            <TableRow key={pret.pret_id}>
                              <TableCell className="font-medium">{pret.pret_id}</TableCell>
                              <TableCell>
                                {membre ? `${membre.prenom} ${membre.nom}` : pret.membre_id}
                              </TableCell>
                              <TableCell>{formatCurrency(pret.montant_pret)}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  pret.statut === 'actif' ? 'default' :
                                  pret.statut === 'en_attente_approbation' ? 'secondary' :
                                  pret.statut === 'en_attente_garantie' ? 'secondary' :
                                  pret.statut === 'termine' ? 'outline' : 'destructive'
                                }>
                                  {pret.statut}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(pret.date_decaissement)}</TableCell>
                              <TableCell>{formatCurrency(pret.capital_restant || 0)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'credits-groupe' && (
            <Card>
              <CardHeader>
                <CardTitle>Crédits Groupe</CardTitle>
                <CardDescription>Total: {groupPrets.length} prêt(s) de groupe</CardDescription>
              </CardHeader>
              <CardContent>
                {groupPrets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun prêt de groupe</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Prêt</TableHead>
                          <TableHead>Groupe</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date Décaissement</TableHead>
                          <TableHead>Capital Restant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupPrets.map((pret) => {
                          const group = membreGroups.find(g => g.id === pret.group_id)
                          return (
                            <TableRow key={pret.pret_id}>
                              <TableCell className="font-medium">{pret.pret_id}</TableCell>
                              <TableCell>{group?.group_name || `Groupe ${pret.group_id}`}</TableCell>
                              <TableCell>{formatCurrency(pret.montant_pret)}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  pret.statut === 'actif' ? 'default' :
                                  pret.statut === 'en_attente_approbation' ? 'secondary' :
                                  pret.statut === 'en_attente_garantie' ? 'secondary' :
                                  pret.statut === 'termine' ? 'outline' : 'destructive'
                                }>
                                  {pret.statut}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(pret.date_decaissement)}</TableCell>
                              <TableCell>{formatCurrency(pret.capital_restant || 0)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'depenses' && (
            <Card>
              <CardHeader>
                <CardTitle>Dépenses</CardTitle>
                <CardDescription>
                  Total: {formatCurrency(expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucune dépense</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Montant</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{formatDate(expense.expense_date)}</TableCell>
                            <TableCell>{expense.description || '-'}</TableCell>
                            <TableCell>{formatCurrency(expense.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'membres-individuels' && (
            <Card>
              <CardHeader>
                <CardTitle>Membres Individuels</CardTitle>
                <CardDescription>Total: {membres.length} membre(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {membres.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun membre individuel</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Prénom</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Adresse</TableHead>
                          <TableHead>Date Création</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {membres.map((membre) => (
                          <TableRow key={membre.membre_id}>
                            <TableCell className="font-medium">{membre.membre_id}</TableCell>
                            <TableCell>{membre.nom}</TableCell>
                            <TableCell>{membre.prenom}</TableCell>
                            <TableCell>{membre.telephone || '-'}</TableCell>
                            <TableCell>{membre.adresse || '-'}</TableCell>
                            <TableCell>{formatDate(membre.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'membres-groupe' && (
            <Card>
              <CardHeader>
                <CardTitle>Membres de Groupe</CardTitle>
                <CardDescription>Total: {membreGroups.length} groupe(s), {groupMembres.length} membre(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {membreGroups.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun groupe</p>
                ) : (
                  <div className="space-y-4">
                    {membreGroups.map((group) => (
                      <Card key={group.id}>
                        <CardHeader>
                          <CardTitle>{group.group_name}</CardTitle>
                          <CardDescription>{group.description || 'Pas de description'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {group.members && group.members.length > 0 ? (
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Nom</TableHead>
                                    <TableHead>Prénom</TableHead>
                                    <TableHead>Téléphone</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.members.map((membre: Membre) => (
                                    <TableRow key={membre.membre_id}>
                                      <TableCell className="font-medium">{membre.membre_id}</TableCell>
                                      <TableCell>{membre.nom}</TableCell>
                                      <TableCell>{membre.prenom}</TableCell>
                                      <TableCell>{membre.telephone || '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">Aucun membre dans ce groupe</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'chefs-zone' && (
            <Card>
              <CardHeader>
                <CardTitle>Chefs de Zone et Membres Assignés</CardTitle>
                <CardDescription>
                  {Object.keys(chefZoneMembres).length} chef(s) de zone avec membres assignés
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(chefZoneMembres).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun chef de zone avec membres assignés</p>
                ) : (
                  <div className="space-y-4">
                    {chefsZone.map((chef) => {
                      const membresAssignes = chefZoneMembres[chef.id] || []
                      if (membresAssignes.length === 0) return null
                      
                      return (
                        <Card key={chef.id}>
                          <CardHeader>
                            <CardTitle>{chef.prenom} {chef.nom}</CardTitle>
                            <CardDescription>Chef de Zone - {membresAssignes.length} membre(s) assigné(s)</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Nom</TableHead>
                                    <TableHead>Prénom</TableHead>
                                    <TableHead>Téléphone</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {membresAssignes.map((membre) => (
                                    <TableRow key={membre.membre_id}>
                                      <TableCell className="font-medium">{membre.membre_id}</TableCell>
                                      <TableCell>{membre.nom}</TableCell>
                                      <TableCell>{membre.prenom}</TableCell>
                                      <TableCell>{membre.telephone || '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'garanties' && (
            <Card>
              <CardHeader>
                <CardTitle>Garanties</CardTitle>
                <CardDescription>
                  Total: {collaterals.length} garantie(s) | 
                  Montant total déposé: {formatCurrency(collaterals.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {collaterals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucune garantie</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prêt</TableHead>
                          <TableHead>Membre</TableHead>
                          <TableHead>Montant Requis</TableHead>
                          <TableHead>Montant Déposé</TableHead>
                          <TableHead>Montant Restant</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collaterals.map((collateral) => {
                          const membre = [...membres, ...groupMembres].find(m => m.membre_id === collateral.membre_id)
                          const pretId = collateral.pret_id || collateral.group_pret_id || '-'
                          return (
                            <TableRow key={collateral.id}>
                              <TableCell className="font-medium">{pretId}</TableCell>
                              <TableCell>
                                {membre ? `${membre.prenom} ${membre.nom}` : collateral.membre_id}
                              </TableCell>
                              <TableCell>{formatCurrency(collateral.montant_requis)}</TableCell>
                              <TableCell>{formatCurrency(collateral.montant_depose)}</TableCell>
                              <TableCell>{formatCurrency(collateral.montant_restant || 0)}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  collateral.statut === 'complet' ? 'default' :
                                  collateral.statut === 'partiel' ? 'secondary' : 'outline'
                                }>
                                  {collateral.statut}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'epargnes' && (
            <Card>
              <CardHeader>
                <CardTitle>Épargnes</CardTitle>
                <CardDescription>
                  Total: {formatCurrency(epargneTransactions.reduce((sum, t) => {
                    return sum + (t.type === 'depot' ? Number(t.montant || 0) : -Number(t.montant || 0))
                  }, 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {epargneTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucune transaction d'épargne</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Membre</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {epargneTransactions.map((transaction) => {
                          const membre = [...membres, ...groupMembres].find(m => m.membre_id === transaction.membre_id)
                          return (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDate(transaction.date_operation)}</TableCell>
                              <TableCell>
                                {membre ? `${membre.prenom} ${membre.nom}` : transaction.membre_id}
                              </TableCell>
                              <TableCell>
                                <Badge variant={transaction.type === 'depot' ? 'default' : 'destructive'}>
                                  {transaction.type === 'depot' ? 'Dépôt' : 'Retrait'}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(transaction.montant)}</TableCell>
                              <TableCell>{transaction.notes || '-'}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'impayes' && (
            <Card>
              <CardHeader>
                <CardTitle>Impayés</CardTitle>
                <CardDescription>
                  Total: {impayes.length} impayé(s) | 
                  Montant total: {formatCurrency(impayes.reduce((sum, i) => sum + i.montant, 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {impayes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun impayé</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prêt</TableHead>
                          <TableHead>Membre</TableHead>
                          <TableHead>Numéro</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Date Échéance</TableHead>
                          <TableHead>Jours de Retard</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {impayes.map((impaye, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{impaye.pretId}</TableCell>
                            <TableCell>{impaye.membreName}</TableCell>
                            <TableCell>{impaye.numero}</TableCell>
                            <TableCell>{formatCurrency(impaye.montant)}</TableCell>
                            <TableCell>{formatDate(impaye.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant={impaye.daysLate > 30 ? 'destructive' : 'secondary'}>
                                {impaye.daysLate} jour(s)
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                impaye.statut === 'en_retard' ? 'destructive' :
                                impaye.statut === 'paye_partiel' ? 'secondary' : 'outline'
                              }>
                                {impaye.statut}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{impaye.type}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'pnl' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Intérêts Collectés</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(pnlStats.interestCollected)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dépenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {formatCurrency(pnlStats.totalExpenses)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Net (Avant Commission)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${pnlStats.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(pnlStats.net)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Commission ({Math.round(pnlStats.commissionRate * 100)}%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {formatCurrency(pnlStats.commission)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Net (Après Commission)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${pnlStats.netAfterCommission >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(pnlStats.netAfterCommission)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function AgentDetailsPage() {
  return (
    <ProtectedRoute requiredPermission="canViewAll">
      <AgentDetailsPageContent />
    </ProtectedRoute>
  )
}

