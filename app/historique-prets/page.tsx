'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Pret, type GroupPret, type Membre, type Agent, type UserProfile } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { History as HistoryIcon, Search, Loader2, RefreshCcw, User, Users, CreditCard, Calendar, DollarSign } from 'lucide-react'

type LoanHistoryItem = {
  pret_id: string
  type: 'individuel' | 'groupe'
  membre_id?: string
  membre_nom?: string
  membre_prenom?: string
  group_id?: number
  group_name?: string
  agent_id: string
  agent_nom?: string
  agent_prenom?: string
  montant_pret: number
  capital_restant: number
  nombre_remboursements: number
  frequence_remboursement: string
  date_decaissement: string
  date_premier_remboursement: string
  statut: string
  created_at: string
  updated_at: string
}

function HistoriquePretsContent() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [groups, setGroups] = useState<Array<{ id: number; group_name: string; agent_id: string }>>([])
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadData()
    }
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

  async function loadData(showRefreshing = false) {
    if (!userProfile) return

    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      // Charger les agents du manager si nécessaire
      let managerAgentIds: string[] | null = null
      if (userProfile.role === 'manager') {
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError
        managerAgentIds = managerAgents?.map(a => a.agent_id) || []
        if (managerAgentIds.length === 0) {
          setPrets([])
          setGroupPrets([])
          setMembres([])
          setAgents([])
          setGroups([])
          return
        }
      }

      // Charger tous les prêts (tous les statuts)
      let pretsQuery = supabase
        .from('prets')
        .select('*')
        .order('created_at', { ascending: false })

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        pretsQuery = pretsQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager' && managerAgentIds) {
        pretsQuery = pretsQuery.in('agent_id', managerAgentIds)
      }

      // Charger tous les prêts de groupe (tous les statuts)
      let groupPretsQuery = supabase
        .from('group_prets')
        .select('*')
        .order('created_at', { ascending: false })

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        groupPretsQuery = groupPretsQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager' && managerAgentIds) {
        groupPretsQuery = groupPretsQuery.in('agent_id', managerAgentIds)
      }

      // Charger les membres
      let membresQuery = supabase
        .from('membres')
        .select('*')
        .order('membre_id', { ascending: true })

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        membresQuery = membresQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager' && managerAgentIds) {
        membresQuery = membresQuery.in('agent_id', managerAgentIds)
      }

      // Charger les agents
      let agentsQuery = supabase.from('agents').select('*').order('agent_id', { ascending: true })
      if (userProfile.role === 'manager' && managerAgentIds) {
        agentsQuery = agentsQuery.in('agent_id', managerAgentIds)
      }

      // Charger les groupes
      let groupsQuery = supabase
        .from('membre_groups')
        .select('id, group_name, agent_id')
        .order('group_name', { ascending: true })

      if (userProfile.role === 'agent' && userProfile.agent_id) {
        groupsQuery = groupsQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile.role === 'manager' && managerAgentIds) {
        groupsQuery = groupsQuery.in('agent_id', managerAgentIds)
      }

      const [pretsRes, groupPretsRes, membresRes, agentsRes, groupsRes] = await Promise.all([
        pretsQuery,
        groupPretsQuery,
        membresQuery,
        agentsQuery,
        groupsQuery,
      ])

      if (pretsRes.error) throw pretsRes.error
      if (membresRes.error) throw membresRes.error
      if (agentsRes.error) throw agentsRes.error

      setPrets(pretsRes.data || [])
      setGroupPrets(groupPretsRes.data || [])
      setMembres(membresRes.data || [])
      setAgents(agentsRes.data || [])
      setGroups(groupsRes.data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
      alert('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Combiner les prêts individuels et de groupe en un seul tableau
  const loanHistory: LoanHistoryItem[] = useMemo(() => {
    const membreMap = new Map(membres.map(m => [m.membre_id, m]))
    const agentMap = new Map(agents.map(a => [a.agent_id, a]))
    const groupMap = new Map(groups.map(g => [g.id, g]))

    const individualLoans: LoanHistoryItem[] = prets.map(pret => {
      const membre = membreMap.get(pret.membre_id)
      const agent = agentMap.get(pret.agent_id)
      return {
        pret_id: pret.pret_id,
        type: 'individuel' as const,
        membre_id: pret.membre_id,
        membre_nom: membre?.nom,
        membre_prenom: membre?.prenom,
        agent_id: pret.agent_id,
        agent_nom: agent?.nom,
        agent_prenom: agent?.prenom,
        montant_pret: pret.montant_pret,
        capital_restant: pret.capital_restant || 0,
        nombre_remboursements: pret.nombre_remboursements,
        frequence_remboursement: pret.frequence_remboursement || 'journalier',
        date_decaissement: pret.date_decaissement,
        date_premier_remboursement: pret.date_premier_remboursement,
        statut: pret.statut,
        created_at: pret.created_at,
        updated_at: pret.updated_at,
      }
    })

    const groupLoans: LoanHistoryItem[] = groupPrets.map(groupPret => {
      const agent = agentMap.get(groupPret.agent_id)
      const group = groupMap.get(groupPret.group_id)
      return {
        pret_id: groupPret.pret_id,
        type: 'groupe' as const,
        group_id: groupPret.group_id,
        group_name: group?.group_name,
        agent_id: groupPret.agent_id,
        agent_nom: agent?.nom,
        agent_prenom: agent?.prenom,
        montant_pret: groupPret.montant_pret,
        capital_restant: groupPret.capital_restant,
        nombre_remboursements: groupPret.nombre_remboursements,
        frequence_remboursement: groupPret.frequence_remboursement,
        date_decaissement: groupPret.date_decaissement,
        date_premier_remboursement: groupPret.date_premier_remboursement,
        statut: groupPret.statut,
        created_at: groupPret.created_at,
        updated_at: groupPret.updated_at,
      }
    })

    return [...individualLoans, ...groupLoans].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateB - dateA
    })
  }, [prets, groupPrets, membres, agents, groups])

  // Filtrer les prêts selon la recherche et les filtres
  const filteredLoans = useMemo(() => {
    let filtered = loanHistory

    // Filtre par statut
    if (filterStatut !== 'all') {
      filtered = filtered.filter(loan => loan.statut === filterStatut)
    }

    // Filtre par type
    if (filterType !== 'all') {
      filtered = filtered.filter(loan => loan.type === filterType)
    }

    // Filtre par recherche
    if (activeSearch.trim()) {
      const searchTerm = activeSearch.toLowerCase().trim()
      filtered = filtered.filter(loan => {
        const membreNom = loan.membre_nom ? loan.membre_nom.toLowerCase() : ''
        const membrePrenom = loan.membre_prenom ? loan.membre_prenom.toLowerCase() : ''
        const membreId = loan.membre_id ? loan.membre_id.toLowerCase() : ''
        const agentNom = loan.agent_nom ? loan.agent_nom.toLowerCase() : ''
        const agentPrenom = loan.agent_prenom ? loan.agent_prenom.toLowerCase() : ''
        const agentId = loan.agent_id ? loan.agent_id.toLowerCase() : ''
        const groupName = loan.group_name ? loan.group_name.toLowerCase() : ''
        const pretId = loan.pret_id.toLowerCase()
        const statut = loan.statut.toLowerCase()

        return (
          pretId.includes(searchTerm) ||
          membreId.includes(searchTerm) ||
          membreNom.includes(searchTerm) ||
          membrePrenom.includes(searchTerm) ||
          agentId.includes(searchTerm) ||
          agentNom.includes(searchTerm) ||
          agentPrenom.includes(searchTerm) ||
          groupName.includes(searchTerm) ||
          statut.includes(searchTerm)
        )
      })
    }

    return filtered
  }, [loanHistory, filterStatut, filterType, activeSearch])

  const handleSearch = () => {
    setActiveSearch(searchInput)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      actif: 'default',
      termine: 'secondary',
      annule: 'destructive',
      en_attente_approbation: 'outline',
      en_attente_garantie: 'outline',
    }
    const labels: Record<string, string> = {
      actif: 'Actif',
      termine: 'Terminé',
      annule: 'Rejeté',
      en_attente_approbation: 'En attente d\'approbation',
      en_attente_garantie: 'En attente de garantie',
    }
    return (
      <Badge variant={variants[statut] || 'outline'}>
        {labels[statut] || statut}
      </Badge>
    )
  }

  const stats = useMemo(() => {
    const total = loanHistory.length
    const actifs = loanHistory.filter(l => l.statut === 'actif').length
    const termines = loanHistory.filter(l => l.statut === 'termine').length
    const annules = loanHistory.filter(l => l.statut === 'annule').length
    const enAttente = loanHistory.filter(l => l.statut === 'en_attente_approbation' || l.statut === 'en_attente_garantie').length
    const montantTotal = loanHistory.reduce((sum, l) => sum + l.montant_pret, 0)
    const capitalRestant = loanHistory.reduce((sum, l) => sum + l.capital_restant, 0)

    return {
      total,
      actifs,
      termines,
      annules,
      enAttente,
      montantTotal,
      capitalRestant,
    }
  }, [loanHistory])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  if (!userProfile || !['admin', 'manager', 'agent'].includes(userProfile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Accès non autorisé</div>
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={() => router.push('/login')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historique des Prêts</h1>
            <p className="text-muted-foreground mt-2">
              Consultation de l'historique complet de tous les prêts (individuels et de groupe)
            </p>
          </div>
          <Button onClick={() => loadData(true)} variant="outline" disabled={refreshing}>
            {refreshing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Actualisation...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Actualiser
              </>
            )}
          </Button>
        </div>

        {/* Statistiques */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Prêts</CardTitle>
              <HistoryIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actifs</CardTitle>
              <CreditCard className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.actifs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminés</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.termines}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.montantTotal)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Liste des Prêts</CardTitle>
                <CardDescription className="mt-2">
                  Historique complet de tous les prêts (individuels et de groupe)
                </CardDescription>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher par ID prêt/membre/agent/groupe/statut..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full"
                />
              </div>
              <Button onClick={handleSearch} variant="default">
                <Search className="w-4 h-4 mr-2" />
                Recherche
              </Button>
              <div className="flex gap-2">
                <Select value={filterStatut} onValueChange={setFilterStatut}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="termine">Terminé</SelectItem>
                    <SelectItem value="annule">Rejeté</SelectItem>
                    <SelectItem value="en_attente_approbation">En attente d'approbation</SelectItem>
                    <SelectItem value="en_attente_garantie">En attente de garantie</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filtrer par type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="individuel">Individuel</SelectItem>
                    <SelectItem value="groupe">Groupe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {activeSearch && (
              <CardDescription className="mt-2">
                {filteredLoans.length} prêt(s) trouvé(s) sur {loanHistory.length}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {filteredLoans.length === 0 ? (
              <div className="py-10 text-center">
                <HistoryIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">
                  Aucun prêt trouvé
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Prêt</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Membre/Groupe</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Capital Restant</TableHead>
                      <TableHead>Échéances</TableHead>
                      <TableHead>Date Décaissement</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date Création</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => (
                      <TableRow key={`${loan.type}-${loan.pret_id}`}>
                        <TableCell className="font-medium">{loan.pret_id}</TableCell>
                        <TableCell>
                          <Badge variant={loan.type === 'individuel' ? 'default' : 'secondary'}>
                            {loan.type === 'individuel' ? (
                              <>
                                <User className="w-3 h-3 mr-1" />
                                Individuel
                              </>
                            ) : (
                              <>
                                <Users className="w-3 h-3 mr-1" />
                                Groupe
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {loan.type === 'individuel' ? (
                            <div>
                              <div className="font-medium">
                                {loan.membre_prenom} {loan.membre_nom}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {loan.membre_id}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{loan.group_name || 'Groupe'}</div>
                              <div className="text-sm text-muted-foreground">
                                ID: {loan.group_id}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {loan.agent_prenom} {loan.agent_nom}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {loan.agent_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(loan.montant_pret)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(loan.capital_restant)}
                        </TableCell>
                        <TableCell>
                          {loan.nombre_remboursements} ({loan.frequence_remboursement})
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(loan.date_decaissement)}
                          </div>
                        </TableCell>
                        <TableCell>{getStatutBadge(loan.statut)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(loan.created_at)}
                          </div>
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

export default function HistoriquePretsPage() {
  return (
    <ProtectedRoute>
      <HistoriquePretsContent />
    </ProtectedRoute>
  )
}

