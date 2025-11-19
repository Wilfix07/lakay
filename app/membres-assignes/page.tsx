'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Membre, type Pret, type Collateral, type EpargneTransaction, type Remboursement, type UserProfile, type ChefZoneMembre } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Wallet, PiggyBank, CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
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

    for (const membreId of membreIds) {
      // Charger les garanties (collaterals)
      const { data: collaterals } = await supabase
        .from('collaterals')
        .select('montant')
        .eq('membre_id', membreId)

      const garantieTotal = (collaterals || []).reduce((sum, c) => sum + Number(c.montant || 0), 0)

      // Charger les épargnes
      const { data: epargnes } = await supabase
        .from('epargne_transactions')
        .select('type, montant')
        .eq('membre_id', membreId)

      const epargneTotal = (epargnes || []).reduce((sum, t) => {
        const montant = Number(t.montant || 0)
        return sum + (t.type === 'depot' ? montant : -montant)
      }, 0)

      // Charger les prêts actifs
      const { data: pretsActifs } = await supabase
        .from('prets')
        .select('pret_id, montant_pret, capital_restant')
        .eq('membre_id', membreId)
        .eq('statut', 'actif')

      const pretActifTotal = (pretsActifs || []).reduce((sum, p) => {
        return sum + Number(p.capital_restant || p.montant_pret || 0)
      }, 0)

      // Charger l'échéancier (remboursements en attente)
      const pretIds = (pretsActifs || []).map(p => p.pret_id)
      let echeancier: Remboursement[] = []
      
      if (pretIds.length > 0) {
        const { data: remboursements } = await supabase
          .from('remboursements')
          .select('*')
          .in('pret_id', pretIds)
          .in('statut', ['en_attente', 'en_retard'])
          .order('date_remboursement', { ascending: true })

        echeancier = remboursements || []
      }

      details[membreId] = {
        garantie: garantieTotal,
        epargne: epargneTotal,
        pretActif: pretActifTotal,
        echeancier,
      }
    }

    setMembresDetails(details)
  }

  function handleViewDetails(membre: Membre) {
    setSelectedMembre(membre)
    setShowDetails(true)
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
                  <Button variant="ghost" onClick={() => setShowDetails(false)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {membresDetails[selectedMembre.membre_id]?.echeancier.map((remboursement) => (
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
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

