'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Membre, type Pret, type Collateral, type Remboursement, type UserProfile, type ChefZoneMembre, type GroupPret } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Wallet, PiggyBank, CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, DollarSign, UserPlus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function MembresAssignesContent() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [membres, setMembres] = useState<Membre[]>([])
  const [membresDetails, setMembresDetails] = useState<Record<string, {
    garantie: number
    epargne: number
    pretActif: number
    echeancier: Remboursement[]
  }>>({})
  const [selectedMembre, setSelectedMembre] = useState<Membre | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [epargneTransactions, setEpargneTransactions] = useState<any[]>([])
  const [memberGroupInfo, setMemberGroupInfo] = useState<{ group_name: string; group_id: number } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadMembresAssignes()
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

  async function loadMembresAssignes() {
    if (!userProfile || userProfile.role !== 'chef_zone') return

    try {
      setLoading(true)
      
      // Charger les membres assignés au chef de zone
      const { data: assignations, error: assignationsError } = await supabase
        .from('chef_zone_membres')
        .select('membre_id')
        .eq('chef_zone_id', userProfile.id)

      if (assignationsError) throw assignationsError

      const membreIds = assignations?.map(a => a.membre_id) || []
      
      if (membreIds.length === 0) {
        setMembres([])
        setLoading(false)
        return
      }

      // Charger les détails des membres
      const { data: membresData, error: membresError } = await supabase
        .from('membres')
        .select('*')
        .in('membre_id', membreIds)

      if (membresError) throw membresError
      setMembres(membresData || [])

      // Charger les détails pour chaque membre
      await loadMembresDetails(membreIds)
    } catch (error) {
      console.error('Erreur lors du chargement des membres assignés:', error)
      alert('Erreur lors du chargement des membres assignés')
    } finally {
      setLoading(false)
    }
  }

  async function loadMembresDetails(membreIds: string[]) {
    const details: Record<string, {
      garantie: number
      epargne: number
      pretActif: number
      echeancier: Remboursement[]
    }> = {}

    // Charger les groupes qui contiennent les membres assignés
    const { data: groupMembersData } = await supabase
      .from('membre_group_members')
      .select('group_id, membre_id')
      .in('membre_id', membreIds)

    const groupIds = [...new Set((groupMembersData || []).map(gm => gm.group_id))]

    // Charger les prêts de groupe actifs pour ces groupes
    let groupPretsMap: Record<string, any[]> = {}
    if (groupIds.length > 0) {
      const { data: groupPretsData } = await supabase
        .from('group_prets')
        .select('pret_id, montant_pret, capital_restant, group_id')
        .in('group_id', groupIds)
        .eq('statut', 'actif') // Seulement les prêts actifs

      if (groupPretsData) {
        // Créer un map par membre_id pour les prêts de groupe
        for (const groupMember of groupMembersData || []) {
          const groupPret = groupPretsData.find(gp => gp.group_id === groupMember.group_id)
          if (groupPret) {
            if (!groupPretsMap[groupMember.membre_id]) {
              groupPretsMap[groupMember.membre_id] = []
            }
            groupPretsMap[groupMember.membre_id].push(groupPret)
          }
        }
      }
    }

    for (const membreId of membreIds) {
      // Charger les prêts actifs individuels d'abord pour obtenir les pret_ids
      const { data: pretsActifs } = await supabase
        .from('prets')
        .select('pret_id, montant_pret, capital_restant')
        .eq('membre_id', membreId)
        .eq('statut', 'actif') // Seulement les prêts actifs

      const pretIds = (pretsActifs || []).map(p => p.pret_id)
      
      // Charger les garanties (collaterals) seulement pour les prêts actifs
      let garantieTotal = 0
      if (pretIds.length > 0) {
        const { data: collaterals } = await supabase
          .from('collaterals')
          .select('montant')
          .in('pret_id', pretIds)
          .is('group_pret_id', null) // Seulement les garanties pour prêts individuels

        garantieTotal = (collaterals || []).reduce((sum, c) => sum + Number(c.montant || 0), 0)
      }

      // Ajouter les garanties pour les prêts de groupe actifs
      const memberGroupPrets = groupPretsMap[membreId] || []
      if (memberGroupPrets.length > 0) {
        const groupPretIds = memberGroupPrets.map(gp => gp.pret_id)
        const { data: groupCollaterals } = await supabase
          .from('collaterals')
          .select('montant')
          .in('group_pret_id', groupPretIds)
          .eq('membre_id', membreId)

        garantieTotal += (groupCollaterals || []).reduce((sum, c) => sum + Number(c.montant || 0), 0)
      }

      // Charger les épargnes (toutes les transactions sont pertinentes)
      const { data: epargnes } = await supabase
        .from('epargne_transactions')
        .select('type, montant')
        .eq('membre_id', membreId)

      const epargneTotal = (epargnes || []).reduce((sum, t) => {
        const montant = Number(t.montant || 0)
        return sum + (t.type === 'depot' ? montant : -montant)
      }, 0)

      // Calculer le total des prêts actifs (individuels + groupe)
      const pretActifTotal = 
        (pretsActifs || []).reduce((sum, p) => {
          return sum + Number(p.capital_restant || p.montant_pret || 0)
        }, 0) +
        memberGroupPrets.reduce((sum, p) => {
          return sum + Number(p.capital_restant || p.montant_pret || 0)
        }, 0)

      // Charger l'échéancier (remboursements en attente ou en retard seulement)
      let echeancier: Remboursement[] = []
      
      // Remboursements pour prêts individuels actifs
      if (pretIds.length > 0) {
        const { data: remboursements } = await supabase
          .from('remboursements')
          .select('*')
          .in('pret_id', pretIds)
          .in('statut', ['en_attente', 'en_retard']) // Seulement en attente ou en retard
          .order('date_remboursement', { ascending: true })

        echeancier = remboursements || []
      }

      // Remboursements pour prêts de groupe actifs
      if (memberGroupPrets.length > 0) {
        const groupPretIds = memberGroupPrets.map(gp => gp.pret_id)
        const { data: groupRemboursements } = await supabase
          .from('group_remboursements')
          .select('*')
          .in('pret_id', groupPretIds)
          .eq('membre_id', membreId)
          .in('statut', ['en_attente', 'en_retard']) // Seulement en attente ou en retard
          .order('date_remboursement', { ascending: true })

        if (groupRemboursements) {
          echeancier = [...echeancier, ...groupRemboursements]
        }
      }

      // Trier l'échéancier par date
      echeancier.sort((a, b) => {
        const dateA = new Date(a.date_remboursement).getTime()
        const dateB = new Date(b.date_remboursement).getTime()
        return dateA - dateB
      })

      details[membreId] = {
        garantie: garantieTotal,
        epargne: epargneTotal,
        pretActif: pretActifTotal,
        echeancier,
      }
    }

    setMembresDetails(details)
  }

  // Fonction helper pour calculer les jours de retard
  function calculateDaysOverdue(dateRemboursement: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateRemb = new Date(dateRemboursement)
    dateRemb.setHours(0, 0, 0, 0)
    
    if (dateRemb >= today) return 0
    
    const diffTime = today.getTime() - dateRemb.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  async function handleViewDetails(membre: Membre) {
    setSelectedMembre(membre)
    setShowDetails(true)
    setLoadingDetails(true)
    
    try {
      // Charger les transactions d'épargne détaillées
      const { data: transactions, error: transactionsError } = await supabase
        .from('epargne_transactions')
        .select('*')
        .eq('membre_id', membre.membre_id)
        .order('date_operation', { ascending: false })

      if (transactionsError) throw transactionsError
      setEpargneTransactions(transactions || [])

      // Vérifier si le membre est dans un groupe
      const { data: groupMember, error: groupMemberError } = await supabase
        .from('membre_group_members')
        .select('group_id, membre_groups!inner(group_name)')
        .eq('membre_id', membre.membre_id)
        .limit(1)
        .single()

      if (groupMemberError && groupMemberError.code !== 'PGRST116') {
        console.error('Erreur lors du chargement du groupe:', groupMemberError)
      }

      if (groupMember && (groupMember as any).membre_groups) {
        setMemberGroupInfo({
          group_name: (groupMember as any).membre_groups.group_name,
          group_id: groupMember.group_id,
        })
      } else {
        setMemberGroupInfo(null)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  if (!userProfile || userProfile.role !== 'chef_zone') {
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
            <h1 className="text-3xl font-bold tracking-tight">Membres Assignés</h1>
            <p className="text-muted-foreground mt-2">
              Liste des membres qui vous sont assignés avec leurs détails financiers
            </p>
          </div>
        </div>

        {membres.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Aucun membre ne vous est actuellement assigné
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Membres</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{membres.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Garanties</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      Object.values(membresDetails).reduce((sum, d) => sum + d.garantie, 0)
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Épargnes</CardTitle>
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      Object.values(membresDetails).reduce((sum, d) => sum + d.epargne, 0)
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prêts Actifs</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      Object.values(membresDetails).reduce((sum, d) => sum + d.pretActif, 0)
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Liste des Membres</CardTitle>
                <CardDescription>
                  Cliquez sur "Voir détails" pour voir toutes les informations financières d'un membre
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Membre</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Garantie</TableHead>
                      <TableHead>Épargne</TableHead>
                      <TableHead>Prêt Actif</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membres.map((membre) => {
                      const details = membresDetails[membre.membre_id] || {
                        garantie: 0,
                        epargne: 0,
                        pretActif: 0,
                        echeancier: [],
                      }
                      return (
                        <TableRow key={membre.membre_id}>
                          <TableCell className="font-medium">{membre.membre_id}</TableCell>
                          <TableCell>{membre.nom || '-'}</TableCell>
                          <TableCell>{membre.prenom || '-'}</TableCell>
                          <TableCell>{formatCurrency(details.garantie)}</TableCell>
                          <TableCell>{formatCurrency(details.epargne)}</TableCell>
                          <TableCell>{formatCurrency(details.pretActif)}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(membre)}
                            >
                              Voir détails
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Modal de détails */}
        {showDetails && selectedMembre && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      Détails - {selectedMembre.prenom} {selectedMembre.nom} ({selectedMembre.membre_id})
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Informations financières complètes du membre
                    </CardDescription>
                  </div>
                  <Button variant="ghost" onClick={() => {
                    setShowDetails(false)
                    setEpargneTransactions([])
                    setMemberGroupInfo(null)
                  }}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingDetails ? (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground">Chargement des détails...</div>
                  </div>
                ) : (
                  <>
                    {/* Informations sur le type de membre */}
                    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                      <Badge variant={memberGroupInfo ? 'default' : 'secondary'} className="text-sm">
                        {memberGroupInfo ? (
                          <>
                            <Users className="w-4 h-4 mr-1" />
                            Membre de groupe
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-1" />
                            Membre individuel
                          </>
                        )}
                      </Badge>
                      {memberGroupInfo && (
                        <span className="text-sm text-muted-foreground">
                          Groupe: <strong>{memberGroupInfo.group_name}</strong>
                        </span>
                      )}
                    </div>

                    {/* Cartes de résumé */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Garantie Totale</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(membresDetails[selectedMembre.membre_id]?.garantie || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Épargne Totale</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(membresDetails[selectedMembre.membre_id]?.epargne || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Prêt Actif</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(membresDetails[selectedMembre.membre_id]?.pretActif || 0)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Informations sur les remboursements */}
                    {(() => {
                      const echeancier = membresDetails[selectedMembre.membre_id]?.echeancier || []
                      const remboursementsEnAttente = echeancier.filter(r => r.statut === 'en_attente' || r.statut === 'en_retard')
                      const montantARembourser = remboursementsEnAttente.reduce((sum, r) => sum + Number(r.montant || 0), 0)
                      const prochainRemboursement = echeancier.find(r => r.statut === 'en_attente' || r.statut === 'en_retard')
                      const remboursementsEnRetard = echeancier.filter(r => r.statut === 'en_retard')
                      const joursRetardMax = remboursementsEnRetard.length > 0 
                        ? Math.max(...remboursementsEnRetard.map(r => calculateDaysOverdue(r.date_remboursement)))
                        : 0

                      return (
                        <div className="grid gap-4 md:grid-cols-3">
                          <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Montant à rembourser</CardTitle>
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{formatCurrency(montantARembourser)}</div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {remboursementsEnAttente.length} remboursement{remboursementsEnAttente.length > 1 ? 's' : ''} en attente
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Prochain remboursement</CardTitle>
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                              {prochainRemboursement ? (
                                <>
                                  <div className="text-2xl font-bold">{formatDate(prochainRemboursement.date_remboursement)}</div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatCurrency(prochainRemboursement.montant)}
                                  </p>
                                </>
                              ) : (
                                <div className="text-lg text-muted-foreground">Aucun</div>
                              )}
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Jours de retard</CardTitle>
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                              {joursRetardMax > 0 ? (
                                <>
                                  <div className="text-2xl font-bold text-destructive">{joursRetardMax}</div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {remboursementsEnRetard.length} remboursement{remboursementsEnRetard.length > 1 ? 's' : ''} en retard
                                  </p>
                                </>
                              ) : (
                                <div className="text-lg text-green-600">0</div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )
                    })()}

                    {/* Échéancier */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Échéancier</h3>
                      {membresDetails[selectedMembre.membre_id]?.echeancier.length === 0 ? (
                        <p className="text-muted-foreground">Aucun remboursement en attente</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>N°</TableHead>
                              <TableHead>Date prévue</TableHead>
                              <TableHead>Montant</TableHead>
                              <TableHead>Principal</TableHead>
                              <TableHead>Intérêt</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Jours retard</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {membresDetails[selectedMembre.membre_id]?.echeancier.map((remboursement) => {
                              const joursRetard = remboursement.statut === 'en_retard' 
                                ? calculateDaysOverdue(remboursement.date_remboursement)
                                : 0
                              return (
                                <TableRow key={remboursement.id}>
                                  <TableCell>{remboursement.numero_remboursement}</TableCell>
                                  <TableCell>{formatDate(remboursement.date_remboursement)}</TableCell>
                                  <TableCell>{formatCurrency(remboursement.montant)}</TableCell>
                                  <TableCell>{formatCurrency(remboursement.principal || 0)}</TableCell>
                                  <TableCell>{formatCurrency(remboursement.interet || 0)}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        remboursement.statut === 'en_retard'
                                          ? 'destructive'
                                          : remboursement.statut === 'paye'
                                          ? 'default'
                                          : 'secondary'
                                      }
                                    >
                                      {remboursement.statut === 'en_retard'
                                        ? 'En retard'
                                        : remboursement.statut === 'paye'
                                        ? 'Payé'
                                        : 'En attente'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {joursRetard > 0 ? (
                                      <span className="text-destructive font-semibold">{joursRetard}</span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Détails des dépôts et retraits */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Dépôts et Retraits</h3>
                      {epargneTransactions.length === 0 ? (
                        <p className="text-muted-foreground">Aucune transaction d'épargne</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Montant</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {epargneTransactions.map((transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>{formatDate(transaction.date_operation)}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={transaction.type === 'depot' ? 'default' : 'secondary'}
                                    className="flex items-center gap-1 w-fit"
                                  >
                                    {transaction.type === 'depot' ? (
                                      <>
                                        <TrendingUp className="w-3 h-3" />
                                        Dépôt
                                      </>
                                    ) : (
                                      <>
                                        <TrendingDown className="w-3 h-3" />
                                        Retrait
                                      </>
                                    )}
                                  </Badge>
                                </TableCell>
                                <TableCell className={transaction.type === 'depot' ? 'text-green-600' : 'text-red-600'}>
                                  {transaction.type === 'depot' ? '+' : '-'}
                                  {formatCurrency(transaction.montant)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function MembresAssignesPage() {
  return (
    <ProtectedRoute>
      <MembresAssignesContent />
    </ProtectedRoute>
  )
}

