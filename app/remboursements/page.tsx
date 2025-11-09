'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, type Remboursement, type Pret, type UserProfile } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'

function RemboursementsPageContent() {
  const [remboursements, setRemboursements] = useState<Remboursement[]>([])
  const [prets, setPrets] = useState<Pret[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPret, setFilterPret] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadPrets()
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

      alert('Remboursement modifié avec succès')
      loadRemboursements()
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Remboursements</h1>
            <p className="text-gray-600 mt-2">Enregistrer les remboursements quotidiens</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Accueil
          </Link>
        </div>

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

