'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Collateral, type Membre, type Agent, type Pret, type GroupPret, type UserProfile } from '@/lib/supabase'
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
import { Shield, Search, Loader2, RefreshCcw, User, Users, CreditCard, Calendar, DollarSign, FileText } from 'lucide-react'

type CollateralHistoryItem = Collateral & {
  membre_nom?: string
  membre_prenom?: string
  pret_montant?: number
  pret_statut?: string
  group_pret_montant?: number
  group_pret_statut?: string
  agent_nom?: string
  agent_prenom?: string
}

function HistoriqueCollateralsContent() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [collaterals, setCollaterals] = useState<Collateral[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterMembre, setFilterMembre] = useState<string>('all')
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
      // Charger les collaterals
      const { data: collateralsData, error: collateralsError } = await supabase
        .from('collaterals')
        .select('*')
        .order('created_at', { ascending: false })

      if (collateralsError) {
        console.error('Erreur chargement collaterals:', collateralsError)
      } else {
        setCollaterals(collateralsData || [])
      }

      // Charger les membres
      const { data: membresData, error: membresError } = await supabase
        .from('membres')
        .select('*')

      if (membresError) {
        console.error('Erreur chargement membres:', membresError)
      } else {
        setMembres((membresData || []) as Membre[])
      }

      // Charger les agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('*')

      if (agentsError) {
        console.error('Erreur chargement agents:', agentsError)
      } else {
        setAgents((agentsData || []) as Agent[])
      }

      // Charger les prêts individuels
      const { data: pretsData, error: pretsError } = await supabase
        .from('prets')
        .select('*')

      if (pretsError) {
        console.error('Erreur chargement prets:', pretsError)
      } else {
        setPrets((pretsData || []) as Pret[])
      }

      // Charger les prêts de groupe
      const { data: groupPretsData, error: groupPretsError } = await supabase
        .from('group_prets')
        .select('*')

      if (groupPretsError) {
        console.error('Erreur chargement group_prets:', groupPretsError)
      } else {
        setGroupPrets((groupPretsData || []) as GroupPret[])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const enrichedCollaterals = useMemo(() => {
    return collaterals.map(collateral => {
      const membre = membres.find(m => m.membre_id === collateral.membre_id)
      const pret = collateral.pret_id ? prets.find(p => p.pret_id === collateral.pret_id) : null
      const groupPret = collateral.group_pret_id ? groupPrets.find(gp => gp.pret_id === collateral.group_pret_id) : null
      
      let agent: Agent | undefined
      if (pret) {
        agent = agents.find(a => a.agent_id === pret.agent_id)
      } else if (groupPret) {
        agent = agents.find(a => a.agent_id === groupPret.agent_id)
      }

      return {
        ...collateral,
        membre_nom: membre?.nom,
        membre_prenom: membre?.prenom,
        pret_montant: pret?.montant_pret,
        pret_statut: pret?.statut,
        group_pret_montant: groupPret?.montant_pret,
        group_pret_statut: groupPret?.statut,
        agent_nom: agent?.nom,
        agent_prenom: agent?.prenom,
      } as CollateralHistoryItem
    })
  }, [collaterals, membres, agents, prets, groupPrets])

  const filteredCollaterals = useMemo(() => {
    let filtered = enrichedCollaterals

    // Filtre par statut
    if (filterStatut !== 'all') {
      filtered = filtered.filter(c => c.statut === filterStatut)
    }

    // Filtre par type (individuel ou groupe)
    if (filterType !== 'all') {
      if (filterType === 'individuel') {
        filtered = filtered.filter(c => c.pret_id !== null && !c.group_pret_id)
      } else if (filterType === 'groupe') {
        filtered = filtered.filter(c => c.group_pret_id !== null)
      }
    }

    // Filtre par membre
    if (filterMembre !== 'all') {
      filtered = filtered.filter(c => c.membre_id === filterMembre)
    }

    // Recherche
    if (activeSearch.trim()) {
      const searchLower = activeSearch.toLowerCase()
      filtered = filtered.filter(c => {
        const membreName = `${c.membre_prenom || ''} ${c.membre_nom || ''}`.toLowerCase()
        const agentName = `${c.agent_prenom || ''} ${c.agent_nom || ''}`.toLowerCase()
        const pretId = c.pret_id || ''
        const groupPretId = c.group_pret_id || ''
        
        return (
          membreName.includes(searchLower) ||
          agentName.includes(searchLower) ||
          pretId.toLowerCase().includes(searchLower) ||
          groupPretId.toLowerCase().includes(searchLower) ||
          c.membre_id.toLowerCase().includes(searchLower)
        )
      })
    }

    return filtered
  }, [enrichedCollaterals, filterStatut, filterType, filterMembre, activeSearch])

  const stats = useMemo(() => {
    const total = filteredCollaterals.length
    const complet = filteredCollaterals.filter(c => c.statut === 'complet').length
    const partiel = filteredCollaterals.filter(c => c.statut === 'partiel').length
    const rembourse = filteredCollaterals.filter(c => c.statut === 'rembourse').length
    const totalMontantDepose = filteredCollaterals.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0)
    const totalMontantRequis = filteredCollaterals.reduce((sum, c) => sum + Number(c.montant_requis || 0), 0)

    return {
      total,
      complet,
      partiel,
      rembourse,
      totalMontantDepose,
      totalMontantRequis,
    }
  }, [filteredCollaterals])

  function getStatutBadgeVariant(statut: string) {
    switch (statut) {
      case 'complet':
        return 'default' // Vert
      case 'partiel':
        return 'secondary' // Jaune/Orange
      case 'rembourse':
        return 'outline' // Gris
      default:
        return 'secondary'
    }
  }

  function getStatutLabel(statut: string) {
    switch (statut) {
      case 'complet':
        return 'Complet'
      case 'partiel':
        return 'Partiel'
      case 'rembourse':
        return 'Remboursé'
      default:
        return statut
    }
  }

  if (loading || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={signOut}>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Historique des Collaterals
            </h1>
            <p className="text-muted-foreground mt-1">
              Consultez l'historique complet de toutes les garanties (collaterals)
            </p>
          </div>
          <Button
            onClick={() => loadData(true)}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Statistiques */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collaterals</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Complets</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.complet}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partiels</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.partiel}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Montant Total Déposé</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalMontantDepose)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requis: {formatCurrency(stats.totalMontantRequis)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtres et recherche */}
        <Card>
          <CardHeader>
            <CardTitle>Filtres et Recherche</CardTitle>
            <CardDescription>
              Filtrez et recherchez dans l'historique des collaterals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search">Recherche</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Membre, agent, prêt..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setActiveSearch(searchInput)
                      }
                    }}
                    className="pl-8"
                  />
                </div>
                <Button
                  onClick={() => setActiveSearch(searchInput)}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  Rechercher
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-statut">Statut</Label>
                <Select value={filterStatut} onValueChange={setFilterStatut}>
                  <SelectTrigger id="filter-statut">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="complet">Complet</SelectItem>
                    <SelectItem value="partiel">Partiel</SelectItem>
                    <SelectItem value="rembourse">Remboursé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-type">Type de Prêt</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger id="filter-type">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="individuel">Individuel</SelectItem>
                    <SelectItem value="groupe">Groupe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-membre">Membre</Label>
                <Select value={filterMembre} onValueChange={setFilterMembre}>
                  <SelectTrigger id="filter-membre">
                    <SelectValue placeholder="Tous les membres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les membres</SelectItem>
                    {membres.map(membre => (
                      <SelectItem key={membre.membre_id} value={membre.membre_id}>
                        {membre.prenom} {membre.nom} ({membre.membre_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tableau des collaterals */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Collaterals</CardTitle>
            <CardDescription>
              {filteredCollaterals.length} collateral(s) trouvé(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCollaterals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun collateral trouvé avec les filtres sélectionnés.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Membre</TableHead>
                      <TableHead>Type Prêt</TableHead>
                      <TableHead>Prêt ID</TableHead>
                      <TableHead>Montant Requis</TableHead>
                      <TableHead>Montant Déposé</TableHead>
                      <TableHead>Montant Restant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date Dépot</TableHead>
                      <TableHead>Date Remboursement</TableHead>
                      <TableHead>Agent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCollaterals.map((collateral) => (
                      <TableRow key={collateral.id}>
                        <TableCell className="font-mono text-xs">
                          {collateral.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {collateral.membre_prenom} {collateral.membre_nom}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {collateral.membre_id}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {collateral.group_pret_id ? (
                            <Badge variant="secondary">
                              <Users className="h-3 w-3 mr-1" />
                              Groupe
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <User className="h-3 w-3 mr-1" />
                              Individuel
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {collateral.group_pret_id || collateral.pret_id || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(collateral.montant_requis)}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(collateral.montant_depose)}
                        </TableCell>
                        <TableCell className="font-medium text-orange-600">
                          {formatCurrency(collateral.montant_restant)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatutBadgeVariant(collateral.statut)}>
                            {getStatutLabel(collateral.statut)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {collateral.date_depot ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(collateral.date_depot)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {collateral.date_remboursement ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(collateral.date_remboursement)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {collateral.agent_prenom && collateral.agent_nom ? (
                            <div>
                              <div className="font-medium">
                                {collateral.agent_prenom} {collateral.agent_nom}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
      </div>
    </DashboardLayout>
  )
}

export default function HistoriqueCollateralsPage() {
  return (
    <ProtectedRoute requiredRole={['admin', 'manager', 'agent']}>
      <HistoriqueCollateralsContent />
    </ProtectedRoute>
  )
}

