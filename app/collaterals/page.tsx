'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, type Collateral, type Pret, type Membre, type UserProfile, type GroupPret } from '@/lib/supabase'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Plus,
  DollarSign,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet,
  ArrowDownCircle,
  Filter,
  X,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { calculateLoanPlan, type FrequenceRemboursement } from '@/lib/loanUtils'
import Link from 'next/link'

function CollateralsPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [collaterals, setCollaterals] = useState<Collateral[]>([])
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false)
  const [selectedCollateral, setSelectedCollateral] = useState<Collateral | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    collateral_id: '', // ID de la garantie (pour prêts individuels ou de groupe)
    pret_id: '', // Pour prêts individuels
    group_pret_id: '', // Pour prêts de groupe
    montant_depose: '',
    date_depot: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [withdrawalFormData, setWithdrawalFormData] = useState({
    montant_retire: '',
    date_retrait: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [filters, setFilters] = useState({
    membreNom: '',
    numeroPret: '',
    typePret: '', // '' = tous, 'individuel' = prêt individuel, 'groupe' = prêt de groupe
    statut: '', // '' = tous, 'partiel', 'complet', 'rembourse'
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
      // Récupérer les IDs des agents du manager si nécessaire
      let managerAgentIds: string[] | null = null
      if (userProfile?.role === 'manager') {
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError
        managerAgentIds = managerAgents?.map(a => a.agent_id) || []
        if (managerAgentIds.length === 0) {
          // Si le manager n'a pas encore d'agents, initialiser les données vides
          setPrets([])
          setMembres([])
          setCollaterals([])
          return
        }
      }

      // Charger tous les prêts (actifs, terminés, en attente de garantie, et en attente d'approbation) pour vérifier le statut
      // Permettre aux agents de faire des dépôts même avant l'approbation du manager
      let pretsQuery = supabase.from('prets').select('*').in('statut', ['actif', 'termine', 'en_attente_garantie', 'en_attente_approbation']).order('pret_id', { ascending: true })
      if (userProfile?.role === 'agent') {
        pretsQuery = pretsQuery.eq('agent_id', userProfile.agent_id ?? '')
      } else if (userProfile?.role === 'manager' && managerAgentIds) {
        pretsQuery = pretsQuery.in('agent_id', managerAgentIds)
      }
      // Admin voit tous les prêts (pas de filtre)

      // Charger les prêts de groupe
      let groupPretsQuery = supabase.from('group_prets').select('*').in('statut', ['actif', 'termine', 'en_attente_garantie', 'en_attente_approbation']).order('pret_id', { ascending: true })
      if (userProfile?.role === 'agent') {
        groupPretsQuery = groupPretsQuery.eq('agent_id', userProfile.agent_id ?? '')
      } else if (userProfile?.role === 'manager' && managerAgentIds) {
        groupPretsQuery = groupPretsQuery.in('agent_id', managerAgentIds)
      }

      // Charger les membres
      let membresQuery = supabase.from('membres').select('*').order('membre_id', { ascending: true })
      if (userProfile?.role === 'agent') {
        membresQuery = membresQuery.eq('agent_id', userProfile.agent_id ?? '')
      } else if (userProfile?.role === 'manager' && managerAgentIds) {
        membresQuery = membresQuery.in('agent_id', managerAgentIds)
      }
      // Admin voit tous les membres (pas de filtre)

      // Charger les garanties
      // Les garanties seront filtrées automatiquement par RLS basé sur les prêts/membres
      let collateralsQuery = supabase.from('collaterals').select('*').order('created_at', { ascending: false })
      
      // Filtrer les garanties par membre_id si manager ou agent
      if (userProfile?.role === 'manager' && managerAgentIds) {
        // Récupérer d'abord les membre_ids des membres du manager
        const { data: managerMembres } = await supabase
          .from('membres')
          .select('membre_id')
          .in('agent_id', managerAgentIds)

        const membreIds = managerMembres?.map(m => m.membre_id) || []
        if (membreIds.length > 0) {
          collateralsQuery = collateralsQuery.in('membre_id', membreIds)
        } else {
          collateralsQuery = collateralsQuery.eq('membre_id', 'NON_EXISTANT') // Retourner vide
        }
      } else if (userProfile?.role === 'agent' && userProfile.agent_id) {
        // Récupérer les membre_ids des membres de l'agent
        const { data: agentMembres } = await supabase
          .from('membres')
          .select('membre_id')
          .eq('agent_id', userProfile.agent_id)

        const membreIds = agentMembres?.map(m => m.membre_id) || []
        if (membreIds.length > 0) {
          collateralsQuery = collateralsQuery.in('membre_id', membreIds)
        } else {
          collateralsQuery = collateralsQuery.eq('membre_id', 'NON_EXISTANT') // Retourner vide
        }
      }
      // Admin voit toutes les garanties (pas de filtre)

      const [{ data: pretsData, error: pretsError }, { data: groupPretsData, error: groupPretsError }, { data: membresData, error: membresError }, { data: collateralsData, error: collateralsError }] =
        await Promise.all([pretsQuery, groupPretsQuery, membresQuery, collateralsQuery])

      if (pretsError) throw pretsError
      // Si la table group_prets n'existe pas (404), ignorer l'erreur et retourner un tableau vide
      if (groupPretsError) {
        // Si c'est une erreur 404 (table n'existe pas), ignorer silencieusement
        const isTableNotFound = 
          groupPretsError.code === 'PGRST116' || 
          groupPretsError.code === '42P01' ||
          groupPretsError.message?.includes('404') ||
          groupPretsError.message?.includes('does not exist') ||
          (groupPretsError.message?.includes('relation') && groupPretsError.message?.includes('not found'))
        
        if (isTableNotFound) {
          console.warn('Table group_prets non trouvée, utilisation d\'un tableau vide')
          setGroupPrets([])
        } else {
          throw groupPretsError
        }
      } else {
        setGroupPrets(groupPretsData || [])
      }
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
   * Ne s'active PAS automatiquement si le prêt est en attente d'approbation (le manager doit d'abord approuver)
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

      // Le prêt doit être en attente de garantie pour être activé
      // L'activation se fait après l'approbation du manager

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

      // Récupérer la garantie existante par ID (fonctionne pour prêts individuels et de groupe)
      let query = supabase.from('collaterals').select('*')
      
      if (formData.collateral_id) {
        // Utiliser l'ID de la garantie directement
        query = query.eq('id', parseInt(formData.collateral_id))
      } else if (formData.pret_id) {
        // Pour les prêts individuels (rétrocompatibilité)
        query = query.eq('pret_id', formData.pret_id)
      } else if (formData.group_pret_id) {
        // Pour les prêts de groupe, on doit aussi spécifier le membre
        // Cette logique sera gérée dans le formulaire qui sélectionne la garantie
        throw new Error('Veuillez sélectionner une garantie spécifique')
      } else {
        throw new Error('Veuillez sélectionner une garantie')
      }

      const { data: existingCollateralData, error: fetchError } = await query.single()

      if (fetchError) throw fetchError
      if (!existingCollateralData) throw new Error('Garantie non trouvée')

      const existingCollateral = existingCollateralData

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
        .eq('id', existingCollateral.id)

      if (updateError) throw updateError

      // Si la garantie est maintenant complète, le prêt peut être approuvé par le manager
      // Le prêt ne sera pas activé automatiquement - le manager doit l'approuver dans la page Approbations
      let message = ''
      const isGroupLoan = existingCollateral.group_pret_id
      if (nouveauStatut === 'complet') {
        if (isGroupLoan) {
          message = '✅ Garantie complète pour ce membre ! Le prêt de groupe peut être approuvé par le manager une fois que toutes les garanties des membres sont complètes.'
        } else {
          message = '✅ Garantie complète ! Le prêt est maintenant prêt pour l\'approbation du manager. Le manager peut approuver le prêt dans la page "Approbations" pour l\'activer.'
        }
      } else {
        message = 'Dépôt de garantie enregistré avec succès !'
      }
      
      setSuccess(message)
      setShowForm(false)
      setFormData({
        collateral_id: '',
        pret_id: '',
        group_pret_id: '',
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

  function openWithdrawalForm(collateral: Collateral) {
    // Vérifier d'abord que le prêt est entièrement remboursé
    const isGroupLoan = !!collateral.group_pret_id
    const pret = isGroupLoan ? getGroupPret(collateral.group_pret_id || '') : getPret(collateral.pret_id || '')
    
    if (!pret) {
      setError('Prêt non trouvé.')
      return
    }

    // Vérifier que le prêt est terminé
    if (pret.statut !== 'termine') {
      setError('Le retrait de la garantie n\'est autorisé que lorsque le prêt est entièrement remboursé. Le membre doit d\'abord terminer de payer son prêt.')
      return
    }

    // Vérifier que la garantie est complète
    if (collateral.statut !== 'complet') {
      setError('La garantie doit être complète avant d\'être remboursée.')
      return
    }

    setSelectedCollateral(collateral)
    setWithdrawalFormData({
      montant_retire: collateral.montant_depose.toString(),
      date_retrait: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setShowWithdrawalForm(true)
    setError(null)
  }

  async function handleWithdrawalSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCollateral) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const montantRetire = parseFloat(withdrawalFormData.montant_retire)
      if (isNaN(montantRetire) || montantRetire <= 0) {
        throw new Error('Le montant retiré doit être supérieur à 0')
      }

      if (montantRetire > selectedCollateral.montant_depose) {
        throw new Error(`Le montant retiré ne peut pas dépasser le montant déposé (${formatCurrency(selectedCollateral.montant_depose)})`)
      }

      // Vérifier que tous les remboursements sont payés
      const isGroupLoan = !!selectedCollateral.group_pret_id
      
      if (isGroupLoan) {
        // Pour les prêts de groupe, vérifier les remboursements de ce membre spécifique
        const { data: remboursements, error: rembError } = await supabase
          .from('group_remboursements')
          .select('statut')
          .eq('pret_id', selectedCollateral.group_pret_id)
          .eq('membre_id', selectedCollateral.membre_id)

        if (rembError) throw rembError

        const allPaid = remboursements?.every((r) => r.statut === 'paye')
        if (!allPaid) {
          throw new Error('Tous les remboursements de ce membre doivent être payés avant de retirer sa garantie.')
        }
      } else {
        // Pour les prêts individuels
        const { data: remboursements, error: rembError } = await supabase
          .from('remboursements')
          .select('statut')
          .eq('pret_id', selectedCollateral.pret_id || '')

        if (rembError) throw rembError

        const allPaid = remboursements?.every((r) => r.statut === 'paye')
        if (!allPaid) {
          throw new Error('Tous les remboursements doivent être payés avant de retirer la garantie.')
        }
      }

      // Mettre à jour la garantie
      const updateData: any = {
        statut: 'rembourse',
        date_remboursement: withdrawalFormData.date_retrait,
        updated_at: new Date().toISOString(),
      }

      // Si des notes sont ajoutées, les combiner avec les notes existantes
      if (withdrawalFormData.notes) {
        const existingNotes = selectedCollateral.notes || ''
        updateData.notes = existingNotes 
          ? `${existingNotes}\n\n[Retrait ${withdrawalFormData.date_retrait}]: ${withdrawalFormData.notes}`
          : `[Retrait ${withdrawalFormData.date_retrait}]: ${withdrawalFormData.notes}`
      }

      const { error } = await supabase
        .from('collaterals')
        .update(updateData)
        .eq('id', selectedCollateral.id)

      if (error) throw error

      setSuccess(`Garantie de ${formatCurrency(montantRetire)} remboursée avec succès ! Le membre peut récupérer son dépôt.`)
      setShowWithdrawalForm(false)
      setSelectedCollateral(null)
      setWithdrawalFormData({
        montant_retire: '',
        date_retrait: new Date().toISOString().split('T')[0],
        notes: '',
      })
      await loadData()
    } catch (err: any) {
      console.error('Erreur lors du retrait:', err)
      setError(err.message || 'Erreur lors du retrait de la garantie.')
    } finally {
      setSaving(false)
    }
  }

  const getMembre = (membreId: string) => membres.find((m) => m.membre_id === membreId)
  const getPret = (pretId: string) => prets.find((p) => p.pret_id === pretId)
  const getGroupPret = (groupPretId: string) => groupPrets.find((p) => p.pret_id === groupPretId)

  const availablePretsForDeposit = useMemo(() => {
    // Seules les garanties partielles peuvent recevoir des dépôts additionnels
    return collaterals.filter((c) => c.statut === 'partiel')
  }, [collaterals])

  const filteredCollaterals = useMemo(() => {
    return collaterals.filter((collateral) => {
      // Filtre par nom du membre
      if (filters.membreNom) {
        const membre = membres.find((m) => m.membre_id === collateral.membre_id)
        const membreNomComplet = membre ? `${membre.prenom} ${membre.nom}`.toLowerCase() : ''
        const membreNomRecherche = filters.membreNom.toLowerCase()
        if (!membreNomComplet.includes(membreNomRecherche)) {
          return false
        }
      }

      // Filtre par numéro de prêt
      if (filters.numeroPret) {
        const pretId = collateral.group_pret_id || collateral.pret_id || ''
        if (!pretId.toLowerCase().includes(filters.numeroPret.toLowerCase())) {
          return false
        }
      }

      // Filtre par type de prêt (individuel ou groupe)
      if (filters.typePret) {
        if (filters.typePret === 'individuel' && collateral.group_pret_id) {
          return false
        }
        if (filters.typePret === 'groupe' && !collateral.group_pret_id) {
          return false
        }
      }

      // Filtre par statut
      if (filters.statut && collateral.statut !== filters.statut) {
        return false
      }

      return true
    })
  }, [collaterals, filters, membres])

  const summary = useMemo(() => {
    const totalRequis = filteredCollaterals.reduce((sum, c) => sum + c.montant_requis, 0)
    const totalDepose = filteredCollaterals.reduce((sum, c) => sum + c.montant_depose, 0)
    const totalRestant = filteredCollaterals.reduce((sum, c) => sum + c.montant_restant, 0)
    const countPartiel = filteredCollaterals.filter((c) => c.statut === 'partiel').length
    const countComplet = filteredCollaterals.filter((c) => c.statut === 'complet').length
    const countRembourse = filteredCollaterals.filter((c) => c.statut === 'rembourse').length

    return {
      totalRequis,
      totalDepose,
      totalRestant,
      countPartiel,
      countComplet,
      countRembourse,
    }
  }, [filteredCollaterals])

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
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    setShowForm(!showForm)
                    setShowWithdrawalForm(false)
                    setError(null)
                  }}
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
                {(() => {
                  const availableForWithdrawal = collaterals.filter(c => {
                    if (c.statut !== 'complet' || c.date_remboursement) return false
                    const isGroupLoan = !!c.group_pret_id
                    const pret = isGroupLoan ? getGroupPret(c.group_pret_id || '') : getPret(c.pret_id || '')
                    return pret?.statut === 'termine'
                  })
                  if (availableForWithdrawal.length > 0) {
                    return (
                      <Button
                        onClick={() => {
                          setShowWithdrawalForm(!showWithdrawalForm)
                          setShowForm(false)
                          setError(null)
                        }}
                        variant="outline"
                        className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                      >
                        <ArrowDownCircle className="w-4 h-4 mr-2" />
                        {showWithdrawalForm ? 'Annuler' : 'Enregistrer retrait'}
                      </Button>
                    )
                  }
                  return null
                })()}
              </div>
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
                    <Label htmlFor="collateral_id">Garantie (partielle)</Label>
                    <select
                      id="collateral_id"
                      required
                      value={formData.collateral_id}
                      onChange={(e) => {
                        const selectedCollateral = availablePretsForDeposit.find(
                          c => c.id.toString() === e.target.value
                        )
                        setFormData({ 
                          ...formData, 
                          collateral_id: e.target.value,
                          pret_id: selectedCollateral?.pret_id || '',
                          group_pret_id: selectedCollateral?.group_pret_id || '',
                        })
                        if (selectedCollateral) {
                          setError(null)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Sélectionner une garantie</option>
                      {/* Prêts individuels */}
                      {availablePretsForDeposit
                        .filter(c => !c.group_pret_id)
                        .map((collateral) => {
                          const pret = getPret(collateral.pret_id || '')
                          const membre = getMembre(collateral.membre_id)
                          return (
                            <option key={collateral.id} value={collateral.id.toString()}>
                              {collateral.pret_id} - {membre?.prenom} {membre?.nom} (Restant: {formatCurrency(collateral.montant_restant)})
                            </option>
                          )
                        })}
                      {/* Prêts de groupe */}
                      {availablePretsForDeposit
                        .filter(c => c.group_pret_id)
                        .map((collateral) => {
                          const groupPret = getGroupPret(collateral.group_pret_id || '')
                          const membre = getMembre(collateral.membre_id)
                          return (
                            <option key={collateral.id} value={collateral.id.toString()}>
                              👥 {collateral.group_pret_id} - {membre?.prenom} {membre?.nom} (Restant: {formatCurrency(collateral.montant_restant)})
                            </option>
                          )
                        })}
                    </select>
                    {formData.collateral_id && (() => {
                      const collateral = availablePretsForDeposit.find(c => c.id.toString() === formData.collateral_id)
                      if (!collateral) return null
                      const pret = collateral.group_pret_id ? getGroupPret(collateral.group_pret_id) : getPret(collateral.pret_id || '')
                      const membre = getMembre(collateral.membre_id)
                      const isGroupLoan = !!collateral.group_pret_id
                      return (
                        <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                          <div><strong>Type:</strong> {isGroupLoan ? '👥 Prêt de groupe' : '👤 Prêt individuel'}</div>
                          <div><strong>Prêt:</strong> {isGroupLoan ? collateral.group_pret_id : collateral.pret_id}</div>
                          <div><strong>Membre:</strong> {membre?.prenom} {membre?.nom}</div>
                          <div><strong>Montant requis:</strong> {formatCurrency(collateral.montant_requis)}</div>
                          <div><strong>Déjà déposé:</strong> {formatCurrency(collateral.montant_depose)}</div>
                          <div><strong>Restant à déposer:</strong> {formatCurrency(collateral.montant_restant)}</div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="montant_depose">Montant à déposer (HTG)</Label>
                    <Input
                      id="montant_depose"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.montant_depose}
                      onChange={(e) => {
                        const value = e.target.value
                        setFormData({ ...formData, montant_depose: value })
                        // Validation en temps réel
                        if (formData.collateral_id) {
                          const collateral = availablePretsForDeposit.find(c => c.id.toString() === formData.collateral_id)
                          if (collateral && parseFloat(value) > collateral.montant_restant) {
                            setError(`Le montant ne peut pas dépasser ${formatCurrency(collateral.montant_restant)}`)
                          } else {
                            setError(null)
                          }
                        }
                      }}
                      placeholder="Ex: 500.00"
                    />
                    {formData.collateral_id && formData.montant_depose && (() => {
                      const collateral = availablePretsForDeposit.find(c => c.id.toString() === formData.collateral_id)
                      if (!collateral) return null
                      const montant = parseFloat(formData.montant_depose)
                      if (isNaN(montant) || montant <= 0) return null
                      const nouveauTotal = collateral.montant_depose + montant
                      const nouveauRestant = Math.max(collateral.montant_requis - nouveauTotal, 0)
                      return (
                        <div className="text-xs text-muted-foreground">
                          Après ce dépôt: {formatCurrency(nouveauTotal)} déposé, {formatCurrency(nouveauRestant)} restant
                        </div>
                      )
                    })()}
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

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes (optionnel)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes additionnelles sur ce dépôt..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={saving || !!error}>
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
                      setError(null)
                      setFormData({
                        collateral_id: '',
                        pret_id: '',
                        group_pret_id: '',
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

        {/* Formulaire de retrait */}
        {showWithdrawalForm && selectedCollateral && (
          <Card>
            <CardHeader>
              <CardTitle>Enregistrer un retrait de garantie</CardTitle>
              <CardDescription>
                Enregistrez le retrait de la garantie après que le membre ait terminé de rembourser son prêt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                {/* Informations de la garantie */}
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <div className="font-semibold">
                        {selectedCollateral.group_pret_id ? '👥 Prêt de groupe' : '👤 Prêt individuel'}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prêt:</span>
                      <div className="font-semibold">
                        {selectedCollateral.group_pret_id || selectedCollateral.pret_id}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Membre:</span>
                      <div className="font-semibold">
                        {(() => {
                          const membre = getMembre(selectedCollateral.membre_id)
                          return membre ? `${membre.prenom} ${membre.nom}` : selectedCollateral.membre_id
                        })()}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Montant déposé:</span>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(selectedCollateral.montant_depose)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statut:</span>
                      <div>
                        <Badge className="bg-green-100 text-green-700">Complet</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="montant_retire">Montant à retirer (HTG)</Label>
                    <Input
                      id="montant_retire"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      max={selectedCollateral.montant_depose}
                      value={withdrawalFormData.montant_retire}
                      onChange={(e) => {
                        const value = e.target.value
                        const montant = parseFloat(value)
                        if (montant > selectedCollateral.montant_depose) {
                          setError(`Le montant ne peut pas dépasser ${formatCurrency(selectedCollateral.montant_depose)}`)
                        } else {
                          setError(null)
                        }
                        setWithdrawalFormData({ ...withdrawalFormData, montant_retire: value })
                      }}
                      placeholder="Ex: 500.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: {formatCurrency(selectedCollateral.montant_depose)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_retrait">Date du retrait</Label>
                    <Input
                      id="date_retrait"
                      type="date"
                      required
                      value={withdrawalFormData.date_retrait}
                      onChange={(e) => setWithdrawalFormData({ ...withdrawalFormData, date_retrait: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="withdrawal_notes">Notes (optionnel)</Label>
                    <Textarea
                      id="withdrawal_notes"
                      value={withdrawalFormData.notes}
                      onChange={(e) => setWithdrawalFormData({ ...withdrawalFormData, notes: e.target.value })}
                      placeholder="Notes sur le retrait (ex: mode de paiement, références, etc.)..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={saving || !!error} className="bg-green-600 hover:bg-green-700">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <ArrowDownCircle className="w-4 h-4 mr-2" />
                        Enregistrer le retrait
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowWithdrawalForm(false)
                      setSelectedCollateral(null)
                      setError(null)
                      setWithdrawalFormData({
                        montant_retire: '',
                        date_retrait: new Date().toISOString().split('T')[0],
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
            {/* Filtres */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Filtres</h3>
                {(filters.membreNom || filters.numeroPret || filters.typePret || filters.statut) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters({ membreNom: '', numeroPret: '', typePret: '', statut: '' })}
                    className="ml-auto h-7 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Réinitialiser
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-membre-nom">Nom du membre</Label>
                  <Input
                    id="filter-membre-nom"
                    placeholder="Rechercher par nom..."
                    value={filters.membreNom}
                    onChange={(e) => setFilters({ ...filters, membreNom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-numero-pret">Numéro de prêt</Label>
                  <Input
                    id="filter-numero-pret"
                    placeholder="Rechercher par numéro..."
                    value={filters.numeroPret}
                    onChange={(e) => setFilters({ ...filters, numeroPret: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-type-pret">Type de prêt</Label>
                  <select
                    id="filter-type-pret"
                    value={filters.typePret}
                    onChange={(e) => setFilters({ ...filters, typePret: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Tous les types</option>
                    <option value="individuel">Prêt individuel</option>
                    <option value="groupe">Prêt de groupe</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-statut">Statut</Label>
                  <select
                    id="filter-statut"
                    value={filters.statut}
                    onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Tous les statuts</option>
                    <option value="partiel">Partiel</option>
                    <option value="complet">Complet</option>
                    <option value="rembourse">Remboursé</option>
                  </select>
                </div>
              </div>
              {(filters.membreNom || filters.numeroPret || filters.typePret || filters.statut) && (
                <div className="mt-3 text-sm text-muted-foreground">
                  {filteredCollaterals.length} garantie(s) trouvée(s) sur {collaterals.length}
                </div>
              )}
            </div>
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
                  {filteredCollaterals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        {collaterals.length === 0
                          ? 'Aucune garantie enregistrée'
                          : 'Aucune garantie ne correspond aux filtres sélectionnés'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCollaterals.map((collateral) => {
                      const membre = getMembre(collateral.membre_id)
                      const isGroupLoan = !!collateral.group_pret_id
                      const pret = isGroupLoan ? getGroupPret(collateral.group_pret_id || '') : getPret(collateral.pret_id || '')
                      const percentage = (collateral.montant_depose / collateral.montant_requis) * 100
                      const pretTermine = pret?.statut === 'termine'
                      const canRefund = collateral.statut === 'complet' && !collateral.date_remboursement && pretTermine

                      return (
                        <TableRow key={collateral.id}>
                          <TableCell className="font-medium">
                            <div>
                              {isGroupLoan ? (
                                <>
                                  <span className="text-blue-600">👥 {collateral.group_pret_id}</span>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Prêt de groupe
                                  </div>
                                </>
                              ) : (
                                collateral.pret_id
                              )}
                              {pret && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Statut: {pret.statut === 'termine' ? (
                                    <span className="text-green-600 font-semibold">✓ Terminé</span>
                                  ) : pret.statut === 'en_attente_garantie' && collateral.statut === 'complet' ? (
                                    <span className="text-purple-600 font-semibold">✅ Garantie complète - En attente d'approbation</span>
                                  ) : pret.statut === 'en_attente_garantie' ? (
                                    <span className="text-orange-600 font-semibold">⏳ En attente de garantie</span>
                                  ) : pret.statut === 'actif' ? (
                                    <span className="text-blue-600 font-semibold">✓ Actif</span>
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
                                onClick={() => openWithdrawalForm(collateral)}
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
                            ) : collateral.statut === 'partiel' ? (
                              <Button
                                onClick={() => {
                                  setFormData({
                                    collateral_id: collateral.id.toString(),
                                    pret_id: collateral.pret_id || '',
                                    group_pret_id: collateral.group_pret_id || '',
                                    montant_depose: '',
                                    date_depot: new Date().toISOString().split('T')[0],
                                    notes: '',
                                  })
                                  setShowForm(true)
                                  setShowWithdrawalForm(false)
                                }}
                                variant="outline"
                                size="sm"
                              >
                                Ajouter dépôt
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

