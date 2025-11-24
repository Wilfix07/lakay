'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { supabase, type Pret, type Membre, type Agent, type UserProfile, type GroupPret, type Collateral, type LoanAmountBracket } from '@/lib/supabase'
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils'
import { addDays, addMonths, getDay } from 'date-fns'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useRouter } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  getScheduleSettings,
  getInterestRates,
  validateLoanAmount,
  calculateCollateralAmount,
  getLoanAmountBrackets,
  getCollateralSettings,
  getRepaymentFrequencies,
} from '@/lib/systemSettings'
import { useDynamicData } from '@/lib/contexts/DynamicDataContext'

import { type FrequenceRemboursement, type LoanPlan, type LoanScheduleEntry } from '@/lib/loanUtils'

function PretsPageContent() {
  const router = useRouter()
  const { repaymentFrequencies } = useDynamicData()
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [collaterals, setCollaterals] = useState<Collateral[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPret, setEditingPret] = useState<Pret | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [systemInterestRate, setSystemInterestRate] = useState(0.15)
  const [systemDefaultInstallments, setSystemDefaultInstallments] = useState(23)
  const [collateralRatePercent, setCollateralRatePercent] = useState(10)
  const [loanBrackets, setLoanBrackets] = useState<Array<Partial<LoanAmountBracket> & { id: number; min_amount: number; max_amount: number | null; default_interest_rate: number | null; is_active: boolean }>>([])
  const [amountValidationMessage, setAmountValidationMessage] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    membre_id: '',
    group_id: '',
    agent_id: '',
    montant_pret: '',
    date_decaissement: new Date().toISOString().split('T')[0],
    frequence_remboursement: 'journalier' as FrequenceRemboursement,
    nombre_remboursements: '23',
  })
  const [loanType, setLoanType] = useState<'membre' | 'groupe'>('membre')
  const [groups, setGroups] = useState<Array<{ id: number; group_name: string; agent_id: string; description?: string | null; created_at: string; member_count?: number }>>([])
  // Permettre aux agents de saisir manuellement les dates d'échéance
  const [manualScheduleEnabled, setManualScheduleEnabled] = useState<boolean>(false)
  const [manualInstallmentDates, setManualInstallmentDates] = useState<string[]>([])
  // Montants personnalisés pour chaque membre du groupe
  const [groupMemberAmounts, setGroupMemberAmounts] = useState<Record<string, string>>({})
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Membre[]>([])
  
  // Mettre à jour la fréquence par défaut quand les fréquences sont chargées
  useEffect(() => {
    if (repaymentFrequencies.length > 0 && !editingPret && !showForm) {
      const defaultFrequency = repaymentFrequencies[0].key as FrequenceRemboursement
      const defaultInstallments =
        defaultFrequency === 'mensuel'
          ? '6'
          : defaultFrequency === 'hebdomadaire'
          ? '4'
          : systemDefaultInstallments.toString()
      setFormData(prev => ({
        ...prev,
        frequence_remboursement: defaultFrequency,
        nombre_remboursements: defaultInstallments,
      }))
    }
  }, [repaymentFrequencies, systemDefaultInstallments, editingPret, showForm])
  const [memberCollateralBalance, setMemberCollateralBalance] = useState(0)
  const [collateralDeposit, setCollateralDeposit] = useState('')
  const [showCollateralDeposit, setShowCollateralDeposit] = useState(false)
  const [loadingCollateralBalance, setLoadingCollateralBalance] = useState(false)
  const [collateralRequirement, setCollateralRequirement] = useState<{
    montantRequis: number
    montantRestant: number
  } | null>(null)
  const [memberSearchOpen, setMemberSearchOpen] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const memberSearchInputRef = useRef<HTMLInputElement>(null)

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

  function adjustToBusinessDay(date: Date): Date {
    let adjusted = new Date(date)
    const day = getDay(adjusted)
    if (day === 6) {
      adjusted = addDays(adjusted, 2)
    } else if (day === 0) {
      adjusted = addDays(adjusted, 1)
    }
    return adjusted
  }

  function getInitialPaymentDate(dateDecaissement: Date, frequency: FrequenceRemboursement): Date {
    if (frequency === 'mensuel') {
      return adjustToBusinessDay(addMonths(dateDecaissement, 1))
    }
    if (frequency === 'hebdomadaire') {
      return adjustToBusinessDay(addDays(dateDecaissement, 7))
    }
    return adjustToBusinessDay(addDays(dateDecaissement, 2))
  }

  function getNextPaymentDate(current: Date, frequency: FrequenceRemboursement): Date {
    if (frequency === 'mensuel') {
      return adjustToBusinessDay(addMonths(current, 1))
    }
    if (frequency === 'hebdomadaire') {
      return adjustToBusinessDay(addDays(current, 7))
    }
    return adjustToBusinessDay(addDays(current, 1))
  }

  function calculateLoanPlan(
    amount: number,
    frequency: FrequenceRemboursement,
    count: number,
    decaissementDate: string,
  ): LoanPlan {
    // Utilise le taux d'intérêt chargé depuis les paramètres système
    const interestRate = systemInterestRate
    const schedule: LoanScheduleEntry[] = []
    let dateDecaissement = new Date(decaissementDate)
    if (Number.isNaN(dateDecaissement.getTime())) {
      dateDecaissement = new Date()
    }

    if (!(amount > 0) || !(count > 0)) {
      const baseDate = getInitialPaymentDate(dateDecaissement, frequency)
      return {
        montantEcheance: 0,
        totalRemboursement: 0,
        interetTotal: 0,
        datePremierRemboursement: baseDate,
        dateDecaissement: new Date(dateDecaissement),
        dateFin: baseDate,
        duree: 0,
        schedule,
      }
    }

    let paymentDate = getInitialPaymentDate(dateDecaissement, frequency)
    const basePrincipal = amount / count
    const basePrincipalRounded = Math.round(basePrincipal * 100) / 100
    let remainingPrincipal = Math.round(amount * 100) / 100

    for (let i = 1; i <= count; i++) {
      let principal = i === count ? Math.round(remainingPrincipal * 100) / 100 : basePrincipalRounded
      principal = Math.max(principal, 0)
      remainingPrincipal = Math.round((remainingPrincipal - principal) * 100) / 100
      const interest = Math.round(principal * interestRate * 100) / 100
      const installmentAmount = Math.round((principal + interest) * 100) / 100

      schedule.push({
        numero: i,
        montant: installmentAmount,
        principal,
        interet: interest,
        date: new Date(paymentDate),
      })

      if (i < count) {
        paymentDate = getNextPaymentDate(paymentDate, frequency)
      }
    }

    const montantEcheance =
      schedule[0]?.montant ?? Math.round((basePrincipalRounded * (1 + interestRate)) * 100) / 100
    const totalRemboursement =
      Math.round(schedule.reduce((sum, entry) => sum + entry.montant, 0) * 100) / 100
    const interetTotal =
      Math.round(schedule.reduce((sum, entry) => sum + entry.interet, 0) * 100) / 100

    // Calculer la date de fin (dernière échéance)
    const dateFin = schedule.length > 0 ? schedule[schedule.length - 1].date : paymentDate
    
    // Calculer la durée en jours entre le décaissement et la fin
    const duree = Math.ceil((dateFin.getTime() - dateDecaissement.getTime()) / (1000 * 60 * 60 * 24))

    return {
      montantEcheance,
      totalRemboursement,
      interetTotal,
      datePremierRemboursement: schedule[0]?.date ?? paymentDate,
      dateDecaissement: new Date(dateDecaissement),
      dateFin,
      duree,
      schedule,
    }
  }

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadSystemSettings()
      loadAgents()
      loadMembres()
      loadPrets()
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        setFormData(prev => ({ ...prev, agent_id: userProfile.agent_id! }))
        loadGroups()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  // Synchroniser le nombre de champs de dates manuelles avec le nombre d'échéances
  useEffect(() => {
    const count = parseInt(formData.nombre_remboursements, 10)
    if (!Number.isFinite(count) || count <= 0) {
      setManualInstallmentDates([])
      return
    }
    setManualInstallmentDates(prev => {
      const next = [...prev]
      if (next.length < count) {
        while (next.length < count) next.push('')
      } else if (next.length > count) {
        next.length = count
      }
      return next
    })
  }, [formData.nombre_remboursements])

  // Charger les membres du groupe quand un groupe est sélectionné
  useEffect(() => {
    async function loadGroupMembers() {
      if (loanType === 'groupe' && formData.group_id) {
        try {
          const { data: groupMembersData, error } = await supabase
            .from('membre_group_members')
            .select('membre_id')
            .eq('group_id', parseInt(formData.group_id))

          if (error) throw error

          const memberIds = groupMembersData?.map(m => m.membre_id) || []
          const groupMembers = membres.filter(m => memberIds.includes(m.membre_id))
          setSelectedGroupMembers(groupMembers)

          // Initialiser les montants à vide
          const initialAmounts: Record<string, string> = {}
          groupMembers.forEach(m => {
            initialAmounts[m.membre_id] = ''
          })
          setGroupMemberAmounts(initialAmounts)
        } catch (error) {
          console.error('Erreur lors du chargement des membres du groupe:', error)
          setSelectedGroupMembers([])
          setGroupMemberAmounts({})
        }
      } else {
        setSelectedGroupMembers([])
        setGroupMemberAmounts({})
      }
    }
    loadGroupMembers()
  }, [formData.group_id, loanType, membres])

  // Charger le solde de garantie du membre quand le membre est sélectionné
  useEffect(() => {
    if (formData.membre_id) {
      loadMemberCollateralBalance(formData.membre_id)
    } else {
      setMemberCollateralBalance(0)
      setShowCollateralDeposit(false)
      setCollateralDeposit('')
    }
  }, [formData.membre_id])

  // Vérifier si un dépôt de garantie est nécessaire quand le montant du prêt change
  useEffect(() => {
    if (formData.membre_id && formData.montant_pret) {
      checkCollateralRequirement()
    } else {
      setShowCollateralDeposit(false)
      setCollateralDeposit('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.montant_pret, memberCollateralBalance, formData.membre_id])

  async function loadSystemSettings() {
    try {
      // Charger les taux d'intérêt
      const rates = await getInterestRates()
      setSystemInterestRate(rates.baseInterestRate)

      // Charger les paramètres d'échéancier
      const scheduleSettings = await getScheduleSettings()
      setSystemDefaultInstallments(scheduleSettings.totalInstallments)
      
      // Mettre à jour le nombre d'échéances par défaut dans le formulaire
      setFormData(prev => ({
        ...prev,
        nombre_remboursements: scheduleSettings.totalInstallments.toString(),
      }))

      // Charger les barèmes de montants
      const brackets = await getLoanAmountBrackets()
      setLoanBrackets(brackets)

      // Charger le taux de garantie
      const collateralSettings = await getCollateralSettings()
      setCollateralRatePercent(collateralSettings.collateralRate)
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres système:', error)
    }
  }

  async function loadMemberCollateralBalance(membreId: string) {
    setLoadingCollateralBalance(true)
    try {
      // Calculer le solde disponible (non bloqué) sur le compte épargne du membre
      const { data: transactions, error } = await supabase
        .from('epargne_transactions')
        .select('montant, type, is_blocked')
        .eq('membre_id', membreId)

      if (error) throw error

      // Calculer le solde total et le solde bloqué
      let soldeTotal = 0
      let soldeBloque = 0

      transactions?.forEach((t) => {
        const montant = Number(t.montant || 0)
        if (t.type === 'depot') {
          soldeTotal += montant
          if (t.is_blocked) {
            soldeBloque += montant
          }
        } else {
          soldeTotal -= montant
          // Pour les retraits, on ne peut pas retirer de l'argent bloqué
        }
      })

      // Le solde disponible est le solde total moins le solde bloqué
      const soldeDisponible = Math.max(0, soldeTotal - soldeBloque)
      setMemberCollateralBalance(soldeDisponible)
    } catch (error) {
      console.error('Erreur lors du chargement du solde d\'épargne:', error)
      setMemberCollateralBalance(0)
    } finally {
      setLoadingCollateralBalance(false)
    }
  }

  async function checkCollateralRequirement() {
    if (!formData.membre_id || !formData.montant_pret) {
      setShowCollateralDeposit(false)
      setCollateralRequirement(null)
      return
    }

    const montantPret = parseFloat(formData.montant_pret)
    if (isNaN(montantPret) || montantPret <= 0) {
      setShowCollateralDeposit(false)
      setCollateralRequirement(null)
      return
    }

    try {
      // Calculer la garantie requise pour ce prêt
      const montantGarantieRequis = await calculateCollateralAmount(montantPret)
      
      // Si le solde disponible + ce qui doit être déposé < requis, montrer le champ de dépôt
      const soldeDisponible = memberCollateralBalance
      const montantRestant = Math.max(montantGarantieRequis - soldeDisponible, 0)
      
      setCollateralRequirement({
        montantRequis: montantGarantieRequis,
        montantRestant,
      })
      
      if (montantRestant > 0) {
        setShowCollateralDeposit(true)
        // Suggérer le montant restant comme valeur par défaut
        if (!collateralDeposit || parseFloat(collateralDeposit) === 0) {
          setCollateralDeposit(montantRestant.toFixed(2))
        }
      } else {
        setShowCollateralDeposit(false)
        setCollateralDeposit('')
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la garantie:', error)
      setCollateralRequirement(null)
    }
  }

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadAgents() {
    try {
      let query = supabase
        .from('agents')
        .select('*')
        .order('agent_id', { ascending: true })

      // Filtrer par manager_id si l'utilisateur est un manager
      if (userProfile?.role === 'manager') {
        query = query.eq('manager_id', userProfile.id)
      }
      // Admin voit tous les agents, Agent voit seulement son agent

      const { data, error } = await query

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error)
    }
  }

  async function loadMembres() {
    try {
      let query = supabase
        .from('membres')
        .select('*')
        .order('membre_id', { ascending: true })

      // Les agents ne voient que leurs propres membres
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Manager voit seulement les membres de ses agents
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          query = query.in('agent_id', agentIds)
        } else {
          // Si le manager n'a pas encore d'agents, retourner un tableau vide
          setMembres([])
          return
        }
      }
      // Admin voit tous les membres (pas de filtre)

      const { data, error } = await query

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
    }
  }

  async function loadGroups() {
    try {
      if (!userProfile?.agent_id) return

      const { data: groupsData, error } = await supabase
        .from('membre_groups')
        .select('*')
        .eq('agent_id', userProfile.agent_id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Charger le nombre de membres pour chaque groupe
      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count, error: countError } = await supabase
            .from('membre_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)

          if (countError) throw countError

          return {
            ...group,
            member_count: count || 0,
          }
        })
      )

      setGroups(groupsWithCounts)
    } catch (error) {
      console.error('Erreur lors du chargement des groupes:', error)
    }
  }

  async function loadPrets() {
    try {
      let query = supabase
        .from('prets')
        .select('*')
        .order('created_at', { ascending: false })

      // Les agents ne voient que leurs propres prêts
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Manager voit seulement les prêts de ses agents
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          query = query.in('agent_id', agentIds)
        } else {
          // Si le manager n'a pas encore d'agents, retourner un tableau vide
          setPrets([])
          return
        }
      }
      // Admin voit tous les prêts (pas de filtre)

      const { data, error } = await query

      if (error) throw error
      setPrets(data || [])

      // Charger aussi les garanties pour vérifier leur statut
      if (data && data.length > 0) {
        const pretIds = data.map(p => p.pret_id)
        const { data: collateralsData, error: collateralsError } = await supabase
          .from('collaterals')
          .select('pret_id, statut, montant_restant')
          .in('pret_id', pretIds)

        if (!collateralsError && collateralsData) {
          // Store partial collateral data for status checking - cast to Collateral[] for compatibility
          setCollaterals(collateralsData as unknown as Collateral[])
        }
      } else {
        setCollaterals([])
      }

      // Charger aussi les prêts de groupe
      let groupQuery = supabase
        .from('group_prets')
        .select('*')
        .order('created_at', { ascending: false })

      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        groupQuery = groupQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          groupQuery = groupQuery.in('agent_id', agentIds)
        } else {
          setGroupPrets([])
          return
        }
      }

      const { data: groupPretsData, error: groupPretsError } = await groupQuery

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
    } catch (error) {
      console.error('Erreur lors du chargement des prêts:', error)
      alert('Erreur lors du chargement des prêts')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    if (editingPret) {
      handleUpdatePret(e)
      return
    }
    e.preventDefault()
    try {
      // Pour les agents, s'assurer que l'agent_id est automatiquement assigné
      // IMPORTANT: Les agents peuvent créer des prêts sans autorisation du manager
      let finalAgentId = formData.agent_id
      
      if (userProfile?.role === 'agent') {
        // Pour les agents, utiliser directement l'agent_id du profil utilisateur
        if (userProfile.agent_id) {
          finalAgentId = userProfile.agent_id
        } else if (formData.agent_id) {
          // Fallback: utiliser formData si disponible
          finalAgentId = formData.agent_id
        }
      }

      // Vérifier que l'agent_id est présent
      if (!finalAgentId) {
        if (userProfile?.role === 'agent') {
          alert('Erreur: Votre profil agent n\'a pas d\'agent_id assigné. Veuillez contacter l\'administrateur pour corriger votre profil utilisateur.')
          return
        } else {
          alert('Erreur: Agent de crédit non spécifié. Veuillez sélectionner un agent.')
          return
        }
      }

      const montantPret = parseFloat(formData.montant_pret)
      const nombreRemboursements = parseInt(formData.nombre_remboursements, 10)
      const frequency = (['journalier','hebdomadaire','mensuel'].includes(formData.frequence_remboursement as any)
        ? (formData.frequence_remboursement as FrequenceRemboursement)
        : 'journalier') as FrequenceRemboursement
      
      // Validation
      if (isNaN(montantPret) || montantPret <= 0) {
        alert('Le montant du prêt doit être un nombre positif')
        return
      }

      if (isNaN(nombreRemboursements) || nombreRemboursements <= 0) {
        alert('Veuillez saisir une durée valide (nombre d\'échéances).')
        return
      }

      // Validation selon le type de prêt
      if (loanType === 'membre' && !formData.membre_id) {
        alert('Veuillez sélectionner un membre')
        return
      }

      if (loanType === 'groupe' && !formData.group_id) {
        alert('Veuillez sélectionner un groupe')
        return
      }

      // Valider le montant selon les barèmes configurés
      const validation = await validateLoanAmount(montantPret)
      if (!validation.valid) {
        alert(validation.message || 'Le montant du prêt n\'est pas dans les limites autorisées.')
        return
      }

      // Vérifier si le membre/groupe a déjà un prêt actif
      if (loanType === 'membre') {
        // 1. Vérifier les prêts individuels actifs
        // IMPORTANT: Cette vérification est critique pour empêcher les doublons
        const { data: activeLoans, error: activeLoansError } = await supabase
          .from('prets')
          .select('id, pret_id, statut, date_decaissement')
          .eq('membre_id', formData.membre_id)
          .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])

        if (activeLoansError) {
          console.error('Erreur lors de la vérification des prêts actifs:', activeLoansError)
          throw activeLoansError
        }
        
        if (activeLoans && activeLoans.length > 0) {
          const activeLoanIds = activeLoans.map(l => l.pret_id).join(', ')
          alert(
            `❌ IMPOSSIBLE: Ce membre a déjà ${activeLoans.length} prêt(s) actif(s): ${activeLoanIds}\n\n` +
            `Un membre ne peut avoir qu'UN SEUL prêt actif à la fois (actif, en attente de garantie, ou en attente d'approbation).\n\n` +
            `Le membre doit terminer de rembourser son prêt actif ou compléter la garantie avant de contracter un nouveau prêt.`
          )
          return
        }

        // 2. Vérifier si le membre a un prêt de groupe actif
        try {
          const { data: activeGroupRemboursements, error: groupRemboursementsError } = await supabase
            .from('group_remboursements')
            .select('pret_id, statut')
            .eq('membre_id', formData.membre_id)
            .in('statut', ['en_attente', 'paye_partiel', 'en_retard'])

          if (!groupRemboursementsError && activeGroupRemboursements && activeGroupRemboursements.length > 0) {
            // Récupérer les prêts de groupe associés
            const pretIds = [...new Set(activeGroupRemboursements.map(r => r.pret_id))]
            const { data: activeGroupPrets, error: groupPretsError } = await supabase
              .from('group_prets')
              .select('pret_id, statut')
              .in('pret_id', pretIds)
              .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])

            if (!groupPretsError && activeGroupPrets && activeGroupPrets.length > 0) {
              alert(`Ce membre fait déjà partie d'un prêt de groupe actif (${activeGroupPrets[0].pret_id}). Il ne peut pas contracter un prêt individuel tant qu'il n'a pas terminé de rembourser son prêt de groupe.`)
              return
            }
          }
        } catch (error: any) {
          // Si la table group_remboursements n'existe pas, ignorer l'erreur
          if (error?.code !== '42P01' && error?.code !== 'PGRST116') {
            console.warn('Erreur lors de la vérification des prêts de groupe:', error)
          }
        }
      } else {
        // Pour les groupes, vérifier si le groupe a déjà un prêt actif
        const { data: activeGroupLoans, error: activeGroupLoansError } = await supabase
          .from('group_prets')
          .select('id, pret_id, statut')
          .eq('group_id', parseInt(formData.group_id))
          .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])

        if (activeGroupLoansError) throw activeGroupLoansError
        if (activeGroupLoans && activeGroupLoans.length > 0) {
          alert(`Ce groupe a déjà un prêt actif (${activeGroupLoans[0].pret_id}), en attente de garantie ou en attente d'approbation. Il doit terminer de le rembourser avant de contracter un nouveau prêt.`)
          return
        }

        // Valider que tous les membres ont un montant saisi et que la somme correspond au montant total
        if (selectedGroupMembers.length === 0) {
          alert('Erreur: Aucun membre trouvé dans ce groupe')
          return
        }

        // Vérifier que chaque membre du groupe n'a pas déjà un prêt individuel actif
        const memberIds = selectedGroupMembers.map(m => m.membre_id)
        const { data: membersWithActiveLoans, error: membersLoansError } = await supabase
          .from('prets')
          .select('membre_id, pret_id, statut')
          .in('membre_id', memberIds)
          .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])

        if (membersLoansError) throw membersLoansError
        if (membersWithActiveLoans && membersWithActiveLoans.length > 0) {
          const problematicMembers = membersWithActiveLoans.map(loan => {
            const member = selectedGroupMembers.find(m => m.membre_id === loan.membre_id)
            return member ? `${member.membre_id} - ${member.prenom} ${member.nom}` : loan.membre_id
          }).join(', ')
          alert(`Les membres suivants ont déjà un prêt individuel actif et ne peuvent pas faire partie d'un prêt de groupe:\n\n${problematicMembers}\n\nIls doivent terminer leur prêt individuel avant de pouvoir participer à un prêt de groupe.`)
          return
        }

        // Vérifier que chaque membre du groupe n'a pas déjà un autre prêt de groupe actif
        try {
          const { data: membersWithActiveGroupLoans, error: membersGroupLoansError } = await supabase
            .from('group_remboursements')
            .select('membre_id, pret_id, statut')
            .in('membre_id', memberIds)
            .in('statut', ['en_attente', 'paye_partiel', 'en_retard'])

          if (!membersGroupLoansError && membersWithActiveGroupLoans && membersWithActiveGroupLoans.length > 0) {
            // Récupérer les prêts de groupe associés pour vérifier leur statut
            const pretIds = [...new Set(membersWithActiveGroupLoans.map(r => r.pret_id))]
            const { data: activeGroupPretsForMembers, error: groupPretsForMembersError } = await supabase
              .from('group_prets')
              .select('pret_id, statut, group_id')
              .in('pret_id', pretIds)
              .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])
              .neq('group_id', parseInt(formData.group_id)) // Exclure le groupe actuel

            if (!groupPretsForMembersError && activeGroupPretsForMembers && activeGroupPretsForMembers.length > 0) {
              const problematicMembers = membersWithActiveGroupLoans
                .filter(r => activeGroupPretsForMembers.some(p => p.pret_id === r.pret_id))
                .map(r => {
                  const member = selectedGroupMembers.find(m => m.membre_id === r.membre_id)
                  return member ? `${member.membre_id} - ${member.prenom} ${member.nom}` : r.membre_id
                })
                .filter((v, i, a) => a.indexOf(v) === i) // Dédupliquer
                .join(', ')
              
              alert(`Les membres suivants font déjà partie d'un autre prêt de groupe actif et ne peuvent pas participer à un nouveau prêt de groupe:\n\n${problematicMembers}\n\nIls doivent terminer leur prêt de groupe actuel avant de pouvoir participer à un nouveau prêt de groupe.`)
              return
            }
          }
        } catch (error: any) {
          // Si la table group_remboursements n'existe pas, ignorer l'erreur
          if (error?.code !== '42P01' && error?.code !== 'PGRST116') {
            console.warn('Erreur lors de la vérification des prêts de groupe pour les membres:', error)
          }
        }

        const totalMemberAmounts = selectedGroupMembers.reduce((sum, member) => {
          const amount = groupMemberAmounts[member.membre_id]
          if (!amount || amount.trim() === '') {
            return NaN // Indique qu'un montant est manquant
          }
          const numAmount = parseFloat(amount)
          if (isNaN(numAmount) || numAmount <= 0) {
            return NaN
          }
          return sum + numAmount
        }, 0)

        if (isNaN(totalMemberAmounts)) {
          alert('Veuillez saisir un montant valide (positif) pour chaque membre du groupe')
          return
        }

        const difference = Math.abs(totalMemberAmounts - montantPret)
        if (difference > 0.01) { // Tolérance de 0.01 HTG pour les arrondis
          alert(`La somme des montants individuels (${formatCurrency(totalMemberAmounts)}) ne correspond pas au montant total du prêt (${formatCurrency(montantPret)}).\n\nDifférence: ${formatCurrency(difference)}`)
          return
        }
      }

      // Vérifier que la garantie est disponible sur le compte épargne
      const montantGarantieRequisCheck = await calculateCollateralAmount(montantPret)
      
      // Pour les prêts individuels, vérifier que le solde disponible est suffisant
      if (loanType === 'membre') {
        if (memberCollateralBalance < montantGarantieRequisCheck) {
          alert(
            `❌ Solde d'épargne insuffisant pour la garantie.\n\n` +
            `Montant de garantie requis: ${formatCurrency(montantGarantieRequisCheck)}\n` +
            `Solde disponible sur le compte épargne: ${formatCurrency(memberCollateralBalance)}\n` +
            `Montant manquant: ${formatCurrency(montantGarantieRequisCheck - memberCollateralBalance)}\n\n` +
            `Le membre doit avoir au moins ${formatCurrency(montantGarantieRequisCheck)} sur son compte épargne pour obtenir ce prêt.`
          )
          return
        }
      }

      const plan = calculateLoanPlan(
        montantPret,
        frequency,
        nombreRemboursements,
        formData.date_decaissement,
      )

      if (plan.schedule.length !== nombreRemboursements) {
        alert('Impossible de générer l\'échéancier. Vérifiez les paramètres.')
        return
      }

      // Si agent et dates manuelles valides, écraser les dates calculées
      let overriddenPlan = plan
      if (userProfile?.role === 'agent' && manualScheduleEnabled) {
        const validDates = manualInstallmentDates.filter(Boolean)
        if (validDates.length === nombreRemboursements) {
          overriddenPlan = {
            ...plan,
            datePremierRemboursement: new Date(validDates[0]),
            schedule: plan.schedule.map((entry, idx) => ({
              ...entry,
              date: new Date(validDates[idx]),
            })),
          }
        }
      }

      // Générer le pret_id automatiquement
      const monthName = getMonthName(new Date(formData.date_decaissement))
      const tableName = loanType === 'groupe' ? 'group_prets' : 'prets'
      
      // Si l'utilisateur est un manager, filtrer par ses agents pour garantir l'unicité au niveau du manager
      let agentIdsForUniqueness: string[] | null = null
      if (userProfile?.role === 'manager') {
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError
        agentIdsForUniqueness = managerAgents?.map(a => a.agent_id) || []
      }

      // Récupérer les prêts existants pour ce mois
      let maxPretsQuery = supabase
        .from(tableName)
        .select('pret_id')
        .filter('pret_id', 'like', `CL-%${monthName}`)
        .order('pret_id', { ascending: false })
        .limit(1)

      // Si manager, filtrer par ses agents uniquement
      if (userProfile?.role === 'manager' && agentIdsForUniqueness && agentIdsForUniqueness.length > 0) {
        maxPretsQuery = maxPretsQuery.in('agent_id', agentIdsForUniqueness)
      }

      const { data: maxPrets } = await maxPretsQuery

      let newPretId = `CL-000-${monthName}`
      if (maxPrets && maxPrets.length > 0 && maxPrets[0]) {
        const match = maxPrets[0].pret_id.match(/CL-(\d+)-/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (!isNaN(num)) {
            newPretId = `CL-${String(num + 1).padStart(3, '0')}-${monthName}`
          }
        }
      }

      // Vérifier l'unicité du pret_id avant insertion (surtout pour les managers)
      if (userProfile?.role === 'manager' && agentIdsForUniqueness && agentIdsForUniqueness.length > 0) {
        const { data: existingPret, error: checkError } = await supabase
          .from(tableName)
          .select('pret_id')
          .eq('pret_id', newPretId)
          .in('agent_id', agentIdsForUniqueness)
          .limit(1)

        if (checkError) throw checkError

        if (existingPret && existingPret.length > 0) {
          // Si le pret_id existe déjà, générer le suivant
          const match = newPretId.match(/CL-(\d+)-/)
          if (match) {
            const num = parseInt(match[1], 10)
            if (!isNaN(num)) {
              newPretId = `CL-${String(num + 1).padStart(3, '0')}-${monthName}`
            }
          }
        }
      }

      // Déterminer le statut initial selon le rôle de l'utilisateur
      const initialStatus = 'en_attente_garantie'
      let groupCollaterals: Partial<Collateral>[] = [] // Pour stocker les garanties de groupe
      // Variable pour stocker les membres sans garantie (pour les prêts de groupe)
      let membresSansGarantie: string[] = []

      if (loanType === 'membre') {
        // Créer le prêt pour un membre individuel
        const { error: pretError } = await supabase
          .from('prets')
          .insert([{
            pret_id: newPretId,
            membre_id: formData.membre_id,
            agent_id: finalAgentId,
            montant_pret: montantPret,
            montant_remboursement: overriddenPlan.montantEcheance,
            nombre_remboursements: nombreRemboursements,
            date_decaissement: formData.date_decaissement,
            date_premier_remboursement: overriddenPlan.datePremierRemboursement
              .toISOString()
              .split('T')[0],
            statut: initialStatus,
            capital_restant: montantPret,
            frequence_remboursement: frequency,
          }])

        if (pretError) {
          // Vérifier si c'est une violation de contrainte unique (membre avec prêt actif)
          if (pretError.code === '23505' || pretError.message?.includes('uniq_prets_membre_actif')) {
            // Récupérer les prêts actifs du membre pour afficher un message détaillé
            const { data: activeLoans } = await supabase
              .from('prets')
              .select('pret_id, statut')
              .eq('membre_id', formData.membre_id)
              .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])
            
            const activeLoanIds = activeLoans?.map(l => l.pret_id).join(', ') || 'inconnu'
            alert(
              `❌ ERREUR: Impossible de créer le prêt.\n\n` +
              `Ce membre a déjà un prêt actif dans la base de données: ${activeLoanIds}\n\n` +
              `Un membre ne peut avoir qu'UN SEUL prêt actif à la fois.\n\n` +
              `Veuillez terminer le prêt existant avant d'en créer un nouveau.`
            )
            return
          }
          throw pretError
        }

        // Bloquer la garantie sur le compte épargne du membre
        const montantGarantieRequis = montantGarantieRequisCheck
        
        // Récupérer les transactions d'épargne disponibles (non bloquées) du membre
        const { data: epargneTransactions, error: epargneError } = await supabase
          .from('epargne_transactions')
          .select('id, montant, type, is_blocked')
          .eq('membre_id', formData.membre_id)
          .order('created_at', { ascending: true })

        if (epargneError) {
          console.error('Erreur lors du chargement des transactions d\'épargne:', epargneError)
          throw new Error('Erreur lors de la vérification du compte épargne. Le prêt ne peut pas être créé.')
        }

        // Calculer le solde disponible
        let soldeDisponible = 0
        const transactionsDisponibles: Array<{ id: number; montant: number }> = []
        
        epargneTransactions?.forEach((t) => {
          const montant = Number(t.montant || 0)
          if (t.type === 'depot' && !t.is_blocked) {
            soldeDisponible += montant
            transactionsDisponibles.push({ id: t.id, montant })
          } else if (t.type === 'retrait') {
            soldeDisponible -= montant
          }
        })

        if (soldeDisponible < montantGarantieRequis) {
          alert(
            `❌ Solde d'épargne insuffisant pour bloquer la garantie.\n\n` +
            `Montant de garantie requis: ${formatCurrency(montantGarantieRequis)}\n` +
            `Solde disponible: ${formatCurrency(soldeDisponible)}\n\n` +
            `Le membre doit avoir au moins ${formatCurrency(montantGarantieRequis)} sur son compte épargne.`
          )
          return
        }

        // Bloquer le montant requis en marquant les transactions d'épargne
        let montantRestantABloquer = montantGarantieRequis
        const transactionsABloquer: number[] = []

        for (const trans of transactionsDisponibles) {
          if (montantRestantABloquer <= 0) break
          transactionsABloquer.push(trans.id)
          montantRestantABloquer -= trans.montant
        }

        // Mettre à jour les transactions pour les bloquer
        if (transactionsABloquer.length > 0) {
          const { error: blockError } = await supabase
            .from('epargne_transactions')
            .update({
              is_blocked: true,
              blocked_for_pret_id: newPretId,
            })
            .in('id', transactionsABloquer)

          if (blockError) {
            console.error('Erreur lors du blocage de la garantie:', blockError)
            throw new Error('Erreur lors du blocage de la garantie sur le compte épargne. Le prêt ne peut pas être créé.')
          }
        }
      } else {
        // Créer le prêt pour un groupe
        // Récupérer les membres du groupe
        const { data: groupMembers, error: groupMembersError } = await supabase
          .from('membre_group_members')
          .select('membre_id')
          .eq('group_id', parseInt(formData.group_id))

        if (groupMembersError) throw groupMembersError
        if (!groupMembers || groupMembers.length === 0) {
          alert('Erreur: Le groupe sélectionné ne contient aucun membre')
          return
        }

        // Créer le prêt de groupe
        const { error: groupPretError } = await supabase
          .from('group_prets')
          .insert([{
            pret_id: newPretId,
            group_id: parseInt(formData.group_id),
            agent_id: finalAgentId,
            montant_pret: montantPret,
            montant_remboursement: overriddenPlan.montantEcheance,
            nombre_remboursements: nombreRemboursements,
            date_decaissement: formData.date_decaissement,
            date_premier_remboursement: overriddenPlan.datePremierRemboursement
              .toISOString()
              .split('T')[0],
            statut: initialStatus,
            capital_restant: montantPret,
            frequence_remboursement: frequency,
          }])

        if (groupPretError) throw groupPretError

        // Créer les remboursements pour chaque membre du groupe avec leurs montants personnalisés
        const groupRemboursements = []
        for (const member of groupMembers) {
          const memberAmount = parseFloat(groupMemberAmounts[member.membre_id])
          if (isNaN(memberAmount) || memberAmount <= 0) {
            throw new Error(`Montant invalide pour le membre ${member.membre_id}`)
          }

          // Calculer le plan de remboursement pour ce membre avec son montant spécifique
          const memberPlan = calculateLoanPlan(
            memberAmount,
            frequency,
            nombreRemboursements,
            formData.date_decaissement,
          )

          // Utiliser les dates manuelles si activées
          let memberSchedule = memberPlan.schedule
          if (userProfile?.role === 'agent' && manualScheduleEnabled) {
            const validDates = manualInstallmentDates.filter(Boolean)
            if (validDates.length === nombreRemboursements) {
              memberSchedule = memberPlan.schedule.map((entry, idx) => ({
                ...entry,
                date: new Date(validDates[idx]),
              }))
            }
          }

          for (const entry of memberSchedule) {
            groupRemboursements.push({
              pret_id: newPretId,
              group_id: parseInt(formData.group_id),
              membre_id: member.membre_id,
              agent_id: finalAgentId,
              numero_remboursement: entry.numero,
              montant: entry.montant,
              principal: entry.principal,
              interet: entry.interet,
              date_remboursement: entry.date.toISOString().split('T')[0],
              statut: 'en_attente',
            })
          }
        }

        if (groupRemboursements.length > 0) {
          const { error: remboursementsError } = await supabase
            .from('group_remboursements')
            .insert(groupRemboursements)

          if (remboursementsError) throw remboursementsError
        }

        // Bloquer la garantie sur le compte épargne de chaque membre du groupe
        membresSansGarantie = []
        
        for (const member of groupMembers) {
          const memberAmount = parseFloat(groupMemberAmounts[member.membre_id])
          if (isNaN(memberAmount) || memberAmount <= 0) {
            continue
          }

          // Calculer la garantie requise pour ce membre
          const montantGarantieRequis = await calculateCollateralAmount(memberAmount)
          
          // Vérifier le solde disponible du membre
          const { data: memberTransactions, error: memberEpargneError } = await supabase
            .from('epargne_transactions')
            .select('id, montant, type, is_blocked')
            .eq('membre_id', member.membre_id)
            .order('created_at', { ascending: true })

          if (memberEpargneError) {
            console.error(`Erreur lors du chargement de l'épargne du membre ${member.membre_id}:`, memberEpargneError)
            membresSansGarantie.push(member.membre_id)
            continue
          }

          // Calculer le solde disponible
          let soldeDisponible = 0
          const transactionsDisponibles: Array<{ id: number; montant: number }> = []
          
          memberTransactions?.forEach((t) => {
            const montant = Number(t.montant || 0)
            if (t.type === 'depot' && !t.is_blocked) {
              soldeDisponible += montant
              transactionsDisponibles.push({ id: t.id, montant })
            } else if (t.type === 'retrait') {
              soldeDisponible -= montant
            }
          })

          if (soldeDisponible < montantGarantieRequis) {
            membresSansGarantie.push(member.membre_id)
            continue
          }

          // Bloquer le montant requis
          let montantRestantABloquer = montantGarantieRequis
          const transactionsABloquer: number[] = []

          for (const trans of transactionsDisponibles) {
            if (montantRestantABloquer <= 0) break
            transactionsABloquer.push(trans.id)
            montantRestantABloquer -= trans.montant
          }

          // Mettre à jour les transactions pour les bloquer
          if (transactionsABloquer.length > 0) {
            const { error: blockError } = await supabase
              .from('epargne_transactions')
              .update({
                is_blocked: true,
                blocked_for_group_pret_id: newPretId,
              })
              .in('id', transactionsABloquer)

            if (blockError) {
              console.error(`Erreur lors du blocage de la garantie pour le membre ${member.membre_id}:`, blockError)
              membresSansGarantie.push(member.membre_id)
            }
          }
        }

        if (membresSansGarantie.length > 0) {
          alert(
            `⚠️ Attention: Le prêt de groupe a été créé, mais certains membres n'ont pas assez d'épargne pour bloquer la garantie.\n\n` +
            `Membres concernés: ${membresSansGarantie.join(', ')}\n\n` +
            `Ces membres doivent avoir suffisamment d'épargne avant que le prêt puisse être approuvé.`
          )
        }
      }

      // Message de succès selon le type de prêt
      if (loanType === 'membre') {
        const montantGarantieRequis = montantGarantieRequisCheck
        
        alert(
          `✅ Prêt créé avec succès!\n\n` +
          `📋 Prêt: ${newPretId}\n` +
          `💰 Montant: ${formatCurrency(montantPret)}\n` +
          `🔒 Garantie bloquée: ${formatCurrency(montantGarantieRequis)} (${((montantGarantieRequis / montantPret) * 100).toFixed(0)}%)\n\n` +
          `✅ La garantie a été bloquée sur le compte épargne du membre.\n` +
          `⏳ Statut: En attente d'approbation\n\n` +
          `Le manager peut maintenant approuver le prêt dans la page "Approbations" pour l'activer.`
        )
      } else {
        const groupName = groups.find(g => g.id === parseInt(formData.group_id))?.group_name || 'N/A'
        // Récupérer les membres du groupe pour le message de succès
        const { data: groupMembersForMessage } = await supabase
          .from('membre_group_members')
          .select('membre_id')
          .eq('group_id', parseInt(formData.group_id))
        const totalMembers = groupMembersForMessage?.length || 0
        const membresAvecGarantie = totalMembers - membresSansGarantie.length
        alert(
          `✅ Prêt de groupe créé avec succès!\n\n` +
          `📋 Prêt: ${newPretId}\n` +
          `💰 Montant total: ${formatCurrency(montantPret)}\n` +
          `👥 Groupe: ${groupName}\n` +
          `⏳ Statut: En attente d'approbation\n\n` +
          `📝 Les remboursements ont été créés pour tous les membres du groupe.\n` +
          `💰 Garantie bloquée pour ${membresAvecGarantie} membre(s) sur ${totalMembers}\n` +
          `${membresSansGarantie.length > 0 ? `⚠️ ${membresSansGarantie.length} membre(s) n'a/ont pas assez d'épargne.\n` : ''}\n` +
          `Le manager peut approuver le prêt une fois que tous les membres ont suffisamment d'épargne bloquée.`
        )
      }
      setShowForm(false)
      // Réinitialiser le formulaire, mais garder l'agent_id pour les agents
      const resetAgentId = userProfile?.role === 'agent' && userProfile.agent_id ? userProfile.agent_id : ''
      setFormData({
        membre_id: '',
        group_id: '',
        agent_id: resetAgentId,
        montant_pret: '',
        date_decaissement: new Date().toISOString().split('T')[0],
        frequence_remboursement: 'journalier',
        nombre_remboursements: systemDefaultInstallments.toString(),
      })
      setLoanType('membre')
      setCollateralDeposit('')
      setShowCollateralDeposit(false)
      setMemberCollateralBalance(0)
      setCollateralRequirement(null)
      setManualScheduleEnabled(false)
      setManualInstallmentDates([])
      setGroupMemberAmounts({})
      setSelectedGroupMembers([])
      loadPrets()
    } catch (error: any) {
      console.error('Erreur lors de la création:', error)
      if (error?.code === '23505') {
        alert('Ce membre a déjà un prêt actif. Terminez-le avant d’en créer un nouveau.')
        return
      }
      alert('Erreur: ' + (error.message || 'Erreur inconnue'))
    }
  }

  async function handleEditPret(pret: Pret) {
    // Empêcher la modification des prêts en attente d'approbation
    if (pret.statut === 'en_attente_approbation') {
      alert('Ce prêt est en attente d\'approbation. Veuillez d\'abord l\'approuver ou le rejeter depuis la page Approbations.')
      return
    }
    
    // Empêcher la modification des prêts rejetés (annulés)
    if (pret.statut === 'annule') {
      alert('Ce prêt a été rejeté et ne peut pas être modifié.')
      return
    }
    
    if (!confirm('Voulez-vous modifier ce décaissement ? Les remboursements associés seront également mis à jour.')) {
      return
    }
    setEditingPret(pret)
    setFormData({
      membre_id: pret.membre_id,
      group_id: (pret as any).group_id?.toString() ?? '',
      agent_id: pret.agent_id,
      montant_pret: pret.montant_pret.toString(),
      date_decaissement: pret.date_decaissement,
      frequence_remboursement: (pret.frequence_remboursement as FrequenceRemboursement) ?? 'journalier',
      nombre_remboursements: pret.nombre_remboursements?.toString() ?? '1',
    })
    setShowForm(true)
  }

  async function handleDeletePret(pret: Pret) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le décaissement ${pret.pret_id} ? Cette action supprimera également tous les remboursements associés et est irréversible.`)) {
      return
    }

    try {
      // Supprimer d'abord les remboursements associés
      const { error: remboursementsError } = await supabase
        .from('remboursements')
        .delete()
        .eq('pret_id', pret.pret_id)

      if (remboursementsError) throw remboursementsError

      // Ensuite supprimer le prêt
      const { error: pretError } = await supabase
        .from('prets')
        .delete()
        .eq('id', pret.id)

      if (pretError) throw pretError

      alert('Décaissement supprimé avec succès')
      loadPrets()
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error)
      alert('Erreur lors de la suppression: ' + (error.message || 'Erreur inconnue'))
    }
  }

  async function handleUpdatePret(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPret) return

    // Ne pas générer de calendrier pour les prêts rejetés
    if (editingPret.statut === 'annule') {
      alert('Ce prêt a été rejeté et ne peut pas être modifié.')
      return
    }

    try {
      const montantPret = parseFloat(formData.montant_pret)
      const nombreRemboursements = parseInt(formData.nombre_remboursements, 10)
      const frequency = (['journalier','hebdomadaire','mensuel'].includes(formData.frequence_remboursement as any)
        ? (formData.frequence_remboursement as FrequenceRemboursement)
        : 'journalier') as FrequenceRemboursement
      
      if (isNaN(montantPret) || montantPret <= 0) {
        alert('Le montant du prêt doit être un nombre positif')
        return
      }

      if (isNaN(nombreRemboursements) || nombreRemboursements <= 0) {
        alert('Veuillez saisir une durée valide (nombre d\'échéances).')
        return
      }

      if (!formData.membre_id) {
        alert('Veuillez sélectionner un membre')
        return
      }

      if (formData.membre_id !== editingPret.membre_id) {
        // Vérifier les prêts individuels actifs (exclure le prêt en cours d'édition)
        const { data: activeLoans, error: activeLoansError } = await supabase
          .from('prets')
          .select('id, pret_id, statut')
          .eq('membre_id', formData.membre_id)
          .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])
          .neq('pret_id', editingPret.pret_id) // Exclure le prêt en cours d'édition

        if (activeLoansError) throw activeLoansError
        if (activeLoans && activeLoans.length > 0) {
          alert(`Le membre sélectionné a déjà un prêt actif (${activeLoans[0].pret_id}) ou en attente de garantie. Terminez-le ou complétez la garantie avant de modifier ce prêt.`)
          return
        }

        // Vérifier si le membre a un prêt de groupe actif
        try {
          const { data: activeGroupRemboursements, error: groupRemboursementsError } = await supabase
            .from('group_remboursements')
            .select('pret_id, statut')
            .eq('membre_id', formData.membre_id)
            .in('statut', ['en_attente', 'paye_partiel', 'en_retard'])

          if (!groupRemboursementsError && activeGroupRemboursements && activeGroupRemboursements.length > 0) {
            const pretIds = [...new Set(activeGroupRemboursements.map(r => r.pret_id))]
            const { data: activeGroupPrets, error: groupPretsError } = await supabase
              .from('group_prets')
              .select('pret_id, statut')
              .in('pret_id', pretIds)
              .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])

            if (!groupPretsError && activeGroupPrets && activeGroupPrets.length > 0) {
              alert(`Le membre sélectionné fait déjà partie d'un prêt de groupe actif (${activeGroupPrets[0].pret_id}). Il ne peut pas avoir un prêt individuel tant qu'il n'a pas terminé de rembourser son prêt de groupe.`)
              return
            }
          }
        } catch (error: any) {
          // Si la table group_remboursements n'existe pas, ignorer l'erreur
          if (error?.code !== '42P01' && error?.code !== 'PGRST116') {
            console.warn('Erreur lors de la vérification des prêts de groupe:', error)
          }
        }
      }

      // Ne pas générer de calendrier si le prêt est rejeté
      if ((editingPret.statut as string) === 'annule') {
        alert('Ce prêt a été rejeté. Impossible de générer un calendrier.')
        return
      }

      const plan = calculateLoanPlan(
        montantPret,
        frequency,
        nombreRemboursements,
        formData.date_decaissement,
      )

      if (plan.schedule.length !== nombreRemboursements) {
        alert('Impossible de générer l\'échéancier. Vérifiez les paramètres.')
        return
      }

    // Si agent et dates manuelles valides, écraser les dates calculées
    let overriddenPlan = plan
    if (userProfile?.role === 'agent' && manualScheduleEnabled) {
      const validDates = manualInstallmentDates.filter(Boolean)
      if (validDates.length === nombreRemboursements) {
        overriddenPlan = {
          ...plan,
          datePremierRemboursement: new Date(validDates[0]),
          schedule: plan.schedule.map((entry, idx) => ({
            ...entry,
            date: new Date(validDates[idx]),
          })),
        }
      }
    }

      // Pour les agents, s'assurer qu'ils ne peuvent pas modifier l'agent_id
      // Les agents ne peuvent modifier que leurs propres prêts
      let finalAgentIdForUpdate = formData.agent_id
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        // Les agents ne peuvent pas changer l'agent_id, utiliser celui du profil
        finalAgentIdForUpdate = userProfile.agent_id
      }

      const { error: pretError } = await supabase
        .from('prets')
        .update({
          membre_id: formData.membre_id,
          agent_id: finalAgentIdForUpdate,
          montant_pret: montantPret,
          montant_remboursement: overriddenPlan.montantEcheance,
          nombre_remboursements: nombreRemboursements,
          date_decaissement: formData.date_decaissement,
          date_premier_remboursement: overriddenPlan.datePremierRemboursement
            .toISOString()
            .split('T')[0],
          frequence_remboursement: frequency,
        })
        .eq('id', editingPret.id)

      if (pretError) {
        // Vérifier si c'est une violation de contrainte unique (membre avec prêt actif)
        if (pretError.code === '23505' || pretError.message?.includes('uniq_prets_membre_actif')) {
          // Récupérer les prêts actifs du membre pour afficher un message détaillé
          const { data: activeLoans } = await supabase
            .from('prets')
            .select('pret_id, statut')
            .eq('membre_id', formData.membre_id)
            .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])
            .neq('pret_id', editingPret.pret_id) // Exclure le prêt en cours d'édition
          
          const activeLoanIds = activeLoans?.map(l => l.pret_id).join(', ') || 'inconnu'
          alert(
            `❌ ERREUR: Impossible de modifier le prêt.\n\n` +
            `Le membre sélectionné a déjà un autre prêt actif: ${activeLoanIds}\n\n` +
            `Un membre ne peut avoir qu'UN SEUL prêt actif à la fois.\n\n` +
            `Veuillez terminer le prêt existant avant de modifier ce prêt.`
          )
          return
        }
        throw pretError
      }

      // Recréer les remboursements
      await supabase.from('remboursements').delete().eq('pret_id', editingPret.pret_id)
      const remboursements = overriddenPlan.schedule.map((entry) => ({
        pret_id: editingPret.pret_id,
        membre_id: formData.membre_id,
        agent_id: finalAgentIdForUpdate,
        numero_remboursement: entry.numero,
        montant: entry.montant,
        principal: entry.principal,
        interet: entry.interet,
        date_remboursement: entry.date.toISOString().split('T')[0],
        statut: 'en_attente',
      }))
      if (remboursements.length > 0) {
        const { error: insertError } = await supabase
          .from('remboursements')
          .insert(remboursements)
        if (insertError) throw insertError
      }

      alert('Décaissement modifié avec succès')
      setShowForm(false)
      setEditingPret(null)
      setFormData({
        membre_id: '',
        group_id: '',
        agent_id: '',
        montant_pret: '',
        date_decaissement: new Date().toISOString().split('T')[0],
        frequence_remboursement: 'journalier',
        nombre_remboursements: '23',
      })
      loadPrets()
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error)
      if (error?.code === '23505') {
        alert('Le membre sélectionné a déjà un prêt actif. Terminez-le avant de transférer ce prêt.')
        return
      }
      alert('Erreur lors de la modification: ' + (error.message || 'Erreur inconnue'))
    }
  }

  // Pour les agents, les membres sont déjà filtrés par leur agent_id dans loadMembres
  // Pour les admins/managers, filtrer par l'agent_id sélectionné
  const filteredMembres = userProfile?.role === 'agent'
    ? membres // Les agents voient déjà seulement leurs membres
    : formData.agent_id
    ? membres.filter(m => m.agent_id === formData.agent_id)
    : membres

  // Filtrer les membres selon la recherche
  const searchedMembres = useMemo(() => {
    if (!memberSearchQuery.trim()) return filteredMembres
    
    const query = memberSearchQuery.toLowerCase().trim()
    return filteredMembres.filter((membre) => {
      const membreId = membre.membre_id.toLowerCase()
      const nom = membre.nom.toLowerCase()
      const prenom = membre.prenom.toLowerCase()
      const fullName = `${prenom} ${nom}`.toLowerCase()
      
      return (
        membreId.includes(query) ||
        nom.includes(query) ||
        prenom.includes(query) ||
        fullName.includes(query)
      )
    })
  }, [filteredMembres, memberSearchQuery])

  // Réinitialiser la recherche quand le popover se ferme
  useEffect(() => {
    if (!memberSearchOpen) {
      setMemberSearchQuery('')
    }
  }, [memberSearchOpen])

  // Focus sur l'input de recherche quand le popover s'ouvre
  useEffect(() => {
    if (memberSearchOpen && memberSearchInputRef.current) {
      setTimeout(() => {
        memberSearchInputRef.current?.focus()
      }, 100)
    }
  }, [memberSearchOpen])

  const systemInterestRatePercent = Number.isFinite(systemInterestRate)
    ? Number((systemInterestRate * 100).toFixed(2))
    : 0

  const loanPreview = (() => {
    const montant = parseFloat(formData.montant_pret)
    const count = parseInt(formData.nombre_remboursements, 10)
    if (!(montant > 0) || !(count > 0)) {
      return null
    }
    return calculateLoanPlan(
      montant,
      (['journalier','hebdomadaire','mensuel'].includes(formData.frequence_remboursement as any)
        ? (formData.frequence_remboursement as FrequenceRemboursement)
        : 'journalier') as FrequenceRemboursement,
      count,
      formData.date_decaissement,
    )
  })()

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
            <h1 className="text-3xl font-bold text-gray-900">Prêts</h1>
            <p className="text-gray-600 mt-2">Créer des prêts et effectuer les décaissements</p>
          </div>
          <div className="flex gap-4">
            {(userProfile.role === 'admin' || userProfile.role === 'agent') && (
              <button
              onClick={() => {
                setShowForm(!showForm)
                setEditingPret(null)
                // Réinitialiser le formulaire, mais garder l'agent_id pour les agents
                const resetAgentId = userProfile?.role === 'agent' && userProfile.agent_id ? userProfile.agent_id : ''
                setFormData({
                  membre_id: '',
                  group_id: '',
                  agent_id: resetAgentId,
                  montant_pret: '',
                  date_decaissement: new Date().toISOString().split('T')[0],
                  frequence_remboursement: 'journalier',
                  nombre_remboursements: systemDefaultInstallments.toString(),
                })
                setLoanType('membre')
                setGroupMemberAmounts({})
                setSelectedGroupMembers([])
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showForm ? 'Annuler' : '+ Nouveau Prêt'}
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {editingPret ? 'Modifier le décaissement' : 'Créer un nouveau prêt'}
            </h2>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 mb-6">
              <p className="font-medium">
                Taux d'intérêt actuel : {systemInterestRatePercent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%
              </p>
              <p className="mt-1">
                Taux de garantie requis : {collateralRatePercent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}% du montant du prêt.
              </p>
              <p className="mt-2 text-blue-800">
                Vous pouvez ajuster ces taux dans <Link href="/parametres" className="underline font-semibold">Paramètres &gt; Taux</Link> (réservé aux administrateurs).
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Le champ agent_id est masqué pour les agents car ils ne peuvent créer que pour eux-mêmes */}
                {userProfile?.role !== 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent de Crédit *
                    </label>
                    <select
                      required
                      value={formData.agent_id}
                      onChange={(e) => setFormData({ ...formData, agent_id: e.target.value, membre_id: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner un agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.prenom} {agent.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Toggle pour choisir entre membre et groupe (seulement pour les agents) */}
                {userProfile?.role === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type de prêt *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="loanType"
                          value="membre"
                          checked={loanType === 'membre'}
                          onChange={(e) => {
                            setLoanType('membre')
                            setFormData({ ...formData, membre_id: '', group_id: '' })
                            setGroupMemberAmounts({})
                            setSelectedGroupMembers([])
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">Membre individuel</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="loanType"
                          value="groupe"
                          checked={loanType === 'groupe'}
                          onChange={(e) => {
                            setLoanType('groupe')
                            setFormData({ ...formData, membre_id: '', group_id: '' })
                            setGroupMemberAmounts({})
                            setSelectedGroupMembers([])
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">Groupe</span>
                      </label>
                    </div>
                  </div>
                )}
                {loanType === 'membre' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Membre *
                    </label>
                    <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!formData.agent_id && userProfile?.role !== 'agent'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 bg-white text-left flex items-center justify-between"
                        >
                          <span className={formData.membre_id ? 'text-gray-900' : 'text-gray-500'}>
                            {formData.membre_id
                              ? (() => {
                                  const selected = filteredMembres.find((m) => m.membre_id === formData.membre_id)
                                  return selected
                                    ? `${selected.membre_id} — ${selected.prenom} ${selected.nom} (${selected.agent_id})`
                                    : 'Sélectionner un membre'
                                })()
                              : formData.agent_id || userProfile?.role === 'agent'
                              ? 'Sélectionner un membre'
                              : 'Sélectionnez d\'abord un agent'}
                          </span>
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              ref={memberSearchInputRef}
                              type="text"
                              placeholder="Rechercher par nom ou ID..."
                              value={memberSearchQuery}
                              onChange={(e) => setMemberSearchQuery(e.target.value)}
                              className="pl-8 pr-8"
                            />
                            {memberSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setMemberSearchQuery('')}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {searchedMembres.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                              {memberSearchQuery ? 'Aucun membre trouvé' : 'Aucun membre disponible'}
                            </div>
                          ) : (
                            searchedMembres.map((membre) => {
                              const hasActiveLoan = prets.some(
                                (pret) => pret.membre_id === membre.membre_id && 
                                ['actif', 'en_attente_garantie', 'en_attente_approbation'].includes(pret.statut),
                              )
                              const isCurrentSelection = editingPret?.membre_id === membre.membre_id
                              const isDisabled = hasActiveLoan && !isCurrentSelection
                              
                              return (
                                <button
                                  key={membre.id}
                                  type="button"
                                  onClick={() => {
                                    if (!isDisabled) {
                                      setFormData({ ...formData, membre_id: membre.membre_id })
                                      setMemberSearchOpen(false)
                                    }
                                  }}
                                  disabled={isDisabled}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                                    formData.membre_id === membre.membre_id ? 'bg-blue-50 text-blue-900' : ''
                                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className="font-medium">{membre.membre_id}</div>
                                  <div className="text-xs text-gray-500">
                                    {membre.prenom} {membre.nom} ({membre.agent_id})
                                    {hasActiveLoan && !isCurrentSelection ? ' (prêt individuel actif)' : ''}
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Groupe *
                    </label>
                    <select
                      required
                      value={formData.group_id}
                      onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner un groupe</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.group_name} ({group.member_count || 0} membre(s))
                        </option>
                      ))}
                    </select>
                    {loanType === 'groupe' && selectedGroupMembers.length > 0 && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Montant du décaissement par membre (HTG) *
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Saisissez le montant que chaque membre recevra. La somme doit correspondre au montant total du prêt.
                        </p>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {selectedGroupMembers.map((member) => {
                            const memberAmount = groupMemberAmounts[member.membre_id] || ''
                            return (
                              <div key={member.membre_id} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-600 mb-1">
                                    {member.membre_id} - {member.prenom} {member.nom}
                                  </label>
                                  <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={memberAmount}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                                        setGroupMemberAmounts({
                                          ...groupMemberAmounts,
                                          [member.membre_id]: value,
                                        })
                                      }
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {(() => {
                          const totalEntered = selectedGroupMembers.reduce((sum, m) => {
                            const amt = parseFloat(groupMemberAmounts[m.membre_id] || '0')
                            return sum + (isNaN(amt) ? 0 : amt)
                          }, 0)
                          const totalLoan = parseFloat(formData.montant_pret) || 0
                          const remaining = totalLoan - totalEntered
                          const isComplete = Math.abs(remaining) < 0.01

                          return (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Total saisi:</span>
                                <span className={`font-medium ${isComplete ? 'text-green-600' : 'text-gray-900'}`}>
                                  {formatCurrency(totalEntered)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-sm mt-1">
                                <span className="text-gray-600">Montant du prêt:</span>
                                <span className="font-medium text-gray-900">
                                  {formatCurrency(totalLoan)}
                                </span>
                              </div>
                              {!isComplete && totalLoan > 0 && (
                                <div className="flex justify-between items-center text-sm mt-1">
                                  <span className="text-gray-600">Reste à saisir:</span>
                                  <span className={`font-medium ${remaining > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                    {formatCurrency(Math.abs(remaining))}
                                  </span>
                                </div>
                              )}
                              {isComplete && totalLoan > 0 && (
                                <div className="mt-2 text-xs text-green-600 font-medium">
                                  ✓ La somme correspond au montant total du prêt
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Montant du prêt (HTG) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={formData.montant_pret}
                    onChange={async (e) => {
                      const value = e.target.value
                      // Valider que c'est un nombre positif
                      if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                        setFormData({ ...formData, montant_pret: value })
                        
                        // Valider en temps réel selon les barèmes
                        if (value && parseFloat(value) > 0) {
                          const validation = await validateLoanAmount(parseFloat(value))
                          if (!validation.valid) {
                            setAmountValidationMessage(validation.message || null)
                          } else {
                            setAmountValidationMessage(null)
                          }
                        } else {
                          setAmountValidationMessage(null)
                        }
                      }
                    }}
                    className={`w-full px-3 py-2 border ${amountValidationMessage ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                  {amountValidationMessage && (
                    <p className="text-sm text-red-600 mt-1">{amountValidationMessage}</p>
                  )}
                  {loanPreview && (
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <p>
                        <strong>Fréquence:</strong>{' '}
                        {repaymentFrequencies.find(f => f.key === formData.frequence_remboursement)?.label || 
                         (formData.frequence_remboursement === 'mensuel' ? 'Mensuelle' : 'Quotidienne')}
                      </p>
                      <p>
                        <strong>Échéances:</strong> {formData.nombre_remboursements}
                      </p>
                      <p>
                        <strong>Montant par échéance:</strong> {formatCurrency(loanPreview.montantEcheance)}
                      </p>
                      <p>
                        <strong>Total à rembourser:</strong> {formatCurrency(loanPreview.totalRemboursement)} ({formData.nombre_remboursements} échéance(s))
                      </p>
                      <p className="text-green-600">
                        <strong>Intérêt total:</strong> {formatCurrency(loanPreview.interetTotal)}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fréquence de paiement *
                  </label>
                  <select
                    value={formData.frequence_remboursement}
                    onChange={(e) =>
                      setFormData((prev) => {
                        const nextFrequency = e.target.value as FrequenceRemboursement
                        // Trouver la fréquence sélectionnée dans la liste dynamique
                        const selectedFrequency = repaymentFrequencies.find(f => f.key === nextFrequency)
                        let nextCount = prev.nombre_remboursements
                        
                        // Ajuster le nombre de remboursements selon la fréquence sélectionnée
                        if (!nextCount || !selectedFrequency) {
                          // Utiliser des valeurs par défaut basées sur la fréquence
                          if (nextFrequency === 'mensuel') {
                            nextCount = '6'
                          } else if (nextFrequency === 'hebdomadaire') {
                            nextCount = '4'
                          } else {
                            nextCount = systemDefaultInstallments.toString()
                          }
                        } else {
                          // Ajuster si on change de fréquence
                          const currentFrequency = repaymentFrequencies.find(f => f.key === prev.frequence_remboursement)
                          if (currentFrequency && currentFrequency.key !== nextFrequency) {
                            // Changer de fréquence entre journalier, hebdomadaire et mensuel
                            if (nextFrequency === 'mensuel' && (prev.nombre_remboursements === '23' || prev.nombre_remboursements === '4')) {
                              nextCount = '6'
                            } else if (nextFrequency === 'hebdomadaire' && (prev.nombre_remboursements === '23' || prev.nombre_remboursements === '6')) {
                              nextCount = '4'
                            } else if (nextFrequency === 'journalier' && (prev.nombre_remboursements === '6' || prev.nombre_remboursements === '4')) {
                              nextCount = systemDefaultInstallments.toString()
                            }
                          }
                        }
                        
                        return {
                          ...prev,
                          frequence_remboursement: nextFrequency,
                          nombre_remboursements: nextCount,
                        }
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {repaymentFrequencies.length > 0 ? (
                      repaymentFrequencies.map((freq) => (
                        <option key={freq.key} value={freq.key}>
                          {freq.label}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="journalier">Journalier</option>
                        <option value="hebdomadaire">Hebdomadaire</option>
                        <option value="mensuel">Mensuel</option>
                      </>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choisissez la fréquence de remboursement (jours ouvrés pour le quotidien).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre d’échéances *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.nombre_remboursements}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nombre_remboursements: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Durée du prêt en nombre d’échéances ({formData.frequence_remboursement === 'mensuel' ? 'mois' : 'jours ouvrés'}).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de décaissement *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date_decaissement}
                    onChange={(e) => setFormData({ ...formData, date_decaissement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {formData.date_decaissement && (() => {
                    const previewDate = loanPreview
                      ? loanPreview.datePremierRemboursement
                      : getInitialPaymentDate(
                          new Date(formData.date_decaissement),
                          (['journalier','hebdomadaire','mensuel'].includes(formData.frequence_remboursement as any)
                            ? (formData.frequence_remboursement as FrequenceRemboursement)
                            : 'journalier') as FrequenceRemboursement,
                        )
                    return (
                      <p className="text-sm text-gray-600 mt-1">
                        Premier remboursement: {formatDate(previewDate)}{' '}
                        {formData.frequence_remboursement === 'journalier'
                          ? '(jours ouvrés uniquement)'
                          : '(ajusté au jour ouvré suivant si besoin)'}
                      </p>
                    )
                  })()}
                </div>
              </div>
              
              {/* Dates d'échéance manuelles (agents uniquement) */}
              {userProfile.role === 'agent' && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">Entrer les dates d’échéance manuellement</label>
                    <div className="flex items-center gap-2">
                      <input
                        id="manual-dates-toggle"
                        type="checkbox"
                        checked={manualScheduleEnabled}
                        onChange={() => {
                          const next = !manualScheduleEnabled
                          setManualScheduleEnabled(next)
                          // Préremplir avec l'échéancier calculé si on active
                          if (!manualScheduleEnabled) {
                            const count = parseInt(formData.nombre_remboursements, 10)
                            if (loanPreview && count > 0) {
                              const defaults = loanPreview.schedule.slice(0, count).map(entry => {
                                const d = new Date(entry.date)
                                return d.toISOString().split('T')[0]
                              })
                              setManualInstallmentDates(defaults)
                            }
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {manualScheduleEnabled && (
                    <div className="mt-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {manualInstallmentDates.map((value, idx) => (
                          <div key={idx}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Échéance {idx + 1}
                            </label>
                            <input
                              type="date"
                              required
                              value={value || ''}
                              onChange={(e) => {
                                const next = [...manualInstallmentDates]
                                next[idx] = e.target.value
                                setManualInstallmentDates(next)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Astuce: Modifiez les dates si nécessaire. Elles remplaceront l’échéancier automatique.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Informations sur la garantie - seulement pour les prêts de membre */}
              {loanType === 'membre' && formData.membre_id && formData.montant_pret && parseFloat(formData.montant_pret) > 0 && collateralRequirement && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Garantie requise</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Garantie requise:</span>
                      <span className="font-semibold">
                        {formatCurrency(collateralRequirement.montantRequis)} ({((collateralRequirement.montantRequis / parseFloat(formData.montant_pret)) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Solde disponible du membre:</span>
                      <span className={memberCollateralBalance > 0 ? "font-semibold text-green-600" : "font-semibold text-gray-700"}>
                        {loadingCollateralBalance ? 'Chargement...' : formatCurrency(memberCollateralBalance)}
                      </span>
                    </div>
                    {collateralRequirement.montantRestant > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600 font-medium">Montant restant à déposer:</span>
                          <span className="font-semibold text-red-600">{formatCurrency(collateralRequirement.montantRestant)}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-blue-300">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dépôt de garantie (HTG) *
                          </label>
                          <input
                            type="number"
                            required={collateralRequirement.montantRestant > 0}
                            min="0"
                            step="0.01"
                            value={collateralDeposit}
                            onChange={(e) => {
                              const value = e.target.value
                              if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                                setCollateralDeposit(value)
                              }
                            }}
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={collateralRequirement.montantRestant.toFixed(2)}
                          />
                          <p className="text-xs text-gray-600 mt-1">
                            Montant suggéré: {formatCurrency(collateralRequirement.montantRestant)}. Le membre doit déposer au moins ce montant pour respecter le taux de garantie requis.
                          </p>
                        </div>
                      </>
                    )}
                    {collateralRequirement.montantRestant <= 0 && (
                      <div className="text-sm text-green-600 font-medium mt-2">
                        ✅ Le solde de garantie disponible est suffisant pour ce prêt.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingPret ? 'Modifier le décaissement' : 'Créer le prêt'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID Prêt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Membre/Groupe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant échéance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fréquence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date décaissement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {prets.length === 0 && groupPrets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        userProfile?.role === 'admin' || userProfile?.role === 'manager' ? 9 : 8
                      }
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Aucun prêt enregistré
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Prêts de membres individuels */}
                    {prets.map((pret) => (
                    <tr key={pret.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {pret.pret_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pret.membre_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(pret.montant_pret)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(pret.montant_remboursement)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pret.frequence_remboursement === 'mensuel' ? 'Mensuelle' : 'Quotidienne'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pret.nombre_remboursements} échéance(s)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(pret.date_decaissement)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const collateral = collaterals.find(c => c.pret_id === pret.pret_id)
                          const isCollateralComplete = collateral?.statut === 'complet' && collateral?.montant_restant === 0
                          const displayStatus = pret.statut === 'en_attente_garantie' && isCollateralComplete
                            ? 'Garantie complète - En attente d\'approbation'
                            : pret.statut
                          
                          return (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              pret.statut === 'actif' ? 'bg-green-100 text-green-800' :
                              pret.statut === 'en_attente_approbation' ? 'bg-yellow-100 text-yellow-800' :
                              pret.statut === 'en_attente_garantie' && isCollateralComplete ? 'bg-purple-100 text-purple-800' :
                              pret.statut === 'en_attente_garantie' ? 'bg-blue-100 text-blue-800' :
                              pret.statut === 'termine' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {displayStatus}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                            <>
                              <button
                                onClick={() => handleEditPret(pret)}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => handleDeletePret(pret)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Supprimer
                              </button>
                            </>
                          )}
                          {userProfile?.role === 'agent' && pret.statut === 'en_attente_approbation' && (
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                              En attente d'approbation
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                    {/* Prêts de groupe */}
                    {groupPrets.map((pret) => {
                      const group = groups.find(g => g.id === pret.group_id)
                      return (
                        <tr key={`group-${pret.id}`} className="hover:bg-gray-50 bg-blue-50/30">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {pret.pret_id} <span className="text-xs text-blue-600">(Groupe)</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {group?.group_name || `Groupe #${pret.group_id}`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(pret.montant_pret)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(pret.montant_remboursement)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {pret.frequence_remboursement === 'mensuel' ? 'Mensuelle' : pret.frequence_remboursement === 'hebdomadaire' ? 'Hebdomadaire' : 'Quotidienne'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {pret.nombre_remboursements} échéance(s)
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(pret.date_decaissement)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              pret.statut === 'actif' ? 'bg-green-100 text-green-800' :
                              pret.statut === 'en_attente_approbation' ? 'bg-yellow-100 text-yellow-800' :
                              pret.statut === 'en_attente_garantie' ? 'bg-blue-100 text-blue-800' :
                              pret.statut === 'termine' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {pret.statut}
                            </span>
                          </td>
                          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex gap-2">
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  Prêt de groupe
                                </span>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function PretsPage() {
  return (
    <ProtectedRoute requiredPermission="canCreatePrets">
      <PretsPageContent />
    </ProtectedRoute>
  )
}

