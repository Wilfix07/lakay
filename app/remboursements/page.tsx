'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, type Remboursement, type Pret, type UserProfile, type Membre } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'

function RemboursementsPageContent() {
  const [remboursements, setRemboursements] = useState<Remboursement[]>([])
  const [prets, setPrets] = useState<Pret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPret, setFilterPret] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentPretId, setPaymentPretId] = useState('')
  const [paymentRemboursements, setPaymentRemboursements] = useState<Remboursement[]>([])
  const [paymentForm, setPaymentForm] = useState({
    remboursementId: '',
    montant: '',
    principal: '',
    datePaiement: new Date().toISOString().split('T')[0],
  })
  const [paymentInterestDue, setPaymentInterestDue] = useState(0)
  const [paymentPrincipalDue, setPaymentPrincipalDue] = useState(0)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadPrets()
      loadMembres()
      loadRemboursements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  useEffect(() => {
    if (userProfile) {
      loadRemboursements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPret, filterStatut, userProfile])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadPrets() {
    try {
      let query = supabase
        .from('prets')
        .select('*')
        .eq('statut', 'actif')
        .order('pret_id', { ascending: false })

      // Les agents ne voient que leurs propres prêts
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      }

      const { data, error } = await query

      if (error) throw error
      setPrets(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des prêts:', error)
    }
  }

  async function loadMembres() {
    try {
      let query = supabase
        .from('membres')
        .select('membre_id, nom, prenom, agent_id')
        .order('membre_id', { ascending: true })

      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      }

      const { data, error } = await query

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
      setMembres([])
    }
  }

  async function loadPaymentRemboursements(pretId: string) {
    if (!pretId) {
      setPaymentRemboursements([])
      return
    }
    try {
      setPaymentLoading(true)
      let query = supabase
        .from('remboursements')
        .select('*')
        .eq('pret_id', pretId)
        .in('statut', ['en_attente', 'en_retard'])
        .order('numero_remboursement', { ascending: true })

      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      }

      const { data, error } = await query

      if (error) throw error
      setPaymentRemboursements(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des remboursements pour le formulaire:', error)
      setPaymentRemboursements([])
    } finally {
      setPaymentLoading(false)
    }
  }

  async function loadRemboursements() {
    try {
      setLoading(true)
      let query = supabase
        .from('remboursements')
        .select('*')
        .order('date_remboursement', { ascending: true })

      // Les agents ne voient que leurs propres remboursements
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      }

      if (filterPret) {
        query = query.eq('pret_id', filterPret)
      }

      if (filterStatut) {
        query = query.eq('statut', filterStatut)
      }

      const { data, error } = await query

      if (error) throw error
      setRemboursements(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des remboursements:', error)
      alert('Erreur lors du chargement des remboursements')
    } finally {
      setLoading(false)
    }
  }

  async function handleEditRemboursement(remboursement: Remboursement) {
    const nouveauMontant = prompt(`Modifier le montant du remboursement #${remboursement.numero_remboursement}:\nMontant actuel: ${formatCurrency(remboursement.montant)}`, remboursement.montant.toString())
    
    if (!nouveauMontant || isNaN(parseFloat(nouveauMontant)) || parseFloat(nouveauMontant) <= 0) {
      return
    }

    const nouveauPrincipal = prompt(
      `Modifier la part de principal:\nActuelle: ${formatCurrency(remboursement.principal ?? 0)}`,
      (remboursement.principal ?? 0).toString()
    )
    if (!nouveauPrincipal || isNaN(parseFloat(nouveauPrincipal)) || parseFloat(nouveauPrincipal) < 0) {
      return
    }

    const pretRecord = prets.find((pret) => pret.pret_id === remboursement.pret_id)
    const fallbackPrincipal =
      pretRecord && pretRecord.nombre_remboursements
        ? Number(pretRecord.montant_pret || 0) / Number(pretRecord.nombre_remboursements || 1)
        : Number(remboursement.montant || 0) / 1.15
    const currentPrincipalValue =
      remboursement.principal != null
        ? Number(remboursement.principal)
        : Math.round(fallbackPrincipal * 100) / 100

    const newPrincipalValue = parseFloat(nouveauPrincipal)
    const newMontantValue = parseFloat(nouveauMontant)
    const newInterest = Math.max(newMontantValue - newPrincipalValue, 0)

    const nouvelleDate = prompt(`Modifier la date de remboursement:\nDate actuelle: ${formatDate(remboursement.date_remboursement)}\nFormat: YYYY-MM-DD`, remboursement.date_remboursement)
    
    if (!nouvelleDate) {
      return
    }

    try {
      const { error } = await supabase
        .from('remboursements')
        .update({
          montant: newMontantValue,
          principal: newPrincipalValue,
          interet: newInterest,
          date_remboursement: nouvelleDate,
        })
        .eq('id', remboursement.id)

      if (error) throw error

      if (remboursement.statut === 'paye' && pretRecord) {
        const currentCapital =
          pretRecord.capital_restant ?? pretRecord.montant_pret ?? 0
        const updatedCapital = Math.max(currentCapital - (newPrincipalValue - currentPrincipalValue), 0)
        const { error: capitalError } = await supabase
          .from('prets')
          .update({ capital_restant: updatedCapital })
          .eq('pret_id', remboursement.pret_id)
        if (capitalError) throw capitalError
      }

      alert('Remboursement modifié avec succès')
      loadRemboursements()
      loadPrets()
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error)
      alert('Erreur lors de la modification: ' + (error.message || 'Erreur inconnue'))
    }
  }

  async function handleDeleteRemboursement(remboursement: Remboursement) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le remboursement #${remboursement.numero_remboursement} de ${formatCurrency(remboursement.montant)} ? Cette action est irréversible.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('remboursements')
        .delete()
        .eq('id', remboursement.id)

      if (error) throw error

      // Vérifier si tous les remboursements sont payés pour mettre à jour le statut du prêt
      const { data: allRemboursements } = await supabase
        .from('remboursements')
        .select('statut')
        .eq('pret_id', remboursement.pret_id)

      const allPaid = allRemboursements?.every(r => r.statut === 'paye')

      if (allPaid && allRemboursements && allRemboursements.length > 0) {
        await supabase
          .from('prets')
          .update({ statut: 'termine' })
          .eq('pret_id', remboursement.pret_id)
      }

      alert('Remboursement supprimé avec succès')
      loadRemboursements()
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error)
      alert('Erreur lors de la suppression: ' + (error.message || 'Erreur inconnue'))
    }
  }

  async function handlePaiement(remboursement: Remboursement) {
    if (remboursement.statut === 'paye') {
      alert('Ce remboursement est déjà payé')
      return
    }

    if (!confirm(`Confirmer le paiement de ${formatCurrency(remboursement.montant)} pour le remboursement #${remboursement.numero_remboursement}?`)) {
      return
    }

    const datePaiement = new Date().toISOString().split('T')[0]
    const pretRecord = prets.find((pret) => pret.pret_id === remboursement.pret_id)
    const fallbackPrincipal =
      pretRecord && pretRecord.nombre_remboursements
        ? Number(pretRecord.montant_pret || 0) / Number(pretRecord.nombre_remboursements || 1)
        : Number(remboursement.montant || 0) / 1.15
    const principalValue =
      remboursement.principal != null
        ? Number(remboursement.principal)
        : Math.round(fallbackPrincipal * 100) / 100

    try {
      const { error } = await supabase
        .from('remboursements')
        .update({
          statut: 'paye',
          date_paiement: datePaiement,
          principal: principalValue,
          interet: Math.max(Number(remboursement.montant || 0) - principalValue, 0),
        })
        .eq('id', remboursement.id)

      if (error) throw error

      if (pretRecord) {
        const nouveauCapital = Math.max(
          (pretRecord.capital_restant ?? pretRecord.montant_pret ?? 0) - principalValue,
          0,
        )
        const { error: capitalError } = await supabase
          .from('prets')
          .update({ capital_restant: nouveauCapital })
          .eq('pret_id', remboursement.pret_id)
        if (capitalError) throw capitalError
      }

      // Vérifier si tous les remboursements sont payés pour mettre à jour le statut du prêt
      const { data: allRemboursements, error: checkError } = await supabase
        .from('remboursements')
        .select('statut')
        .eq('pret_id', remboursement.pret_id)

      if (checkError) throw checkError

      const allPaid = allRemboursements?.every(r => r.statut === 'paye')

      if (allPaid) {
        const { error: updateError } = await supabase
          .from('prets')
          .update({ statut: 'termine' })
          .eq('pret_id', remboursement.pret_id)
        
        if (updateError) throw updateError
      }

      alert('Remboursement enregistré avec succès!')
      loadRemboursements()
      loadPrets()
    } catch (error: any) {
      console.error('Erreur lors du paiement:', error)
      alert('Erreur: ' + (error.message || 'Erreur inconnue'))
    }
  }

  function resetPaymentForm() {
    setPaymentPretId('')
    setPaymentRemboursements([])
    setPaymentForm({
      remboursementId: '',
      montant: '',
      principal: '',
      datePaiement: new Date().toISOString().split('T')[0],
    })
    setPaymentError('')
    setPaymentSuccess('')
    setPaymentInterestDue(0)
    setPaymentPrincipalDue(0)
  }

  function getPretById(pretId: string) {
    return prets.find((pret) => pret.pret_id === pretId)
  }

  function getMemberLabel(membreId: string | null | undefined) {
    if (!membreId) return '-'
    const membre = membres.find((m) => m.membre_id === membreId)
    if (!membre) return membreId
    const name = `${membre.prenom ?? ''} ${membre.nom ?? ''}`.trim()
    return name ? `${name} (${membreId})` : membreId
  }

  function getMemberName(membreId: string | null | undefined) {
    if (!membreId) return '-'
    const membre = membres.find((m) => m.membre_id === membreId)
    if (!membre) return membreId
    return `${membre.prenom ?? ''} ${membre.nom ?? ''}`.trim() || membreId
  }

  function computePrincipal(remboursement: Remboursement) {
    if (remboursement.principal != null) {
      return Number(remboursement.principal)
    }
    const pretRecord = getPretById(remboursement.pret_id)
    if (pretRecord && pretRecord.nombre_remboursements) {
      const base =
        Number(pretRecord.montant_pret || 0) / Number(pretRecord.nombre_remboursements || 1)
      return Math.round(base * 100) / 100
    }
    return Math.round((Number(remboursement.montant || 0) / 1.15) * 100) / 100
  }

  function handlePaymentPretChange(value: string) {
    setPaymentPretId(value)
    setPaymentForm({
      remboursementId: '',
      montant: '',
      principal: '',
      datePaiement: new Date().toISOString().split('T')[0],
    })
    setPaymentError('')
    setPaymentSuccess('')
    setPaymentInterestDue(0)
    setPaymentPrincipalDue(0)
    loadPaymentRemboursements(value)
  }

  function handlePaymentRemboursementChange(value: string) {
    const remboursement = paymentRemboursements.find((r) => r.id.toString() === value)
    if (!remboursement) {
      setPaymentForm((prev) => ({
        ...prev,
        remboursementId: value,
        montant: '',
        principal: '',
      }))
      setPaymentInterestDue(0)
      setPaymentPrincipalDue(0)
      return
    }
    const montant = Number(remboursement.montant || 0)
    const principalValue = computePrincipal(remboursement)
    const interestValue =
      remboursement.interet != null
        ? Number(remboursement.interet)
        : Math.max(montant - principalValue, 0)
    setPaymentInterestDue(Math.max(interestValue, 0))
    setPaymentPrincipalDue(principalValue)
    setPaymentForm((prev) => ({
      ...prev,
      remboursementId: value,
      montant: montant.toString(),
      principal: Math.max(montant - interestValue, 0).toFixed(2),
    }))
    setPaymentError('')
    setPaymentSuccess('')
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPaymentError('')
    setPaymentSuccess('')

    if (!paymentPretId) {
      setPaymentError('Veuillez sélectionner un prêt')
      return
    }
    const remboursement = paymentRemboursements.find(
      (r) => r.id.toString() === paymentForm.remboursementId,
    )
    if (!remboursement) {
      setPaymentError('Veuillez sélectionner une échéance à payer')
      return
    }
    const montant = parseFloat(paymentForm.montant)
    if (Number.isNaN(montant) || montant <= 0) {
      setPaymentError('Montant invalide')
      return
    }
    const interestPortion = Math.min(montant, Math.max(paymentInterestDue, 0))
    const principalPortion = Math.max(montant - interestPortion, 0)
    if (!paymentForm.datePaiement) {
      setPaymentError('Date de paiement requise')
      return
    }

    try {
      setPaymentLoading(true)
      const pretRecord = getPretById(remboursement.pret_id)
      const interet = Math.max(interestPortion, 0)
      const principal = Math.max(principalPortion, 0)

      const { error } = await supabase
        .from('remboursements')
        .update({
          statut: 'paye',
          date_paiement: paymentForm.datePaiement,
          montant,
          principal,
          interet,
        })
        .eq('id', remboursement.id)

      if (error) throw error

      if (pretRecord) {
        const nouveauCapital = Math.max(
          (pretRecord.capital_restant ?? pretRecord.montant_pret ?? 0) - principal,
          0,
        )
        const { error: capitalError } = await supabase
          .from('prets')
          .update({ capital_restant: nouveauCapital })
          .eq('pret_id', remboursement.pret_id)
        if (capitalError) throw capitalError
      }

      const { data: allRemboursements, error: checkError } = await supabase
        .from('remboursements')
        .select('statut')
        .eq('pret_id', remboursement.pret_id)

      if (checkError) throw checkError

      const allPaid = allRemboursements?.every((r) => r.statut === 'paye')
      if (allPaid) {
        const { error: updateError } = await supabase
          .from('prets')
          .update({ statut: 'termine' })
          .eq('pret_id', remboursement.pret_id)
        if (updateError) throw updateError
      }

      setPaymentSuccess('Paiement enregistré avec succès')
      loadRemboursements()
      loadPrets()
      loadPaymentRemboursements(paymentPretId)
      setPaymentInterestDue(0)
      setPaymentPrincipalDue(0)
      setPaymentForm((prev) => ({
        ...prev,
        remboursementId: '',
        montant: '',
        principal: '',
      }))
    } catch (error: any) {
      console.error('Erreur lors de l’enregistrement du paiement:', error)
      setPaymentError(error.message || 'Erreur lors de l’enregistrement du paiement')
    } finally {
      setPaymentLoading(false)
    }
  }

  function getStatutColor(statut: string, dateRemboursement: string) {
    if (statut === 'paye') return 'bg-green-100 text-green-800'
    if (statut === 'en_retard') return 'bg-red-100 text-red-800'
    
    // Vérifier si en retard
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateRemb = new Date(dateRemboursement)
    dateRemb.setHours(0, 0, 0, 0)
    
    if (dateRemb < today && statut === 'en_attente') {
      return 'bg-red-100 text-red-800'
    }
    
    return 'bg-yellow-100 text-yellow-800'
  }

  function getStatutLabel(statut: string, dateRemboursement: string) {
    if (statut === 'paye') return 'Payé'
    if (statut === 'en_retard') return 'En retard'
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateRemb = new Date(dateRemboursement)
    dateRemb.setHours(0, 0, 0, 0)
    
    if (dateRemb < today && statut === 'en_attente') {
      return 'En retard'
    }
    
    return 'En attente'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  const stats = {
    total: remboursements.length,
    payes: remboursements.filter(r => r.statut === 'paye').length,
    en_attente: remboursements.filter(r => r.statut === 'en_attente').length,
    en_retard: remboursements.filter(r => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dateRemb = new Date(r.date_remboursement)
      dateRemb.setHours(0, 0, 0, 0)
      return r.statut === 'en_attente' && dateRemb < today
    }).length,
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Remboursements</h1>
            <p className="text-gray-600 mt-2">Enregistrer les remboursements quotidiens</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {userProfile && (userProfile.role === 'admin' || userProfile.role === 'agent') && (
              <button
                onClick={() => {
                  const next = !showPaymentForm
                  setShowPaymentForm(next)
                  if (!next) {
                    resetPaymentForm()
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showPaymentForm ? 'Fermer le formulaire' : 'Enregistrer un paiement'}
              </button>
            )}
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Accueil
            </Link>
          </div>
        </div>

        {showPaymentForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Enregistrer un paiement</h2>
            {paymentError && (
              <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
                {paymentError}
              </div>
            )}
            {paymentSuccess && (
              <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded">
                {paymentSuccess}
              </div>
            )}
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prêt *
                  </label>
                  <select
                    value={paymentPretId}
                    onChange={(e) => handlePaymentPretChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={paymentLoading}
                    required
                  >
                    <option value="">Sélectionner un prêt</option>
                    {prets.map((pret) => (
                      <option key={pret.id} value={pret.pret_id}>
                        {pret.pret_id} - {getMemberLabel(pret.membre_id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Échéance à payer *
                  </label>
                  <select
                    value={paymentForm.remboursementId}
                    onChange={(e) => handlePaymentRemboursementChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!paymentPretId || paymentLoading}
                    required
                  >
                    <option value="">Sélectionner une échéance</option>
                    {paymentRemboursements.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.numero_remboursement} - {getMemberLabel(r.membre_id)} - {formatDate(r.date_remboursement)} (
                        {formatCurrency(Number(r.montant || 0))})
                      </option>
                    ))}
                  </select>
                  {!paymentLoading && paymentPretId && paymentRemboursements.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Aucune échéance en attente pour ce prêt.
                    </p>
                  )}
                </div>
                {paymentPretId && (
                  <div className="md:col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-900">
                    <p className="font-semibold">
                      Membre : {getMemberName(getPretById(paymentPretId)?.membre_id)}
                    </p>
                    <p>
                      Prêt : {paymentPretId}{' '}
                      {getPretById(paymentPretId)?.montant_pret
                        ? ` • Montant initial : ${formatCurrency(
                            Number(getPretById(paymentPretId)?.montant_pret || 0),
                          )}`
                        : ''}
                    </p>
                    {paymentForm.remboursementId && (
                      <p>
                        Échéance sélectionnée : #{paymentRemboursements.find(
                          (r) => r.id.toString() === paymentForm.remboursementId,
                        )?.numero_remboursement}{' '}
                        • Montant prévu :{' '}
                        {formatCurrency(
                          Number(
                            paymentRemboursements.find(
                              (r) => r.id.toString() === paymentForm.remboursementId,
                            )?.montant || 0,
                          ),
                        )}
                        {' • '}Intérêt dû : {formatCurrency(paymentInterestDue)}{' '}
                        {' • '}Principal dû : {formatCurrency(paymentPrincipalDue)}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Montant payé (HTG) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.montant}
                    onChange={(e) => {
                      const value = e.target.value
                      const numeric = parseFloat(value)
                      const computedPrincipal =
                        !Number.isNaN(numeric) && value !== ''
                          ? Math.max(numeric - Math.max(paymentInterestDue, 0), 0)
                          : 0
                      setPaymentForm((prev) => ({
                        ...prev,
                        montant: value,
                        principal: value === '' ? '' : computedPrincipal.toFixed(2),
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!paymentForm.remboursementId || paymentLoading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Principal appliqué (HTG)
                  </label>
                  <input
                    type="text"
                    value={paymentForm.principal}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Le principal est calculé après avoir couvert l’intérêt dû.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de paiement *
                  </label>
                  <input
                    type="date"
                    value={paymentForm.datePaiement}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, datePaiement: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={paymentLoading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intérêt calculé
                  </label>
                  <input
                    type="text"
                    value={
                      paymentForm.montant
                        ? formatCurrency(
                            Math.min(
                              parseFloat(paymentForm.montant || '0'),
                              Math.max(paymentInterestDue, 0),
                            ),
                          )
                        : formatCurrency(0)
                    }
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                  {paymentInterestDue > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Intérêt restant après ce paiement :{' '}
                      {paymentForm.montant
                        ? formatCurrency(
                            Math.max(
                              paymentInterestDue -
                                Math.min(
                                  parseFloat(paymentForm.montant || '0'),
                                  Math.max(paymentInterestDue, 0),
                                ),
                              0,
                            ),
                          )
                        : formatCurrency(paymentInterestDue)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paymentLoading ? 'Enregistrement...' : 'Enregistrer le paiement'}
                </button>
                <button
                  type="button"
                  onClick={() => resetPaymentForm()}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={paymentLoading}
                >
                  Réinitialiser
                </button>
              </div>
            </form>
          </div>
        )}


        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Payés</div>
            <div className="text-2xl font-bold text-green-600">{stats.payes}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">En attente</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.en_attente}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">En retard</div>
            <div className="text-2xl font-bold text-red-600">{stats.en_retard}</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrer par prêt
              </label>
              <select
                value={filterPret}
                onChange={(e) => setFilterPret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les prêts</option>
                {prets.map((pret) => (
                  <option key={pret.id} value={pret.pret_id}>
                    {pret.pret_id} - {pret.membre_id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrer par statut
              </label>
              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les statuts</option>
                <option value="en_attente">En attente</option>
                <option value="paye">Payé</option>
                <option value="en_retard">En retard</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table des remboursements */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prêt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° Remb.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Principal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Intérêt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date prévue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date payée
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {remboursements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                    Aucun remboursement trouvé
                  </td>
                </tr>
              ) : (
                remboursements.map((remboursement) => (
                  <tr key={remboursement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {remboursement.pret_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {remboursement.membre_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {remboursement.numero_remboursement}/23
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(remboursement.montant)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(remboursement.principal ?? 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(remboursement.interet ?? 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(remboursement.date_remboursement)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {remboursement.date_paiement ? formatDate(remboursement.date_paiement) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatutColor(remboursement.statut, remboursement.date_remboursement)}`}>
                        {getStatutLabel(remboursement.statut, remboursement.date_remboursement)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {remboursement.statut !== 'paye' && (
                          <button
                            onClick={() => handlePaiement(remboursement)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Marquer payé
                          </button>
                        )}
                        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                          <>
                            <button
                              onClick={() => handleEditRemboursement(remboursement)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDeleteRemboursement(remboursement)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function RemboursementsPage() {
  return (
    <ProtectedRoute requiredPermission="canProcessRemboursements">
      <RemboursementsPageContent />
    </ProtectedRoute>
  )
}

