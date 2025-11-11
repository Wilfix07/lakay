'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, type Pret, type Membre, type Agent, type UserProfile } from '@/lib/supabase'
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils'
import { addDays, getDay } from 'date-fns'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'

function PretsPageContent() {
  const [prets, setPrets] = useState<Pret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPret, setEditingPret] = useState<Pret | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [formData, setFormData] = useState({
    membre_id: '',
    agent_id: '',
    montant_pret: '',
    date_decaissement: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadAgents()
      loadMembres()
      loadPrets()
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        setFormData(prev => ({ ...prev, agent_id: userProfile.agent_id! }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

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
      
      // Validation
      if (isNaN(montantPret) || montantPret <= 0) {
        alert('Le montant du prêt doit être un nombre positif')
        return
      }

      if (!formData.membre_id) {
        alert('Veuillez sélectionner un membre')
        return
      }

      // Vérifier si le membre a déjà un prêt actif
      const { data: activeLoans, error: activeLoansError } = await supabase
        .from('prets')
        .select('id')
        .eq('membre_id', formData.membre_id)
        .eq('statut', 'actif')
        .limit(1)

      if (activeLoansError) throw activeLoansError
      if (activeLoans && activeLoans.length > 0) {
        alert('Ce membre a déjà un prêt actif. Il doit terminer de le rembourser avant de contracter un nouveau prêt.')
        return
      }

      // Calcul avec intérêt de 15% sur chaque remboursement quotidien
      // Montant de base par jour (sans intérêt) = montant_pret / 23
      const montantBaseParJour = montantPret / 23
      const montantInteretParJour = Math.round((montantBaseParJour * 0.15) * 100) / 100
      const montantRemboursement = Math.round((montantBaseParJour + montantInteretParJour) * 100) / 100 // Arrondi à 2 décimales
      
      // Vérification : montant total remboursé = montantRemboursement * 23 = montantPret * 1.15

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

      // Fonction pour obtenir le prochain jour ouvrable (exclut samedi=6 et dimanche=0)
      function getNextBusinessDay(date: Date): Date {
        let nextDay = new Date(date)
        let dayOfWeek = getDay(nextDay)
        
        // Si c'est samedi (6), passer à lundi
        if (dayOfWeek === 6) {
          nextDay = addDays(nextDay, 2)
        }
        // Si c'est dimanche (0), passer à lundi
        else if (dayOfWeek === 0) {
          nextDay = addDays(nextDay, 1)
        }
        
        return nextDay
      }

      // Fonction pour obtenir le prochain jour ouvrable à partir d'une date
      function getNextBusinessDayFrom(date: Date): Date {
        let nextDay = addDays(date, 1)
        return getNextBusinessDay(nextDay)
      }

      // Calculer la date du premier remboursement (2ème jour ouvrable après décaissement)
      const dateDecaissement = new Date(formData.date_decaissement)
      let datePremierRemboursement = addDays(dateDecaissement, 2)
      datePremierRemboursement = getNextBusinessDay(datePremierRemboursement)

      // Créer le prêt
      const { error: pretError } = await supabase
        .from('prets')
        .insert([{
          pret_id: newPretId,
          membre_id: formData.membre_id,
          agent_id: formData.agent_id,
          montant_pret: montantPret,
          montant_remboursement: montantRemboursement,
          nombre_remboursements: 23,
          date_decaissement: formData.date_decaissement,
          date_premier_remboursement: datePremierRemboursement.toISOString().split('T')[0],
          statut: 'actif',
          capital_restant: montantPret,
        }])

      if (pretError) throw pretError

      // Créer les 23 remboursements en excluant les weekends
      const remboursements = []
      let currentDate = new Date(datePremierRemboursement)
      
      for (let i = 1; i <= 23; i++) {
        // S'assurer que la date n'est pas un weekend
        currentDate = getNextBusinessDay(currentDate)
        
        remboursements.push({
          pret_id: newPretId,
          membre_id: formData.membre_id,
          agent_id: formData.agent_id,
          numero_remboursement: i,
          montant: montantRemboursement,
          principal: Math.round(montantBaseParJour * 100) / 100,
          interet: montantInteretParJour,
          date_remboursement: currentDate.toISOString().split('T')[0],
          statut: 'en_attente',
        })
        
        // Passer au jour ouvrable suivant pour la prochaine itération
        currentDate = addDays(currentDate, 1)
      }

      const { error: rembError } = await supabase
        .from('remboursements')
        .insert(remboursements)

      if (rembError) throw rembError

      alert('Prêt créé avec succès! Les 23 remboursements ont été générés.')
      setShowForm(false)
      setFormData({
        membre_id: '',
        agent_id: '',
        montant_pret: '',
        date_decaissement: new Date().toISOString().split('T')[0],
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
      
      if (isNaN(montantPret) || montantPret <= 0) {
        alert('Le montant du prêt doit être un nombre positif')
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
          .eq('statut', 'actif')
          .limit(1)

        if (activeLoansError) throw activeLoansError
        if (activeLoans && activeLoans.length > 0) {
          alert('Le membre sélectionné a déjà un prêt actif. Terminez-le ou choisissez un autre membre.')
          return
        }
      }

      // Recalculer avec intérêt de 15% sur chaque remboursement quotidien
      const montantBaseParJour = montantPret / 23
      // Ajouter 15% d'intérêt sur chaque remboursement quotidien
      const montantRemboursement = Math.round((montantBaseParJour * 1.15) * 100) / 100

      // Calculer la nouvelle date du premier remboursement
      const dateDecaissement = new Date(formData.date_decaissement)
      function getNextBusinessDay(date: Date): Date {
        let nextDay = new Date(date)
        let dayOfWeek = getDay(nextDay)
        if (dayOfWeek === 6) nextDay = addDays(nextDay, 2)
        else if (dayOfWeek === 0) nextDay = addDays(nextDay, 1)
        return nextDay
      }
      function getNextBusinessDayFrom(date: Date): Date {
        let nextDay = addDays(date, 1)
        return getNextBusinessDay(nextDay)
      }
      let datePremierRemboursement = addDays(dateDecaissement, 2)
      datePremierRemboursement = getNextBusinessDay(datePremierRemboursement)

      // Mettre à jour le prêt
      const { error: pretError } = await supabase
        .from('prets')
        .update({
          membre_id: formData.membre_id,
          agent_id: formData.agent_id,
          montant_pret: montantPret,
          montant_remboursement: montantRemboursement,
          date_decaissement: formData.date_decaissement,
          date_premier_remboursement: datePremierRemboursement.toISOString().split('T')[0],
        })
        .eq('id', editingPret.id)

      if (pretError) throw pretError

      // Mettre à jour tous les remboursements
      let currentDate = new Date(datePremierRemboursement)
      
      for (let i = 1; i <= 23; i++) {
        currentDate = getNextBusinessDay(currentDate)
        const montantInteretParJour = Math.round((montantBaseParJour * 0.15) * 100) / 100
        await supabase
          .from('remboursements')
          .update({
            montant: montantRemboursement,
            principal: Math.round(montantBaseParJour * 100) / 100,
            interet: montantInteretParJour,
            date_remboursement: currentDate.toISOString().split('T')[0],
          })
          .eq('pret_id', editingPret.pret_id)
          .eq('numero_remboursement', i)
        currentDate = addDays(currentDate, 1)
      }

      alert('Décaissement modifié avec succès')
      setShowForm(false)
      setEditingPret(null)
      setFormData({
        membre_id: '',
        agent_id: '',
        montant_pret: '',
        date_decaissement: new Date().toISOString().split('T')[0],
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Prêts</h1>
            <p className="text-gray-600 mt-2">Créer des prêts et effectuer les décaissements</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Accueil
            </Link>
            <button
              onClick={() => {
                setShowForm(!showForm)
                setEditingPret(null)
                setFormData({
                  membre_id: '',
                  agent_id: '',
                  montant_pret: '',
                  date_decaissement: new Date().toISOString().split('T')[0],
                })
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showForm ? 'Annuler' : '+ Nouveau Prêt'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {editingPret ? 'Modifier le décaissement' : 'Créer un nouveau prêt'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
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
                    onChange={(e) => {
                      const value = e.target.value
                      // Valider que c'est un nombre positif
                      if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                        setFormData({ ...formData, montant_pret: value })
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {formData.montant_pret && !isNaN(parseFloat(formData.montant_pret)) && parseFloat(formData.montant_pret) > 0 && (() => {
                    const montantPret = parseFloat(formData.montant_pret)
                    const montantBaseParJour = montantPret / 23
                    const montantRemboursementParJour = Math.round((montantBaseParJour * 1.15) * 100) / 100
                    const montantTotalRembourse = montantRemboursementParJour * 23
                    const interetTotal = montantTotalRembourse - montantPret
                    
                    return (
                      <div className="text-sm text-gray-600 mt-1 space-y-1">
                        <p>
                          <strong>Montant de base par jour:</strong> {formatCurrency(Math.round(montantBaseParJour * 100) / 100)}
                        </p>
                        <p className="text-blue-600">
                          <strong>Montant à rembourser par jour (avec 15% d'intérêt):</strong> {formatCurrency(montantRemboursementParJour)}
                        </p>
                        <p>
                          <strong>Total à rembourser:</strong> {formatCurrency(Math.round(montantTotalRembourse * 100) / 100)} (23 remboursements)
                        </p>
                        <p className="text-green-600">
                          <strong>Intérêt total:</strong> {formatCurrency(Math.round(interetTotal * 100) / 100)}
                        </p>
                      </div>
                    )
                  })()}
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
                    // Calculer la date du premier remboursement en excluant les weekends
                    const dateDecaissement = new Date(formData.date_decaissement)
                    let datePremierRemb = addDays(dateDecaissement, 2)
                    const dayOfWeek = getDay(datePremierRemb)
                    // Si samedi (6), passer à lundi (+2 jours)
                    if (dayOfWeek === 6) {
                      datePremierRemb = addDays(datePremierRemb, 2)
                    }
                    // Si dimanche (0), passer à lundi (+1 jour)
                    else if (dayOfWeek === 0) {
                      datePremierRemb = addDays(datePremierRemb, 1)
                    }
                    return (
                      <p className="text-sm text-gray-600 mt-1">
                        Premier remboursement: {formatDate(datePremierRemb)} (jours ouvrés uniquement)
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
                    Remboursement/jour
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
                    <td colSpan={(userProfile?.role === 'admin' || userProfile?.role === 'manager') ? 7 : 6} className="px-6 py-4 text-center text-gray-500">
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
    </div>
  )
}

export default function PretsPage() {
  return (
    <ProtectedRoute requiredPermission="canCreatePrets">
      <PretsPageContent />
    </ProtectedRoute>
  )
}

