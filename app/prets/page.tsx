'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, type Pret, type Membre, type Agent, type UserProfile } from '@/lib/supabase'
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils'
import { addDays, addMonths, getDay } from 'date-fns'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useRouter } from 'next/navigation'
import {
  getScheduleSettings,
  getInterestRates,
  validateLoanAmount,
  calculateCollateralAmount,
  getLoanAmountBrackets,
  getCollateralSettings,
} from '@/lib/systemSettings'

type FrequenceRemboursement = 'journalier' | 'mensuel'

interface LoanScheduleEntry {
  numero: number
  montant: number
  principal: number
  interet: number
  date: Date
}

interface LoanPlan {
  montantEcheance: number
  totalRemboursement: number
  interetTotal: number
  datePremierRemboursement: Date
  schedule: LoanScheduleEntry[]
}

function PretsPageContent() {
  const router = useRouter()
  const [prets, setPrets] = useState<Pret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPret, setEditingPret] = useState<Pret | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [systemInterestRate, setSystemInterestRate] = useState(0.15)
  const [systemDefaultInstallments, setSystemDefaultInstallments] = useState(23)
  const [collateralRatePercent, setCollateralRatePercent] = useState(10)
  const [loanBrackets, setLoanBrackets] = useState<any[]>([])
  const [amountValidationMessage, setAmountValidationMessage] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    membre_id: '',
    agent_id: '',
    montant_pret: '',
    date_decaissement: new Date().toISOString().split('T')[0],
    frequence_remboursement: 'journalier',
    nombre_remboursements: '23',
  })

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
    return adjustToBusinessDay(addDays(dateDecaissement, 2))
  }

  function getNextPaymentDate(current: Date, frequency: FrequenceRemboursement): Date {
    if (frequency === 'mensuel') {
      return adjustToBusinessDay(addMonths(current, 1))
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

    return {
      montantEcheance,
      totalRemboursement,
      interetTotal,
      datePremierRemboursement: schedule[0]?.date ?? paymentDate,
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
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

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

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadAgents() {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('agent_id', { ascending: true })

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
      }

      const { data, error } = await query

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
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
      }

      const { data, error } = await query

      if (error) throw error
      setPrets(data || [])
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
      const montantPret = parseFloat(formData.montant_pret)
      const nombreRemboursements = parseInt(formData.nombre_remboursements, 10)
      const frequency: FrequenceRemboursement =
        formData.frequence_remboursement === 'mensuel' ? 'mensuel' : 'journalier'
      
      // Validation
      if (isNaN(montantPret) || montantPret <= 0) {
        alert('Le montant du prêt doit être un nombre positif')
        return
      }

      if (isNaN(nombreRemboursements) || nombreRemboursements <= 0) {
        alert('Veuillez saisir une durée valide (nombre d’échéances).')
        return
      }

      if (!formData.membre_id) {
        alert('Veuillez sélectionner un membre')
        return
      }

      // Valider le montant selon les barèmes configurés
      const validation = await validateLoanAmount(montantPret)
      if (!validation.valid) {
        alert(validation.message || 'Le montant du prêt n\'est pas dans les limites autorisées.')
        return
      }

      // Vérifier si le membre a déjà un prêt actif ou en attente de garantie
      const { data: activeLoans, error: activeLoansError } = await supabase
        .from('prets')
        .select('id')
        .eq('membre_id', formData.membre_id)
        .in('statut', ['actif', 'en_attente_garantie'])
        .limit(1)

      if (activeLoansError) throw activeLoansError
      if (activeLoans && activeLoans.length > 0) {
        alert('Ce membre a déjà un prêt actif ou en attente de garantie. Il doit terminer de le rembourser ou compléter la garantie avant de contracter un nouveau prêt.')
        return
      }

      const plan = calculateLoanPlan(
        montantPret,
        frequency,
        nombreRemboursements,
        formData.date_decaissement,
      )

      if (plan.schedule.length !== nombreRemboursements) {
        alert('Impossible de générer l’échéancier. Vérifiez les paramètres.')
        return
      }

      // Générer le pret_id automatiquement
      const monthName = getMonthName(new Date(formData.date_decaissement))
      const { data: maxPrets } = await supabase
        .from('prets')
        .select('pret_id')
        .filter('pret_id', 'like', `CL-%${monthName}`)
        .order('pret_id', { ascending: false })
        .limit(1)

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

      // Créer le prêt avec statut "en_attente_garantie"
      // Le prêt ne sera activé qu'après le dépôt complet de la garantie
      const { error: pretError } = await supabase
        .from('prets')
        .insert([{
          pret_id: newPretId,
          membre_id: formData.membre_id,
          agent_id: formData.agent_id,
          montant_pret: montantPret,
          montant_remboursement: plan.montantEcheance,
          nombre_remboursements: nombreRemboursements,
          date_decaissement: formData.date_decaissement,
          date_premier_remboursement: plan.datePremierRemboursement
            .toISOString()
            .split('T')[0],
          statut: 'en_attente_garantie',
          capital_restant: montantPret,
          frequence_remboursement: frequency,
        }])

      if (pretError) throw pretError

      // Créer la garantie (collateral) automatiquement
      const montantGarantieRequis = await calculateCollateralAmount(montantPret)
      const { error: collateralError } = await supabase
        .from('collaterals')
        .insert([{
          pret_id: newPretId,
          membre_id: formData.membre_id,
          montant_requis: montantGarantieRequis,
          montant_depose: 0,
          montant_restant: montantGarantieRequis,
          statut: 'partiel',
          notes: `Garantie générée automatiquement pour le prêt ${newPretId}`,
        }])

      if (collateralError) {
        console.error('Erreur lors de la création de la garantie:', collateralError)
        throw new Error('Erreur lors de la création de la garantie. Le prêt ne peut pas être créé.')
      }

      // Les remboursements seront créés automatiquement lors de l'activation du prêt
      // (après dépôt complet de la garantie)

      alert(
        `✅ Prêt créé avec succès!\n\n` +
        `📋 Prêt: ${newPretId}\n` +
        `💰 Montant: ${montantPret.toFixed(2)} HTG\n` +
        `🔒 Garantie requise: ${montantGarantieRequis.toFixed(2)} HTG (${((montantGarantieRequis / montantPret) * 100).toFixed(0)}%)\n\n` +
        `⚠️ IMPORTANT: Le membre doit déposer la garantie avant le décaissement.\n` +
        `Allez dans "Garanties" pour enregistrer le dépôt.`,
      )
      setShowForm(false)
      setFormData({
        membre_id: '',
        agent_id: '',
        montant_pret: '',
        date_decaissement: new Date().toISOString().split('T')[0],
        frequence_remboursement: 'journalier',
        nombre_remboursements: '23',
      })
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
    if (!confirm('Voulez-vous modifier ce décaissement ? Les remboursements associés seront également mis à jour.')) {
      return
    }
    setEditingPret(pret)
    setFormData({
      membre_id: pret.membre_id,
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

    try {
      const montantPret = parseFloat(formData.montant_pret)
      const nombreRemboursements = parseInt(formData.nombre_remboursements, 10)
      const frequency: FrequenceRemboursement =
        formData.frequence_remboursement === 'mensuel' ? 'mensuel' : 'journalier'
      
      if (isNaN(montantPret) || montantPret <= 0) {
        alert('Le montant du prêt doit être un nombre positif')
        return
      }

      if (isNaN(nombreRemboursements) || nombreRemboursements <= 0) {
        alert('Veuillez saisir une durée valide (nombre d’échéances).')
        return
      }

      if (!formData.membre_id) {
        alert('Veuillez sélectionner un membre')
        return
      }

      if (formData.membre_id !== editingPret.membre_id) {
        const { data: activeLoans, error: activeLoansError } = await supabase
          .from('prets')
          .select('id')
          .eq('membre_id', formData.membre_id)
          .in('statut', ['actif', 'en_attente_garantie'])
          .limit(1)

        if (activeLoansError) throw activeLoansError
        if (activeLoans && activeLoans.length > 0) {
          alert('Le membre sélectionné a déjà un prêt actif ou en attente de garantie. Terminez-le ou complétez la garantie avant de modifier ce prêt.')
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
        alert('Impossible de générer l’échéancier. Vérifiez les paramètres.')
        return
      }

      const { error: pretError } = await supabase
        .from('prets')
        .update({
          membre_id: formData.membre_id,
          agent_id: formData.agent_id,
          montant_pret: montantPret,
          montant_remboursement: plan.montantEcheance,
          nombre_remboursements: nombreRemboursements,
          date_decaissement: formData.date_decaissement,
          date_premier_remboursement: plan.datePremierRemboursement
            .toISOString()
            .split('T')[0],
          frequence_remboursement: frequency,
        })
        .eq('id', editingPret.id)

      if (pretError) throw pretError

      // Recréer les remboursements
      await supabase.from('remboursements').delete().eq('pret_id', editingPret.pret_id)
      const remboursements = plan.schedule.map((entry) => ({
        pret_id: editingPret.pret_id,
        membre_id: formData.membre_id,
        agent_id: formData.agent_id,
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

  const filteredMembres = formData.agent_id
    ? membres.filter(m => m.agent_id === formData.agent_id)
    : membres

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
      formData.frequence_remboursement === 'mensuel' ? 'mensuel' : 'journalier',
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
                setFormData({
                  membre_id: '',
                  agent_id: '',
                  montant_pret: '',
                  date_decaissement: new Date().toISOString().split('T')[0],
                  frequence_remboursement: 'journalier',
                  nombre_remboursements: '23',
                })
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Membre *
                  </label>
                  <select
                    required
                    value={formData.membre_id}
                    onChange={(e) => setFormData({ ...formData, membre_id: e.target.value })}
                    disabled={!formData.agent_id}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">
                      {formData.agent_id ? 'Sélectionner un membre' : 'Sélectionnez d\'abord un agent'}
                    </option>
                    {filteredMembres.map((membre) => (
                      (() => {
                        const hasActiveLoan = prets.some(
                          (pret) => pret.membre_id === membre.membre_id && pret.statut === 'actif',
                        )
                        const isCurrentSelection =
                          editingPret?.membre_id === membre.membre_id
                        return (
                          <option
                            key={membre.id}
                            value={membre.membre_id}
                            disabled={hasActiveLoan && !isCurrentSelection}
                          >
                            {membre.membre_id} - {membre.prenom} {membre.nom}
                            {hasActiveLoan && !isCurrentSelection ? ' (prêt actif)' : ''}
                          </option>
                        )
                      })()
                    ))}
                  </select>
                </div>
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
                        {formData.frequence_remboursement === 'mensuel'
                          ? 'Mensuelle'
                          : 'Quotidienne'}
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
                        let nextCount = prev.nombre_remboursements
                        if (!nextCount) {
                          nextCount = nextFrequency === 'mensuel' ? '6' : '23'
                        } else if (
                          prev.frequence_remboursement === 'journalier' &&
                          nextFrequency === 'mensuel' &&
                          nextCount === '23'
                        ) {
                          nextCount = '6'
                        } else if (
                          prev.frequence_remboursement === 'mensuel' &&
                          nextFrequency === 'journalier' &&
                          nextCount === '6'
                        ) {
                          nextCount = '23'
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
                    <option value="journalier">Quotidienne</option>
                    <option value="mensuel">Mensuelle</option>
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
                          formData.frequence_remboursement === 'mensuel' ? 'mensuel' : 'journalier',
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
                    Membre
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
                {prets.length === 0 ? (
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
                  prets.map((pret) => (
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
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          pret.statut === 'actif' ? 'bg-green-100 text-green-800' :
                          pret.statut === 'termine' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {pret.statut}
                        </span>
                      </td>
                      {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
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
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
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

