'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, type Collateral, type Pret, type Membre, type UserProfile } from '@/lib/supabase'
import { getUserProfile, signOut } from '@/lib/auth'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Plus,
  DollarSign,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { calculateLoanPlan, type FrequenceRemboursement } from '@/lib/loanUtils'
import Link from 'next/link'

function CollateralsPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [collaterals, setCollaterals] = useState<Collateral[]>([])
  const [prets, setPrets] = useState<Pret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    pret_id: '',
    montant_depose: '',
    date_depot: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadData()
    }
  }, [userProfile])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
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

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // Charger tous les prêts (actifs, terminés, et en attente de garantie) pour vérifier le statut
      const pretsQuery =
        userProfile?.role === 'admin' || userProfile?.role === 'manager'
          ? supabase.from('prets').select('*').in('statut', ['actif', 'termine', 'en_attente_garantie']).order('pret_id', { ascending: true })
          : supabase
              .from('prets')
              .select('*')
              .in('statut', ['actif', 'termine', 'en_attente_garantie'])
              .eq('agent_id', userProfile?.agent_id ?? '')
              .order('pret_id', { ascending: true })

      // Charger les membres
      const membresQuery =
        userProfile?.role === 'admin' || userProfile?.role === 'manager'
          ? supabase.from('membres').select('*').order('membre_id', { ascending: true })
          : supabase
              .from('membres')
              .select('*')
              .eq('agent_id', userProfile?.agent_id ?? '')
              .order('membre_id', { ascending: true })

      // Charger les garanties
      const collateralsQuery = supabase.from('collaterals').select('*').order('created_at', { ascending: false })

      const [{ data: pretsData, error: pretsError }, { data: membresData, error: membresError }, { data: collateralsData, error: collateralsError }] =
        await Promise.all([pretsQuery, membresQuery, collateralsQuery])

      if (pretsError) throw pretsError
      if (membresError) throw membresError
      if (collateralsError) throw collateralsError

      setPrets(pretsData || [])
      setMembres(membresData || [])
      setCollaterals(collateralsData || [])
    } catch (err: any) {
      console.error('Erreur lors du chargement des données:', err)
      setError(err.message || 'Erreur lors du chargement des données.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Active un prêt et crée les remboursements après que la garantie soit complète
   */
  async function activateLoanAfterCollateral(pretId: string) {
    try {
      // Récupérer les informations du prêt
      const { data: pret, error: pretError } = await supabase
        .from('prets')
        .select('*')
        .eq('pret_id', pretId)
        .single()

      if (pretError) throw pretError
      if (!pret) throw new Error('Prêt non trouvé')

      // Vérifier que le prêt est en attente de garantie
      if (pret.statut !== 'en_attente_garantie') {
        console.log(`Le prêt ${pretId} n'est pas en attente de garantie (statut: ${pret.statut})`)
        return
      }

      // Calculer le plan de remboursement
      const frequency: FrequenceRemboursement = 
        pret.frequence_remboursement === 'mensuel' ? 'mensuel' : 'journalier'
      
      const plan = await calculateLoanPlan(
        pret.montant_pret,
        frequency,
        pret.nombre_remboursements,
        pret.date_decaissement,
      )

      // Créer les remboursements
      const remboursements = plan.schedule.map((entry) => ({
        pret_id: pret.pret_id,
        membre_id: pret.membre_id,
        agent_id: pret.agent_id,
        numero_remboursement: entry.numero,
        montant: entry.montant,
        principal: entry.principal,
        interet: entry.interet,
        date_remboursement: entry.date.toISOString().split('T')[0],
        statut: 'en_attente',
      }))

      const { error: rembError } = await supabase
        .from('remboursements')
        .insert(remboursements)

      if (rembError) throw rembError

      // Activer le prêt
      const { error: updateError } = await supabase
        .from('prets')
        .update({ 
          statut: 'actif',
          updated_at: new Date().toISOString(),
        })
        .eq('pret_id', pretId)

      if (updateError) throw updateError

      console.log(`✅ Prêt ${pretId} activé avec ${remboursements.length} remboursements créés`)
    } catch (error) {
      console.error('Erreur lors de l\'activation du prêt:', error)
      throw new Error('Impossible d\'activer le prêt. Veuillez contacter l\'administrateur.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const montantDepose = parseFloat(formData.montant_depose)
      if (isNaN(montantDepose) || montantDepose <= 0) {
        throw new Error('Le montant déposé doit être supérieur à 0')
      }

      // Récupérer la garantie existante
      const { data: existingCollateral, error: fetchError } = await supabase
        .from('collaterals')
        .select('*')
        .eq('pret_id', formData.pret_id)
        .single()

      if (fetchError) throw fetchError

      const nouveauMontantDepose = existingCollateral.montant_depose + montantDepose
      const nouveauMontantRestant = Math.max(existingCollateral.montant_requis - nouveauMontantDepose, 0)
      const nouveauStatut = nouveauMontantRestant === 0 ? 'complet' : 'partiel'

      const updateData: any = {
        montant_depose: nouveauMontantDepose,
        montant_restant: nouveauMontantRestant,
        statut: nouveauStatut,
        notes: formData.notes || existingCollateral.notes,
        updated_at: new Date().toISOString(),
      }

      if (nouveauStatut === 'complet' && !existingCollateral.date_depot) {
        updateData.date_depot = formData.date_depot
      }

      const { error: updateError } = await supabase
        .from('collaterals')
        .update(updateData)
        .eq('pret_id', formData.pret_id)

      if (updateError) throw updateError

      // Si la garantie est maintenant complète, activer le prêt et créer les remboursements
      if (nouveauStatut === 'complet' && existingCollateral.statut !== 'complet') {
        await activateLoanAfterCollateral(formData.pret_id)
      }

      const message = nouveauStatut === 'complet' 
        ? '✅ Garantie complète ! Le prêt a été activé et les remboursements ont été créés. Le décaissement peut maintenant être effectué.'
        : 'Dépôt de garantie enregistré avec succès !'
      
      setSuccess(message)
      setShowForm(false)
      setFormData({
        pret_id: '',
        montant_depose: '',
        date_depot: new Date().toISOString().split('T')[0],
        notes: '',
      })
      await loadData()
    } catch (err: any) {
      console.error('Erreur lors de l\'enregistrement du dépôt:', err)
      setError(err.message || 'Erreur lors de l\'enregistrement du dépôt.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRefund(collateral: Collateral) {
    try {
      // Vérifier d'abord que le prêt est entièrement remboursé
      const { data: pretData, error: pretError } = await supabase
        .from('prets')
        .select('statut, montant_pret')
        .eq('pret_id', collateral.pret_id)
        .single()

      if (pretError) throw pretError

      if (!pretData) {
        setError('Prêt non trouvé.')
        return
      }

      // Vérifier que le prêt est terminé
      if (pretData.statut !== 'termine') {
        setError('Le retrait de la garantie n\'est autorisé que lorsque le prêt est entièrement remboursé. Le membre doit d\'abord terminer de payer son prêt.')
        return
      }

      // Vérifier que tous les remboursements sont payés
      const { data: remboursements, error: rembError } = await supabase
        .from('remboursements')
        .select('statut')
        .eq('pret_id', collateral.pret_id)

      if (rembError) throw rembError

      const allPaid = remboursements?.every((r) => r.statut === 'paye')
      if (!allPaid) {
        setError('Tous les remboursements doivent être payés avant de retirer la garantie.')
        return
      }

      // Vérifier que la garantie est complète
      if (collateral.statut !== 'complet') {
        setError('La garantie doit être complète avant d\'être remboursée.')
        return
      }

      if (!confirm(`Confirmer le retrait de la garantie de ${formatCurrency(collateral.montant_depose)} ?\n\nLe membre a terminé de rembourser son prêt et peut récupérer sa garantie.`)) {
        return
      }

      const { error } = await supabase
        .from('collaterals')
        .update({
          statut: 'rembourse',
          date_remboursement: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', collateral.id)

      if (error) throw error

      setSuccess('Garantie remboursée avec succès ! Le membre peut récupérer son dépôt.')
      await loadData()
    } catch (err: any) {
      console.error('Erreur lors du remboursement:', err)
      setError(err.message || 'Erreur lors du remboursement de la garantie.')
    }
  }

  const getMembre = (membreId: string) => membres.find((m) => m.membre_id === membreId)
  const getPret = (pretId: string) => prets.find((p) => p.pret_id === pretId)

  const availablePretsForDeposit = useMemo(() => {
    // Seules les garanties partielles peuvent recevoir des dépôts additionnels
    return collaterals.filter((c) => c.statut === 'partiel')
  }, [collaterals])

  const summary = useMemo(() => {
    const totalRequis = collaterals.reduce((sum, c) => sum + c.montant_requis, 0)
    const totalDepose = collaterals.reduce((sum, c) => sum + c.montant_depose, 0)
    const totalRestant = collaterals.reduce((sum, c) => sum + c.montant_restant, 0)
    const countPartiel = collaterals.filter((c) => c.statut === 'partiel').length
    const countComplet = collaterals.filter((c) => c.statut === 'complet').length
    const countRembourse = collaterals.filter((c) => c.statut === 'rembourse').length

    return {
      totalRequis,
      totalDepose,
      totalRestant,
      countPartiel,
      countComplet,
      countRembourse,
    }
  }, [collaterals])

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  const isAdmin = userProfile.role === 'admin'

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Garanties (Collateral)</h1>
            <p className="text-muted-foreground mt-2">Gestion des garanties déposées par les membres</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <Link href="/parametres">
                <Button variant="outline">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Modifier le taux
                </Button>
              </Link>
            )}
            <Button onClick={loadData} variant="outline" disabled={loading}>
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total requis
              </CardTitle>
              <div className="p-2 rounded-lg bg-blue-50">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(summary.totalRequis)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{collaterals.length} garanties</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total déposé
              </CardTitle>
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(summary.totalDepose)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.countComplet} complet • {summary.countRembourse} remboursés
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Restant à déposer
              </CardTitle>
              <div className="p-2 rounded-lg bg-amber-50">
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {formatCurrency(summary.totalRestant)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.countPartiel} partiels
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Actions
              </CardTitle>
              <div className="p-2 rounded-lg bg-purple-50">
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowForm(!showForm)}
                variant="default"
                className="w-full"
                disabled={availablePretsForDeposit.length === 0}
                title={
                  availablePretsForDeposit.length === 0
                    ? 'Aucune garantie partielle disponible. Créez un prêt d\'abord ou attendez qu\'une garantie ne soit pas complète.'
                    : ''
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                {showForm ? 'Annuler' : 'Enregistrer dépôt'}
              </Button>
              {availablePretsForDeposit.length === 0 && collaterals.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  💡 Créez d'abord un prêt dans la page "Prêts". Une garantie sera créée automatiquement.
                </p>
              )}
              {availablePretsForDeposit.length === 0 && collaterals.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  ✅ Toutes les garanties sont complètes ou remboursées
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Enregistrer un dépôt de garantie</CardTitle>
              <CardDescription>
                Ajoutez un montant au dépôt de garantie d'un prêt existant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pret_id">Prêt (garantie partielle)</Label>
                    <select
                      id="pret_id"
                      required
                      value={formData.pret_id}
                      onChange={(e) => setFormData({ ...formData, pret_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Sélectionner un prêt</option>
                      {availablePretsForDeposit.map((collateral) => {
                        const pret = getPret(collateral.pret_id)
                        const membre = getMembre(collateral.membre_id)
                        return (
                          <option key={collateral.pret_id} value={collateral.pret_id}>
                            {collateral.pret_id} - {membre?.prenom} {membre?.nom} (Restant: {formatCurrency(collateral.montant_restant)})
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="montant_depose">Montant à déposer</Label>
                    <Input
                      id="montant_depose"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.montant_depose}
                      onChange={(e) => setFormData({ ...formData, montant_depose: e.target.value })}
                      placeholder="Ex: 500.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_depot">Date du dépôt</Label>
                    <Input
                      id="date_depot"
                      type="date"
                      required
                      value={formData.date_depot}
                      onChange={(e) => setFormData({ ...formData, date_depot: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optionnel)</Label>
                    <Input
                      id="notes"
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes additionnelles"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Enregistrer le dépôt
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setFormData({
                        pret_id: '',
                        montant_depose: '',
                        date_depot: new Date().toISOString().split('T')[0],
                        notes: '',
                      })
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des garanties</CardTitle>
            <CardDescription>
              Toutes les garanties déposées pour les prêts. 
              <span className="font-semibold text-amber-600 ml-2">
                ⚠️ Le retrait de la garantie n'est autorisé que lorsque le membre a entièrement remboursé son prêt.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prêt</TableHead>
                    <TableHead>Membre</TableHead>
                    <TableHead className="text-right">Montant requis</TableHead>
                    <TableHead className="text-right">Montant déposé</TableHead>
                    <TableHead className="text-right">Restant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date dépôt</TableHead>
                    <TableHead>Date remboursement</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaterals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Aucune garantie enregistrée
                      </TableCell>
                    </TableRow>
                  ) : (
                    collaterals.map((collateral) => {
                      const membre = getMembre(collateral.membre_id)
                      const pret = getPret(collateral.pret_id)
                      const percentage = (collateral.montant_depose / collateral.montant_requis) * 100
                      const pretTermine = pret?.statut === 'termine'
                      const canRefund = collateral.statut === 'complet' && !collateral.date_remboursement && pretTermine

                      return (
                        <TableRow key={collateral.id}>
                          <TableCell className="font-medium">
                            <div>
                              {collateral.pret_id}
                              {pret && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Prêt: {pret.statut === 'termine' ? (
                                    <span className="text-green-600 font-semibold">✓ Terminé</span>
                                  ) : pret.statut === 'en_attente_garantie' ? (
                                    <span className="text-orange-600 font-semibold">⏳ En attente de garantie</span>
                                  ) : (
                                    <span className="text-amber-600">En cours</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {membre ? `${membre.prenom} ${membre.nom}` : collateral.membre_id}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(collateral.montant_requis)}</TableCell>
                          <TableCell className="text-right">
                            <div className="space-y-1">
                              <div>{formatCurrency(collateral.montant_depose)}</div>
                              <div className="text-xs text-muted-foreground">
                                {percentage.toFixed(1)}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(collateral.montant_restant)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {collateral.statut === 'complet' && (
                                <Badge className="bg-green-100 text-green-700">Complet</Badge>
                              )}
                              {collateral.statut === 'partiel' && (
                                <Badge className="bg-amber-100 text-amber-700">Partiel</Badge>
                              )}
                              {collateral.statut === 'rembourse' && (
                                <Badge className="bg-blue-100 text-blue-700">Remboursé</Badge>
                              )}
                              {collateral.statut === 'complet' && !collateral.date_remboursement && pretTermine && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                  Retrait autorisé
                                </Badge>
                              )}
                              {collateral.statut === 'complet' && !collateral.date_remboursement && !pretTermine && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Prêt en cours
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {collateral.date_depot ? formatDate(collateral.date_depot) : '-'}
                          </TableCell>
                          <TableCell>
                            {collateral.date_remboursement
                              ? formatDate(collateral.date_remboursement)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {canRefund ? (
                              <Button
                                onClick={() => handleRefund(collateral)}
                                variant="default"
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Retirer
                              </Button>
                            ) : collateral.statut === 'complet' && !collateral.date_remboursement && !pretTermine ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                title="Le prêt doit être entièrement remboursé avant de retirer la garantie"
                              >
                                Prêt en cours
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function CollateralsPage() {
  return (
    <ProtectedRoute requiredRole={['admin', 'manager', 'agent']}>
      <CollateralsPageContent />
    </ProtectedRoute>
  )
}

