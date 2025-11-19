'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, type Remboursement, type Pret, type UserProfile, type Membre, type GroupPret, type GroupRemboursement } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useRouter } from 'next/navigation'

function RemboursementsPageContent() {
  const router = useRouter()
  const [remboursements, setRemboursements] = useState<Remboursement[]>([])
  const [groupRemboursements, setGroupRemboursements] = useState<GroupRemboursement[]>([])
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPret, setFilterPret] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentPretId, setPaymentPretId] = useState('')
  const [paymentPretType, setPaymentPretType] = useState<'individual' | 'group'>('individual')
  const [paymentMemberId, setPaymentMemberId] = useState('') // Pour les remboursements de groupe
  const [paymentRemboursements, setPaymentRemboursements] = useState<Remboursement[]>([])
  const [paymentGroupRemboursements, setPaymentGroupRemboursements] = useState<GroupRemboursement[]>([])
  const [groupMembersForPayment, setGroupMembersForPayment] = useState<Membre[]>([])
  const [paymentForm, setPaymentForm] = useState({
    remboursementId: '',
    montant: '',
    principal: '',
    datePaiement: new Date().toISOString().split('T')[0],
  })
  const [paymentInterestDue, setPaymentInterestDue] = useState(0)
  const [paymentPrincipalDue, setPaymentPrincipalDue] = useState(0)
  const [memberPaidSummary, setMemberPaidSummary] = useState<Record<string, number>>({})
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')
  const [partialLockInfo, setPartialLockInfo] = useState<{
    active: boolean
    message?: string
  }>({ active: false })

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

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
      // Charger les prêts individuels
      let query = supabase
        .from('prets')
        .select('*')
        .eq('statut', 'actif')
        .order('pret_id', { ascending: false })

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
        }
      }
      // Admin voit tous les prêts (pas de filtre)

      const { data, error } = await query
      if (error) throw error
      setPrets(data || [])

      // Charger les prêts de groupe
      let groupQuery = supabase
        .from('group_prets')
        .select('*')
        .eq('statut', 'actif')
        .order('pret_id', { ascending: false })

      // Les agents ne voient que leurs propres prêts de groupe
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        groupQuery = groupQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Manager voit seulement les prêts de groupe de ses agents
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

      const { data: groupData, error: groupError } = await groupQuery
      if (groupError) {
        // Si la table n'existe pas encore, ignorer l'erreur
        if (groupError.code !== '42P01') {
          console.error('Erreur lors du chargement des prêts de groupe:', groupError)
        }
        setGroupPrets([])
      } else {
        setGroupPrets(groupData || [])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des prêts:', error)
    }
  }

  async function loadMembres() {
    try {
      let query = supabase
        .from('membres')
        .select('*')
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

  async function loadPaymentRemboursements(pretId: string, pretType: 'individual' | 'group' = 'individual', memberId?: string) {
    if (!pretId) {
      setPaymentRemboursements([])
      setPaymentGroupRemboursements([])
      setPartialLockInfo({ active: false })
      return
    }

    try {
      setPaymentLoading(true)

      if (pretType === 'group') {
        // Charger les remboursements de groupe
        if (!memberId) {
          // Si aucun membre n'est sélectionné, charger tous les remboursements de groupe pour ce prêt
          setPaymentGroupRemboursements([])
          setPartialLockInfo({ active: false })
          return
        }

        let groupQuery = supabase
          .from('group_remboursements')
          .select('*')
          .eq('pret_id', pretId)
          .eq('membre_id', memberId)
          .in('statut', ['en_attente', 'en_retard', 'paye_partiel'])
          .order('numero_remboursement', { ascending: true })

        if (userProfile?.role === 'agent' && userProfile.agent_id) {
          groupQuery = groupQuery.eq('agent_id', userProfile.agent_id)
        }

        const { data: groupData, error: groupError } = await groupQuery
        if (groupError) throw groupError

        const groupList = groupData || []
        
        // Vérifier s'il y a un remboursement partiel
        const partial = groupList.find((r) => r.statut === 'paye_partiel')
        if (partial) {
          setPaymentGroupRemboursements([partial])
          const amounts = computeScheduledAmountsGroup(partial)
          const remaining = partial.statut === 'paye_partiel' ? amounts.remainingTotal : amounts.scheduledTotal
          setPartialLockInfo({
            active: true,
            message: `Ce membre a un remboursement partiel (#${partial.numero_remboursement}). Le solde de ${formatCurrency(remaining)} doit être réglé avant de passer à une autre échéance.`,
          })
          return
        }

        // Charger tous les remboursements pour vérifier l'ordre séquentiel
        const allGroupQuery = supabase
          .from('group_remboursements')
          .select('numero_remboursement, statut')
          .eq('pret_id', pretId)
          .eq('membre_id', memberId)
          .order('numero_remboursement', { ascending: true })

        if (userProfile?.role === 'agent' && userProfile.agent_id) {
          allGroupQuery.eq('agent_id', userProfile.agent_id)
        }

        const { data: allGroupRemboursements, error: allGroupError } = await allGroupQuery
        if (allGroupError) throw allGroupError

        // Filtrer pour ne garder que les remboursements qui peuvent être payés
        const payableGroupRemboursements = groupList.filter((r) => {
          const currentNum = r.numero_remboursement
          const previousUnpaid = allGroupRemboursements?.find(
            (prev) => prev.numero_remboursement < currentNum && prev.statut !== 'paye'
          )
          return !previousUnpaid
        })

        setPaymentGroupRemboursements(payableGroupRemboursements)
        setPaymentRemboursements([]) // Vider les remboursements individuels
        setPartialLockInfo({ active: false })
      } else {
        // Charger les remboursements individuels (code existant)
        let query = supabase
          .from('remboursements')
          .select('*')
          .eq('pret_id', pretId)
          .in('statut', ['en_attente', 'en_retard', 'paye_partiel'])
          .order('numero_remboursement', { ascending: true })

        if (userProfile?.role === 'agent' && userProfile.agent_id) {
          query = query.eq('agent_id', userProfile.agent_id)
        }

        const { data, error } = await query
        if (error) throw error
        const list = data || []
        
        // Vérifier s'il y a un remboursement partiel
        const partial = list.find((r) => r.statut === 'paye_partiel')
        if (partial) {
          setPaymentRemboursements([partial])
          const amounts = computeScheduledAmounts(partial)
          const remaining = partial.statut === 'paye_partiel' ? amounts.remainingTotal : amounts.scheduledTotal
          setPartialLockInfo({
            active: true,
            message: `Ce prêt a un remboursement partiel (#${partial.numero_remboursement}). Le solde de ${formatCurrency(remaining)} doit être réglé avant de passer à une autre échéance.`,
          })
          return
        }

        // Charger tous les remboursements pour vérifier l'ordre séquentiel
        const allQuery = supabase
          .from('remboursements')
          .select('numero_remboursement, statut')
          .eq('pret_id', pretId)
          .order('numero_remboursement', { ascending: true })

        if (userProfile?.role === 'agent' && userProfile.agent_id) {
          allQuery.eq('agent_id', userProfile.agent_id)
        }

        const { data: allRemboursements, error: allError } = await allQuery
        if (allError) throw allError

        // Filtrer pour ne garder que les remboursements qui peuvent être payés
        const payableRemboursements = list.filter((r) => {
          const currentNum = r.numero_remboursement
          const previousUnpaid = allRemboursements?.find(
            (prev) => prev.numero_remboursement < currentNum && prev.statut !== 'paye'
          )
          return !previousUnpaid
        })

        setPaymentRemboursements(payableRemboursements)
        setPaymentGroupRemboursements([]) // Vider les remboursements de groupe
        setPartialLockInfo({ active: false })
      }
    } catch (error) {
      console.error('Erreur lors du chargement des remboursements pour le formulaire:', error)
      setPaymentRemboursements([])
      setPaymentGroupRemboursements([])
      setPartialLockInfo({ active: false })
    } finally {
      setPaymentLoading(false)
    }
  }

  // Fonction helper pour calculer les montants pour les remboursements de groupe
  function computeScheduledAmountsGroup(remboursement: GroupRemboursement) {
    const pretRecord = groupPrets.find((p) => p.pret_id === remboursement.pret_id)
    let scheduledTotal = Math.max(Number(remboursement.montant || 0), 0)

    let scheduledPrincipalBase = 0
    if (!pretRecord) {
      const base = Number(remboursement.montant || 0) / 1
      scheduledPrincipalBase = Math.round(base * 100) / 100
    } else {
      const base = Number(pretRecord.montant_pret || 0) / Number(pretRecord.nombre_remboursements || 1)
      scheduledPrincipalBase = Math.round(base * 100) / 100
    }

    let scheduledPrincipal = scheduledPrincipalBase
    if (remboursement.principal != null) {
      if (remboursement.statut === 'paye') {
        scheduledPrincipal = Number(remboursement.principal)
      } else if (remboursement.statut === 'en_attente' || remboursement.statut === 'en_retard') {
        scheduledPrincipal = Number(remboursement.principal)
      }
    }

    const scheduledInterest = Math.max(scheduledTotal - scheduledPrincipal, 0)
    const paidPrincipal = remboursement.statut === 'paye' || remboursement.statut === 'paye_partiel'
      ? Math.max(Number(remboursement.principal || 0), 0)
      : 0
    const paidInterest = remboursement.statut === 'paye' || remboursement.statut === 'paye_partiel'
      ? Math.max(Number(remboursement.interet || 0), 0)
      : 0

    const remainingPrincipal = Math.max(scheduledPrincipal - paidPrincipal, 0)
    const remainingInterest = Math.max(scheduledInterest - paidInterest, 0)

    return {
      scheduledTotal,
      scheduledPrincipal,
      scheduledInterest,
      paidPrincipal,
      paidInterest,
      remainingPrincipal,
      remainingInterest,
      remainingTotal: remainingPrincipal + remainingInterest,
    }
  }

  async function loadRemboursements() {
    try {
      setLoading(true)
      
      // Charger les remboursements individuels
      let query = supabase
        .from('remboursements')
        .select('*')
        .order('date_remboursement', { ascending: true })

      // Les agents ne voient que leurs propres remboursements
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Manager voit seulement les remboursements de ses agents
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
          setRemboursements([])
        }
      }
      // Admin voit tous les remboursements (pas de filtre)

      if (filterPret) {
        query = query.eq('pret_id', filterPret)
      }

      if (filterStatut) {
        query = query.eq('statut', filterStatut)
      }

      const { data, error } = await query
      if (error) throw error
      setRemboursements(data || [])

      // Charger les remboursements de groupe
      let groupQuery = supabase
        .from('group_remboursements')
        .select('*')
        .order('date_remboursement', { ascending: true })

      // Les agents ne voient que leurs propres remboursements de groupe
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        groupQuery = groupQuery.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Manager voit seulement les remboursements de groupe de ses agents
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          groupQuery = groupQuery.in('agent_id', agentIds)
        } else {
          setGroupRemboursements([])
        }
      }

      if (filterPret) {
        groupQuery = groupQuery.eq('pret_id', filterPret)
      }

      if (filterStatut) {
        groupQuery = groupQuery.eq('statut', filterStatut)
      }

      const { data: groupData, error: groupError } = await groupQuery
      if (groupError) {
        // Si la table n'existe pas encore, ignorer l'erreur
        if (groupError.code !== '42P01' && groupError.code !== 'PGRST116' && groupError.status !== 404) {
          console.error('Erreur lors du chargement des remboursements de groupe:', groupError)
        }
        setGroupRemboursements([])
      } else {
        setGroupRemboursements(groupData || [])
      }

      // Calculer le résumé des paiements pour les membres
      const paidMap: Record<string, number> = {}
      for (const remboursement of data || []) {
        if (remboursement.statut === 'paye' || remboursement.statut === 'paye_partiel') {
          const pret = getPretById(remboursement.pret_id)
          const memberId = pret?.membre_id || remboursement.membre_id
          if (!memberId) continue
          paidMap[memberId] = (paidMap[memberId] ?? 0) + Number(remboursement.principal || 0)
        }
      }
      
      // Ajouter les remboursements de groupe au résumé
      for (const groupRemboursement of groupData || []) {
        if (groupRemboursement.statut === 'paye' || groupRemboursement.statut === 'paye_partiel') {
          const memberId = groupRemboursement.membre_id
          if (!memberId) continue
          paidMap[memberId] = (paidMap[memberId] ?? 0) + Number(groupRemboursement.principal || 0)
        }
      }
      
      setMemberPaidSummary(paidMap)
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
    setPartialLockInfo({ active: false })
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

function computeScheduledAmounts(remboursement: Remboursement) {
  const pretRecord = getPretById(remboursement.pret_id)
  const scheduledTotal =
    pretRecord && pretRecord.montant_remboursement != null
      ? Number(pretRecord.montant_remboursement || 0)
      : Math.max(Number(remboursement.montant || 0), 0)

  let scheduledPrincipalBase: number
  if (pretRecord && pretRecord.nombre_remboursements) {
    const base =
      Number(pretRecord.montant_pret || 0) / Number(pretRecord.nombre_remboursements || 1)
    scheduledPrincipalBase = Math.round(base * 100) / 100
  } else {
    scheduledPrincipalBase = Math.max(Number(remboursement.principal || 0), 0)
  }

  let scheduledPrincipal = scheduledPrincipalBase
  if (remboursement.principal != null) {
    if (remboursement.statut === 'paye') {
      scheduledPrincipal = Number(remboursement.principal)
    } else if (
      remboursement.statut === 'en_attente' ||
      remboursement.statut === 'en_retard'
    ) {
      scheduledPrincipal = Number(remboursement.principal)
    }
  }

  const scheduledInterest = Math.max(scheduledTotal - scheduledPrincipal, 0)
  const paidPrincipal =
    remboursement.statut === 'paye' || remboursement.statut === 'paye_partiel'
      ? Math.max(Number(remboursement.principal || 0), 0)
      : 0
  const paidInterest =
    remboursement.statut === 'paye' || remboursement.statut === 'paye_partiel'
      ? Math.max(Number(remboursement.interet || 0), 0)
      : 0

  const remainingPrincipal = Math.max(scheduledPrincipal - paidPrincipal, 0)
  const remainingInterest = Math.max(scheduledInterest - paidInterest, 0)

  return {
    scheduledTotal,
    scheduledPrincipal,
    scheduledInterest,
    paidPrincipal,
    paidInterest,
    remainingPrincipal,
    remainingInterest,
    remainingTotal: remainingPrincipal + remainingInterest,
  }
}

  async function loadGroupMembersForPayment(groupPretId: string) {
    const groupPret = groupPrets.find((gp) => gp.pret_id === groupPretId)
    if (!groupPret) {
      setGroupMembersForPayment([])
      return
    }

    try {
      // Charger les membres du groupe depuis la table membre_group_members
      const { data: groupMembers, error: groupMembersError } = await supabase
        .from('membre_group_members')
        .select('membre_id')
        .eq('group_id', groupPret.group_id)

      if (groupMembersError) {
        // Si la table n'existe pas (404), ignorer l'erreur et retourner un tableau vide
        const isTableNotFound = 
          groupMembersError.code === 'PGRST116' || 
          groupMembersError.status === 404 ||
          groupMembersError.message?.includes('404') ||
          groupMembersError.message?.includes('does not exist') ||
          (groupMembersError.message?.includes('relation') && groupMembersError.message?.includes('not found'))
        
        if (isTableNotFound) {
          console.warn('Table membre_group_members non trouvée, utilisation d\'un tableau vide')
          setGroupMembersForPayment([])
          return
        }
        throw groupMembersError
      }

      const memberIds = groupMembers?.map((gm) => gm.membre_id) || []
      const filteredMembers = membres.filter((m) => memberIds.includes(m.membre_id))
      setGroupMembersForPayment(filteredMembers)
    } catch (error) {
      console.error('Erreur lors du chargement des membres du groupe:', error)
      setGroupMembersForPayment([])
    }
  }

  async function handlePaymentPretChange(value: string) {
    // Détecter si c'est un prêt de groupe ou individuel
    const isGroupPret = groupPrets.some((gp) => gp.pret_id === value)
    const pretType: 'individual' | 'group' = isGroupPret ? 'group' : 'individual'
    
    setPaymentPretId(value)
    setPaymentPretType(pretType)
    setPaymentMemberId('') // Réinitialiser le membre sélectionné
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
    
    // Pour les prêts de groupe, charger les membres et attendre la sélection
    if (pretType === 'group') {
      setPaymentRemboursements([])
      setPaymentGroupRemboursements([])
      await loadGroupMembersForPayment(value)
    } else {
      setGroupMembersForPayment([])
      loadPaymentRemboursements(value, 'individual')
    }
  }

  function handlePaymentMemberChange(value: string) {
    setPaymentMemberId(value)
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
    
    if (paymentPretId && value) {
      loadPaymentRemboursements(paymentPretId, 'group', value)
    }
  }

  function handlePaymentRemboursementChange(value: string) {
    if (paymentPretType === 'group') {
      // Traiter les remboursements de groupe
      const remboursement = paymentGroupRemboursements.find((r) => r.id.toString() === value)
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
      const amounts = computeScheduledAmountsGroup(remboursement)
      const remainingInterest = Math.max(amounts.remainingInterest, 0)
      const remainingPrincipal = Math.max(amounts.remainingPrincipal, 0)
      setPaymentInterestDue(remainingInterest)
      setPaymentPrincipalDue(remainingPrincipal)
      setPaymentForm((prev) => ({
        ...prev,
        remboursementId: value,
        montant: (remainingInterest + remainingPrincipal).toFixed(2),
        principal: remainingPrincipal.toFixed(2),
      }))
    } else {
      // Traiter les remboursements individuels
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
      const amounts = computeScheduledAmounts(remboursement)
      const remainingInterest = Math.max(amounts.remainingInterest, 0)
      const remainingPrincipal = Math.max(amounts.remainingPrincipal, 0)
      setPaymentInterestDue(remainingInterest)
      setPaymentPrincipalDue(remainingPrincipal)
      setPaymentForm((prev) => ({
        ...prev,
        remboursementId: value,
        montant: (remainingInterest + remainingPrincipal).toFixed(2),
        principal: remainingPrincipal.toFixed(2),
      }))
    }
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

    // Pour les prêts de groupe, vérifier qu'un membre est sélectionné
    if (paymentPretType === 'group' && !paymentMemberId) {
      setPaymentError('Veuillez sélectionner un membre')
      return
    }

    // Trouver le remboursement approprié selon le type
    const remboursement = paymentPretType === 'group'
      ? paymentGroupRemboursements.find((r) => r.id.toString() === paymentForm.remboursementId)
      : paymentRemboursements.find((r) => r.id.toString() === paymentForm.remboursementId)

    if (!remboursement) {
      setPaymentError('Veuillez sélectionner une échéance à payer')
      return
    }
    if (partialLockInfo.active && remboursement.statut !== 'paye_partiel') {
      setPaymentError(
        "Ce prêt possède une échéance partiellement payée. Veuillez solder cette échéance avant d'en payer une autre.",
      )
      return
    }

    // Vérifier que tous les remboursements précédents sont complètement payés
    try {
      let previousRemboursements: any[] = []
      
      if (paymentPretType === 'group') {
        // Pour les remboursements de groupe, vérifier les remboursements précédents du même membre
        const { data, error: checkError } = await supabase
          .from('group_remboursements')
          .select('numero_remboursement, statut')
          .eq('pret_id', remboursement.pret_id)
          .eq('membre_id', paymentMemberId)
          .lt('numero_remboursement', remboursement.numero_remboursement)
          .order('numero_remboursement', { ascending: true })

        if (checkError) throw checkError
        previousRemboursements = data || []
      } else {
        // Pour les remboursements individuels
        const { data, error: checkError } = await supabase
          .from('remboursements')
          .select('numero_remboursement, statut')
          .eq('pret_id', remboursement.pret_id)
          .lt('numero_remboursement', remboursement.numero_remboursement)
          .order('numero_remboursement', { ascending: true })

        if (checkError) throw checkError
        previousRemboursements = data || []
      }

      // Vérifier qu'il n'y a pas de remboursements précédents non payés
      const unpaidPrevious = previousRemboursements?.find((r) => r.statut !== 'paye')
      if (unpaidPrevious) {
        const unpaidNumbers = previousRemboursements
          ?.filter((r) => r.statut !== 'paye')
          .map((r) => r.numero_remboursement)
          .join(', ')
        
        setPaymentError(
          `Impossible de payer le remboursement #${remboursement.numero_remboursement}.\n\n` +
          `Vous devez d'abord compléter le paiement des remboursements précédents : #${unpaidNumbers}\n\n` +
          "Les remboursements doivent être payés dans l'ordre séquentiel."
        )
        return
      }
    } catch (error: any) {
      console.error('Erreur lors de la vérification des remboursements précédents:', error)
      setPaymentError('Erreur lors de la vérification. Veuillez réessayer.')
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
      const interet = Math.max(interestPortion, 0)
      const principal = Math.max(principalPortion, 0)
      const expectedTotal =
        Math.max(paymentInterestDue, 0) + Math.max(paymentPrincipalDue, 0)
      const newStatus = montant >= expectedTotal - 0.01 ? 'paye' : 'paye_partiel'

      if (paymentPretType === 'group') {
        // Traiter les remboursements de groupe
        const groupRemboursement = remboursement as GroupRemboursement
        const amountsBeforePayment = computeScheduledAmountsGroup(groupRemboursement)
        const cumulativePrincipal = Math.min(
          amountsBeforePayment.paidPrincipal + principal,
          amountsBeforePayment.scheduledPrincipal,
        )
        const cumulativeInterest = Math.min(
          amountsBeforePayment.paidInterest + interet,
          amountsBeforePayment.scheduledInterest,
        )
        const previousPaidTotal =
          groupRemboursement.statut === 'paye_partiel'
            ? Math.max(Number(groupRemboursement.montant || 0), 0)
            : 0
        const cumulativeMontant = Math.min(
          previousPaidTotal + montant,
          amountsBeforePayment.scheduledTotal,
        )

        const { error } = await supabase
          .from('group_remboursements')
          .update({
            statut: newStatus,
            date_paiement: paymentForm.datePaiement,
            montant: cumulativeMontant,
            principal: cumulativePrincipal,
            interet: cumulativeInterest,
          })
          .eq('id', groupRemboursement.id)

        if (error) throw error

        // Vérifier si tous les remboursements de ce membre sont payés
        const { data: allMemberRemboursements, error: checkError } = await supabase
          .from('group_remboursements')
          .select('statut')
          .eq('pret_id', groupRemboursement.pret_id)
          .eq('membre_id', paymentMemberId)

        if (checkError) throw checkError

        const allMemberPaid = allMemberRemboursements?.every((r) => r.statut === 'paye')
        
        // Vérifier si tous les membres du groupe ont payé tous leurs remboursements
        if (allMemberPaid) {
          const { data: allGroupRemboursements, error: allGroupError } = await supabase
            .from('group_remboursements')
            .select('statut')
            .eq('pret_id', groupRemboursement.pret_id)

          if (allGroupError) throw allGroupError

          const allGroupPaid = allGroupRemboursements?.every((r) => r.statut === 'paye')
          if (allGroupPaid) {
            const { error: updateError } = await supabase
              .from('group_prets')
              .update({ statut: 'termine' })
              .eq('pret_id', groupRemboursement.pret_id)
            if (updateError) throw updateError
          }
        }
      } else {
        // Traiter les remboursements individuels
        const individualRemboursement = remboursement as Remboursement
        const pretRecord = getPretById(individualRemboursement.pret_id)
        const amountsBeforePayment = computeScheduledAmounts(individualRemboursement)
        const cumulativePrincipal = Math.min(
          amountsBeforePayment.paidPrincipal + principal,
          amountsBeforePayment.scheduledPrincipal,
        )
        const cumulativeInterest = Math.min(
          amountsBeforePayment.paidInterest + interet,
          amountsBeforePayment.scheduledInterest,
        )
        const previousPaidTotal =
          individualRemboursement.statut === 'paye_partiel'
            ? Math.max(Number(individualRemboursement.montant || 0), 0)
            : 0
        const cumulativeMontant = Math.min(
          previousPaidTotal + montant,
          amountsBeforePayment.scheduledTotal,
        )

        const { error } = await supabase
          .from('remboursements')
          .update({
            statut: newStatus,
            date_paiement: paymentForm.datePaiement,
            montant: cumulativeMontant,
            principal: cumulativePrincipal,
            interet: cumulativeInterest,
          })
          .eq('id', individualRemboursement.id)

        if (error) throw error

        if (pretRecord) {
          const nouveauCapital = Math.max(
            (pretRecord.capital_restant ?? pretRecord.montant_pret ?? 0) - principal,
            0,
          )
          const { error: capitalError } = await supabase
            .from('prets')
            .update({ capital_restant: nouveauCapital })
            .eq('pret_id', individualRemboursement.pret_id)
          if (capitalError) throw capitalError
        }

        const { data: allRemboursements, error: checkError } = await supabase
          .from('remboursements')
          .select('statut')
          .eq('pret_id', individualRemboursement.pret_id)

        if (checkError) throw checkError

        const allPaid = allRemboursements?.every((r) => r.statut === 'paye')
        if (allPaid) {
          const { error: updateError } = await supabase
            .from('prets')
            .update({ statut: 'termine' })
            .eq('pret_id', individualRemboursement.pret_id)
          if (updateError) throw updateError
        }
      }

      setPaymentSuccess(
        newStatus === 'paye'
          ? 'Paiement enregistré avec succès'
          : 'Paiement partiel enregistré',
      )
      loadRemboursements()
      loadPrets()
      if (paymentPretType === 'group' && paymentMemberId) {
        loadPaymentRemboursements(paymentPretId, 'group', paymentMemberId)
      } else {
        loadPaymentRemboursements(paymentPretId, 'individual')
      }
      setPaymentInterestDue(0)
      setPaymentPrincipalDue(0)
      setPaymentForm((prev) => ({
        ...prev,
        remboursementId: '',
        montant: '',
        principal: '',
      }))
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement du paiement:", error)
      setPaymentError(error.message || "Erreur lors de l'enregistrement du paiement")
    } finally {
      setPaymentLoading(false)
    }
  }

  function getStatutColor(statut: string, dateRemboursement: string) {
    if (statut === 'paye') return 'bg-green-100 text-green-800'
    if (statut === 'paye_partiel') return 'bg-blue-100 text-blue-800'
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
    if (statut === 'paye_partiel') return 'Payé partiellement'
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

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  // Combiner tous les remboursements (individuels et de groupe) pour les statistiques et l'affichage
  const allRemboursements = [
    ...remboursements.map(r => ({ ...r, type: 'individual' as const })),
    ...groupRemboursements.map(r => ({ ...r, type: 'group' as const }))
  ]

  const stats = {
    total: allRemboursements.length,
    payes: allRemboursements.filter(r => r.statut === 'paye').length,
    payesPartiels: allRemboursements.filter(r => r.statut === 'paye_partiel').length,
    en_attente: allRemboursements.filter(r => r.statut === 'en_attente').length,
    en_retard: allRemboursements.filter(r => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dateRemb = new Date(r.date_remboursement)
      dateRemb.setHours(0, 0, 0, 0)
      return r.statut === 'en_attente' && dateRemb < today
    }).length,
  }

  // Afficher TOUS les remboursements, triés par date de remboursement (plus récent en premier)
  const displayedRemboursements = [...allRemboursements].sort((a, b) => {
    const dateA = new Date(a.date_remboursement).getTime()
    const dateB = new Date(b.date_remboursement).getTime()
    return dateB - dateA // Tri décroissant (plus récent en premier)
  })

  const selectedPayment = paymentPretType === 'group'
    ? null
    : paymentRemboursements.find((r) => r.id.toString() === paymentForm.remboursementId)
  const selectedPaymentAmounts = selectedPayment
    ? computeScheduledAmounts(selectedPayment)
    : null
  const selectedAlreadyPaid =
    selectedPayment && selectedPayment.statut === 'paye_partiel'
      ? Math.max(Number(selectedPayment.montant || 0), 0)
      : 0

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Remboursements</h1>
            <p className="text-gray-600 mt-2">Enregistrer les remboursements quotidiens</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {(userProfile.role === 'admin' || userProfile.role === 'agent') && (
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
          </div>
        </div>

        {showPaymentForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-start gap-4 mb-6">
              {paymentPretId && (() => {
                const pretRecord = getPretById(paymentPretId)
                const membre = membres.find((m) => m.membre_id === pretRecord?.membre_id)
                return membre ? (
                  <div className="flex-shrink-0">
                    {membre.photo_url ? (
                      <img
                        src={membre.photo_url}
                        alt={`${membre.prenom} ${membre.nom}`}
                        className="w-16 h-16 rounded-full object-cover border-4 border-primary/20"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                    )}
                  </div>
                ) : null
              })()}
              <div className="flex-1">
                <h2 className="text-xl font-semibold">Enregistrer un paiement</h2>
                {paymentPretId && (() => {
                  const pretRecord = getPretById(paymentPretId)
                  const membre = membres.find((m) => m.membre_id === pretRecord?.membre_id)
                  return membre ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      {membre.prenom} {membre.nom} ({membre.membre_id})
                    </p>
                  ) : null
                })()}
              </div>
            </div>
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
            {partialLockInfo.active && partialLockInfo.message && (
              <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded text-sm">
                {partialLockInfo.message}
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
                    {prets.length > 0 && (
                      <optgroup label="Prêts individuels">
                        {prets.map((pret) => (
                          <option key={pret.id} value={pret.pret_id}>
                            {pret.pret_id} - {getMemberLabel(pret.membre_id)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {groupPrets.length > 0 && (
                      <optgroup label="Prêts de groupe">
                        {groupPrets.map((pret) => (
                          <option key={pret.id} value={pret.pret_id}>
                            {pret.pret_id} - Groupe {pret.group_id} (Agent: {pret.agent_id})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                {paymentPretType === 'group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Membre du groupe *
                    </label>
                    <select
                      value={paymentMemberId}
                      onChange={(e) => handlePaymentMemberChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!paymentPretId || paymentLoading}
                      required
                    >
                      <option value="">Sélectionner un membre</option>
                      {groupMembersForPayment.map((m) => (
                        <option key={m.membre_id} value={m.membre_id}>
                          {m.membre_id} - {m.prenom} {m.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Échéance à payer *
                  </label>
                  <select
                    value={paymentForm.remboursementId}
                    onChange={(e) => handlePaymentRemboursementChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!paymentPretId || (paymentPretType === 'group' && !paymentMemberId) || paymentLoading}
                    required
                  >
                    <option value="">Sélectionner une échéance</option>
                    {paymentPretType === 'group' ? (
                      // Afficher les remboursements de groupe
                      paymentGroupRemboursements.map((r) => {
                        const amounts = computeScheduledAmountsGroup(r)
                        const alreadyPaid =
                          r.statut === 'paye_partiel' ? Math.max(Number(r.montant || 0), 0) : 0
                        return (
                          <option
                            key={r.id}
                            value={r.id}
                            disabled={partialLockInfo.active && r.statut !== 'paye_partiel'}
                          >
                            #{r.numero_remboursement} · {formatDate(r.date_remboursement)} ·{' '}
                            {getStatutLabel(r.statut, r.date_remboursement)} (
                            {formatCurrency(amounts.remainingTotal + alreadyPaid)})
                          </option>
                        )
                      })
                    ) : (
                      // Afficher les remboursements individuels
                      paymentRemboursements.map((r) => {
                        const amounts = computeScheduledAmounts(r)
                        const alreadyPaid =
                          r.statut === 'paye_partiel' ? Math.max(Number(r.montant || 0), 0) : 0
                        return (
                          <option
                            key={r.id}
                            value={r.id}
                            disabled={partialLockInfo.active && r.statut !== 'paye_partiel'}
                          >
                            #{r.numero_remboursement} · {formatDate(r.date_remboursement)} ·{' '}
                            {getStatutLabel(r.statut, r.date_remboursement)} (
                            {formatCurrency(amounts.remainingTotal + alreadyPaid)})
                          </option>
                        )
                      })
                    )}
                  </select>
                  {!paymentLoading && paymentPretId && 
                   ((paymentPretType === 'group' && paymentGroupRemboursements.length === 0) ||
                    (paymentPretType === 'individual' && paymentRemboursements.length === 0)) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {paymentPretType === 'group' && !paymentMemberId
                        ? 'Veuillez sélectionner un membre pour voir les échéances.'
                        : 'Aucune échéance en attente pour ce prêt.'}
                    </p>
                  )}
                </div>
                {paymentPretId && (
                  <div className="md:col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-900">
                    {paymentPretType === 'group' ? (
                      <>
                        <p className="font-semibold">
                          Membre : {paymentMemberId ? getMemberName(paymentMemberId) : 'Sélectionner un membre'}
                        </p>
                        <p>
                          Prêt de groupe : {paymentPretId}{' '}
                          {groupPrets.find((gp) => gp.pret_id === paymentPretId)?.montant_pret
                            ? ` • Montant total du groupe : ${formatCurrency(
                                Number(groupPrets.find((gp) => gp.pret_id === paymentPretId)?.montant_pret || 0),
                              )}`
                            : ''}
                        </p>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                    {paymentForm.remboursementId && (
                      paymentPretType === 'group' ? (
                        (() => {
                          const selectedGroupRemboursement = paymentGroupRemboursements.find(
                            (r) => r.id.toString() === paymentForm.remboursementId
                          )
                          if (!selectedGroupRemboursement) return null
                          const amounts = computeScheduledAmountsGroup(selectedGroupRemboursement)
                          const alreadyPaid = selectedGroupRemboursement.statut === 'paye_partiel'
                            ? Math.max(Number(selectedGroupRemboursement.montant || 0), 0)
                            : 0
                          return (
                            <p className="space-y-1">
                              <span className="block">
                                Échéance sélectionnée : #{selectedGroupRemboursement.numero_remboursement} • Montant
                                prévu : {formatCurrency(amounts.scheduledTotal)}
                              </span>
                              <span className="block">
                                Déjà payé : {formatCurrency(alreadyPaid)} • Solde restant :{' '}
                                {formatCurrency(paymentInterestDue + paymentPrincipalDue)}
                              </span>
                              <span className="block">
                                Intérêt restant : {formatCurrency(paymentInterestDue)} • Principal restant
                                : {formatCurrency(paymentPrincipalDue)}
                              </span>
                            </p>
                          )
                        })()
                      ) : (
                        selectedPayment && selectedPaymentAmounts && (
                          <p className="space-y-1">
                            <span className="block">
                              Échéance sélectionnée : #{selectedPayment.numero_remboursement} • Montant
                              prévu : {formatCurrency(selectedPaymentAmounts.scheduledTotal)}
                            </span>
                            <span className="block">
                              Déjà payé : {formatCurrency(selectedAlreadyPaid)} • Solde restant :{' '}
                              {formatCurrency(paymentInterestDue + paymentPrincipalDue)}
                            </span>
                            <span className="block">
                              Intérêt restant : {formatCurrency(paymentInterestDue)} • Principal restant
                              : {formatCurrency(paymentPrincipalDue)}
                              {getPretById(paymentPretId)?.membre_id &&
                              memberPaidSummary[getPretById(paymentPretId)?.membre_id ?? '']
                                ? ` • Principal déjà remboursé (tout prêt) : ${formatCurrency(
                                    memberPaidSummary[
                                      getPretById(paymentPretId)?.membre_id ?? ''
                                    ] ?? 0,
                                  )}`
                                : ''}
                            </span>
                          </p>
                        )
                      )
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Payés</div>
            <div className="text-2xl font-bold text-green-600">{stats.payes}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600">Payés partiels</div>
            <div className="text-2xl font-bold text-blue-600">{stats.payesPartiels}</div>
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
                {prets.length > 0 && (
                  <optgroup label="Prêts individuels">
                    {prets.map((pret) => (
                      <option key={pret.id} value={pret.pret_id}>
                        {pret.pret_id} - {pret.membre_id}
                      </option>
                    ))}
                  </optgroup>
                )}
                {groupPrets.length > 0 && (
                  <optgroup label="Prêts de groupe">
                    {groupPrets.map((pret) => (
                      <option key={pret.id} value={pret.pret_id}>
                        {pret.pret_id} - Groupe {pret.group_id}
                      </option>
                    ))}
                  </optgroup>
                )}
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
                <option value="paye_partiel">Payé partiel</option>
                <option value="en_retard">En retard</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table des remboursements */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
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
                    Montant payé
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal appliqué
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Intérêt appliqué
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Intérêt restant
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
                {displayedRemboursements.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                      {loading ? 'Chargement...' : 'Aucun remboursement trouvé'}
                    </td>
                  </tr>
                ) : (
                  displayedRemboursements.map((remboursement) => {
                    const montantPrevu = Number(remboursement.montant || 0)
                    const principalApplique = Number(remboursement.principal || 0)
                    const interetApplique = Number(remboursement.interet || 0)
                    const interetRestant = Math.max(montantPrevu - principalApplique - interetApplique, 0)
                    const isPartial = remboursement.statut === 'paye_partiel' || interetRestant > 0
                    
                    // Pour les remboursements individuels, utiliser getPretById
                    // Pour les remboursements de groupe, utiliser groupPrets
                    const pretRecord = remboursement.type === 'group'
                      ? groupPrets.find((gp) => gp.pret_id === remboursement.pret_id)
                      : getPretById(remboursement.pret_id)
                    
                    const totalInstallments = pretRecord?.nombre_remboursements ?? 0
                    const isGroupLoan = remboursement.type === 'group'
                    
                    return (
                      <tr key={`${remboursement.type}-${remboursement.id}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {remboursement.pret_id}
                          {isGroupLoan && (
                            <span className="ml-2 text-xs text-blue-600">(Groupe)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {remboursement.membre_id}
                          {isGroupLoan && (
                            <span className="ml-1 text-xs text-gray-400">
                              ({getMemberName(remboursement.membre_id)})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {remboursement.numero_remboursement}{totalInstallments > 0 ? `/${totalInstallments}` : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(remboursement.montant)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(principalApplique)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(interetApplique)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(interetRestant)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(remboursement.date_remboursement)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {remboursement.date_paiement ? formatDate(remboursement.date_paiement) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatutColor(
                              remboursement.statut,
                              remboursement.date_remboursement
                            )}`}
                          >
                            {getStatutLabel(remboursement.statut, remboursement.date_remboursement)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && remboursement.type === 'individual' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditRemboursement(remboursement as Remboursement)}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteRemboursement(remboursement as Remboursement)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                          {remboursement.type === 'group' && (
                            <span className="text-xs text-gray-400">Groupe</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function RemboursementsPage() {
  return (
    <ProtectedRoute requiredPermission="canProcessRemboursements">
      <RemboursementsPageContent />
    </ProtectedRoute>
  )
}

