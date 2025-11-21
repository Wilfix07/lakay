'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase, type Membre, type Agent, type UserProfile, type Pret, type Remboursement, type GroupPret, type EpargneTransaction } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, X, Loader2, User, Users, CheckCircle2, Clock, TrendingUp, TrendingDown, DollarSign, UserPlus, Calendar, Wallet, PiggyBank, CreditCard, Download, FileText, Eye, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PhotoUpload } from '@/components/PhotoUpload'

type MemberLoanHistory = {
  pret_id: string
  montant_pret: number
  capital_restant: number | null
  date_decaissement: string
  statut: string
  nombre_remboursements?: number
  remboursements: {
    id: number
    numero_remboursement: number
    montant: number
    principal: number
    interet: number
    statut: string
    date_remboursement: string
    date_paiement: string | null
    jours_retard: number
  }[]
}

type MembreGroup = {
  id: number
  group_name: string
  agent_id: string
  description: string | null
  created_at: string
  member_count?: number
  members?: Membre[]
}

function MembresPageContent() {
  const [membres, setMembres] = useState<Membre[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferMember, setTransferMember] = useState<Membre | null>(null)
  const [transferAgentId, setTransferAgentId] = useState<string>('')
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [memberLoans, setMemberLoans] = useState<MemberLoanHistory[]>([])
  const [selectedMember, setSelectedMember] = useState<Membre | null>(null)
  const [selectedLoanId, setSelectedLoanId] = useState<string>('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [formData, setFormData] = useState({
    agent_id: '',
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
    photo_url: null as string | null,
  })
  const [groups, setGroups] = useState<MembreGroup[]>([])
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<MembreGroup | null>(null)
  const [groupFormData, setGroupFormData] = useState({
    group_name: '',
    description: '',
    selectedMembers: [] as string[],
  })
  const [groupSubmitting, setGroupSubmitting] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<MembreGroup | null>(null)
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false)
  const [transferMemberDialogOpen, setTransferMemberDialogOpen] = useState(false)
  const [memberToTransfer, setMemberToTransfer] = useState<Membre | null>(null)
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [transferMemberSaving, setTransferMemberSaving] = useState(false)
  const [transferMemberError, setTransferMemberError] = useState<string | null>(null)
  const [membersInGroups, setMembersInGroups] = useState<Set<string>>(new Set())
  const [memberGroupNames, setMemberGroupNames] = useState<Map<string, string>>(new Map())
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedMembreForDetails, setSelectedMembreForDetails] = useState<Membre | null>(null)
  const [epargneTransactions, setEpargneTransactions] = useState<EpargneTransaction[]>([])
  const [memberGroupInfo, setMemberGroupInfo] = useState<{ group_name: string; group_id: number } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [membresDetails, setMembresDetails] = useState<Record<string, {
    garantie: number
    epargne: number
    pretActif: number
    echeancier: Remboursement[]
    collateralPretActif: number
    pretActifId: string | null
    pretActifStatut: string | null
    dateDecaissement?: string
    dateFin?: string
    duree?: number
    dateApprobation?: string
    dureeMois?: number
    cycleCredit?: number // Nombre de crédits déjà pris par ce client
  }>>({})
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [chefsZone, setChefsZone] = useState<UserProfile[]>([])
  const [memberChefZoneMap, setMemberChefZoneMap] = useState<Map<string, string>>(new Map()) // membre_id -> chef_zone_id

  const currentLoan =
    memberLoans.find((loan) => loan.pret_id === selectedLoanId) ?? memberLoans[0] ?? null

  const selectedAgent = useMemo(() => {
    if (!selectedMember) return null
    return agents.find((agent) => agent.agent_id === selectedMember.agent_id) ?? null
  }, [agents, selectedMember])

  function computeCapitalRestant(loan: MemberLoanHistory): number {
    if (loan.capital_restant !== null && loan.capital_restant !== undefined) {
      return Number(loan.capital_restant)
    }
    const principalPaid = loan.remboursements
      .filter((r) => r.statut === 'paye' || r.statut === 'paye_partiel')
      .reduce((sum, r) => sum + Number(r.principal || 0), 0)
    return Math.max(loan.montant_pret - principalPaid, 0)
  }

  const filteredMembres = useMemo(() => {
    if (!activeSearch) {
      return membres
    }

    const searchTerm = activeSearch.toLowerCase().trim()
    
    return membres.filter((membre) => {
      // Recherche par nom du membre (nom + prénom)
      const nomComplet = `${membre.prenom || ''} ${membre.nom || ''}`.toLowerCase().trim()
      if (nomComplet.includes(searchTerm)) {
        return true
      }

      // Recherche par type (individuel ou groupe)
      const isInGroup = membersInGroups.has(membre.membre_id)
      const typeText = isInGroup ? 'groupe' : 'individuel'
      if (typeText.includes(searchTerm)) {
        return true
      }

      // Recherche par téléphone
      const telephone = (membre.telephone || '').toLowerCase()
      if (telephone.includes(searchTerm)) {
        return true
      }

      // Recherche par ID membre
      const membreId = (membre.membre_id || '').toLowerCase()
      if (membreId.includes(searchTerm)) {
        return true
      }

      // Recherche par date de création (format YYYY-MM-DD ou DD/MM/YYYY)
      const dateCreation = new Date(membre.created_at)
      const dateISO = dateCreation.toISOString().split('T')[0]
      const dateFormatted = formatDate(membre.created_at).toLowerCase()
      if (dateISO.includes(searchTerm) || dateFormatted.includes(searchTerm)) {
        return true
      }

      // Recherche par chef de zone
      const membreChefZoneId = memberChefZoneMap.get(membre.membre_id)
      if (membreChefZoneId) {
        const chefZone = chefsZone.find((cz) => cz.id === membreChefZoneId)
        if (chefZone) {
          const chefZoneName = `${chefZone.prenom || ''} ${chefZone.nom || ''}`.toLowerCase().trim()
          if (chefZoneName.includes(searchTerm)) {
            return true
          }
        }
      }

      return false
    })
  }, [membres, activeSearch, membersInGroups, memberChefZoneMap, chefsZone])

  const memberSummary = useMemo(() => {
    if (!selectedMember) {
      return {
        totalLoans: 0,
        activeLoans: 0,
        outstandingPrincipal: 0,
        lateInstallments: 0,
        totalLateDays: 0,
      }
    }
    if (memberLoans.length === 0) {
      return {
        totalLoans: 0,
        activeLoans: 0,
        outstandingPrincipal: 0,
        lateInstallments: 0,
        totalLateDays: 0,
      }
    }
    return memberLoans.reduce(
      (acc, loan) => {
        const capitalRestant = computeCapitalRestant(loan)
        const lateInstallments = loan.remboursements.filter(
          (r) =>
            (r.statut === 'en_retard' || r.statut === 'en_attente' || r.statut === 'paye_partiel') &&
            r.jours_retard > 0,
        ).length
        const totalLateDays = loan.remboursements.reduce((sum, r) => {
          if (r.jours_retard > 0 && r.statut !== 'paye') {
            return sum + r.jours_retard
          }
          return sum
        }, 0)
        return {
          totalLoans: acc.totalLoans + 1,
          activeLoans: acc.activeLoans + (loan.statut === 'actif' ? 1 : 0),
          outstandingPrincipal: acc.outstandingPrincipal + capitalRestant,
          lateInstallments: acc.lateInstallments + lateInstallments,
          totalLateDays: acc.totalLateDays + totalLateDays,
        }
      },
      {
        totalLoans: 0,
        activeLoans: 0,
        outstandingPrincipal: 0,
        lateInstallments: 0,
        totalLateDays: 0,
      },
    )
  }, [memberLoans, selectedMember])

  const currentLoanStats = useMemo(() => {
    if (!currentLoan) {
      return {
        principalPaid: 0,
        interestPaid: 0,
        capitalRestant: 0,
        lateInstallments: 0,
        totalLateDays: 0,
        upcomingDueDate: null as string | null,
      }
    }
    const principalPaid = currentLoan.remboursements
      .filter((r) => r.statut === 'paye' || r.statut === 'paye_partiel')
      .reduce((sum, r) => sum + Number(r.principal || 0), 0)
    const interestPaid = currentLoan.remboursements
      .filter((r) => r.statut === 'paye' || r.statut === 'paye_partiel')
      .reduce((sum, r) => sum + Number(r.interet || 0), 0)
    const capitalRestant = computeCapitalRestant(currentLoan)
    const lateInstallments = currentLoan.remboursements.filter(
      (r) =>
        (r.statut === 'en_retard' || r.statut === 'en_attente' || r.statut === 'paye_partiel') &&
        r.jours_retard > 0,
    ).length
    const totalLateDays = currentLoan.remboursements.reduce((sum, r) => {
      if (r.jours_retard > 0 && r.statut !== 'paye') {
        return sum + r.jours_retard
      }
      return sum
    }, 0)
    const upcomingDue = currentLoan.remboursements.find(
      (r) => r.statut === 'en_attente' || r.statut === 'paye_partiel',
    )
    return {
      principalPaid,
      interestPaid,
      capitalRestant,
      lateInstallments,
      totalLateDays,
      upcomingDueDate: upcomingDue?.date_remboursement ?? null,
    }
  }, [currentLoan])

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadAgents()
      loadMembres()
      loadChefsZone()
      loadChefZoneAssignations()
      if (userProfile?.role === 'agent') {
        loadGroups()
      }
      // Pour les agents, définir automatiquement l'agent_id depuis le profil utilisateur
      // IMPORTANT: Les agents peuvent créer des membres sans autorisation du manager
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
      setLoading(true)
      let query = supabase
        .from('membres')
        .select('*')
        .order('created_at', { ascending: false })

      // Les agents ne voient que leurs propres membres
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Manager voit seulement les membres de ses agents
        // Récupérer d'abord les IDs des agents du manager
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
          setLoading(false)
          return
        }
      }
      // Admin voit tous les membres (pas de filtre)

      const { data, error } = await query

      if (error) throw error
      setMembres(data || [])

      // Charger les informations de groupe pour tous les membres
      if (data && data.length > 0) {
        const membreIds = data.map(m => m.membre_id)
        
        // Récupérer les membres qui sont dans des groupes
        const { data: groupMembersData, error: groupMembersError } = await supabase
          .from('membre_group_members')
          .select('membre_id, group_id, membre_groups!inner(group_name)')
          .in('membre_id', membreIds)

        if (groupMembersError) {
          console.error('Erreur lors du chargement des groupes de membres:', groupMembersError)
        } else if (groupMembersData) {
          // Créer une Map membre_id -> group_name
          const groupNamesMap = new Map<string, string>()
          const membersInGroupsSet = new Set<string>()
          
          groupMembersData.forEach((gm: any) => {
            if (gm.membre_id && gm.membre_groups?.group_name) {
              groupNamesMap.set(gm.membre_id, gm.membre_groups.group_name)
              membersInGroupsSet.add(gm.membre_id)
            }
          })
          
          setMemberGroupNames(groupNamesMap)
          setMembersInGroups(membersInGroupsSet)
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
      alert('Erreur lors du chargement des membres')
    } finally {
      setLoading(false)
    }
  }

  async function loadChefsZone() {
    try {
      let query = supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'chef_zone')
        .order('nom', { ascending: true })

      // Les managers ne voient que les chefs de zone attachés à leurs agents
      if (userProfile?.role === 'manager') {
        // Récupérer les agent_id des agents du manager
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)

        if (agentsError) throw agentsError

        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          // Charger uniquement les chefs de zone attachés aux agents du manager
          query = query.in('agent_id', agentIds)
        } else {
          setChefsZone([])
          return
        }
      }
      // Les admins voient tous les chefs de zone
      // Les agents ne voient pas les chefs de zone (optionnel, selon les besoins)

      const { data, error } = await query

      if (error) throw error
      setChefsZone(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des chefs de zone:', error)
    }
  }

  async function loadChefZoneAssignations() {
    try {
      // Charger toutes les assignations membre-chef_zone
      const { data: assignations, error: assignationsError } = await supabase
        .from('chef_zone_membres')
        .select('membre_id, chef_zone_id')

      if (assignationsError) throw assignationsError

      // Créer une map membre_id -> chef_zone_id
      const map = new Map<string, string>()
      assignations?.forEach((assignation) => {
        map.set(assignation.membre_id, assignation.chef_zone_id)
      })

      setMemberChefZoneMap(map)
    } catch (error) {
      console.error('Erreur lors du chargement des assignations chef de zone:', error)
    }
  }

  async function loadGroups() {
    try {
      if (!userProfile?.agent_id) return

      const { data: groupsData, error: groupsError } = await supabase
        .from('membre_groups')
        .select('*')
        .eq('agent_id', userProfile.agent_id)
        .order('created_at', { ascending: false })

      if (groupsError) throw groupsError

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

      // Charger tous les membres qui sont déjà dans des groupes
      const { data: allGroupMembers, error: allMembersError } = await supabase
        .from('membre_group_members')
        .select('membre_id')
        .in('group_id', groupsWithCounts.map(g => g.id))

      if (allMembersError) throw allMembersError

      const membersInGroupsSet = new Set<string>()
      if (allGroupMembers) {
        allGroupMembers.forEach(m => {
          if (m.membre_id) {
            membersInGroupsSet.add(m.membre_id)
          }
        })
      }
      setMembersInGroups(membersInGroupsSet)
    } catch (error) {
      console.error('Erreur lors du chargement des groupes:', error)
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    
    if (!userProfile?.agent_id) {
      alert('Erreur: Agent ID non trouvé')
      return
    }

    // Valider le nombre de membres (2-10)
    if (groupFormData.selectedMembers.length < 2) {
      alert('Un groupe doit contenir au moins 2 membres')
      return
    }

    if (groupFormData.selectedMembers.length > 10) {
      alert('Un groupe ne peut pas contenir plus de 10 membres')
      return
    }

    if (!groupFormData.group_name.trim()) {
      alert('Veuillez saisir un nom pour le groupe')
      return
    }

    setGroupSubmitting(true)
    try {
      // Si on est en mode édition
      if (editingGroup) {
        // Obtenir d'abord les membres actuels du groupe depuis la base de données
        const { data: currentMembers, error: currentError } = await supabase
          .from('membre_group_members')
          .select('membre_id')
          .eq('group_id', editingGroup.id)

        if (currentError) throw currentError

        const currentMemberIds = currentMembers?.map(m => m.membre_id) || []
        
        // Vérifier que les nouveaux membres sélectionnés ne sont pas déjà dans un autre groupe
        // (sauf le groupe actuel)
        const newMembers = groupFormData.selectedMembers.filter(
          id => !currentMemberIds.includes(id)
        )

        if (newMembers.length > 0) {
          const { data: existingMemberships, error: checkError } = await supabase
            .from('membre_group_members')
            .select('membre_id, group_id')
            .in('membre_id', newMembers)
            .neq('group_id', editingGroup.id)

          if (checkError) throw checkError

          if (existingMemberships && existingMemberships.length > 0) {
            // Récupérer les noms des groupes
            const groupIds = [...new Set(existingMemberships.map((m: any) => m.group_id))]
            const { data: groupsData, error: groupsError } = await supabase
              .from('membre_groups')
              .select('id, group_name')
              .in('id', groupIds)

            if (groupsError) throw groupsError

            const groupMap = new Map((groupsData || []).map(g => [g.id, g.group_name]))
            const membersInGroups = existingMemberships.map((m: any) => {
              const membre = membres.find(mem => mem.membre_id === m.membre_id)
              const groupName = groupMap.get(m.group_id) || 'Groupe inconnu'
              return `${membre?.prenom} ${membre?.nom} (${m.membre_id}) - déjà dans le groupe "${groupName}"`
            }).join('\n')
            
            alert(`Les membres suivants sont déjà dans un autre groupe :\n\n${membersInGroups}\n\nUn membre ne peut être que dans un seul groupe à la fois.`)
            setGroupSubmitting(false)
            return
          }
        }

        // Mettre à jour le groupe
        const { error: groupError } = await supabase
          .from('membre_groups')
          .update({
            group_name: groupFormData.group_name.trim(),
            description: groupFormData.description.trim() || null,
          })
          .eq('id', editingGroup.id)

        if (groupError) throw groupError

        // Utiliser les membres actuels déjà chargés
        const selectedMemberIds = groupFormData.selectedMembers

        // Membres à ajouter
        const membersToAdd = selectedMemberIds.filter(id => !currentMemberIds.includes(id))
        // Membres à supprimer
        const membersToRemove = currentMemberIds.filter(id => !selectedMemberIds.includes(id))

        // Ajouter les nouveaux membres
        if (membersToAdd.length > 0) {
          const groupMembers = membersToAdd.map(membre_id => ({
            group_id: editingGroup.id,
            membre_id,
          }))

          const { error: addError } = await supabase
            .from('membre_group_members')
            .insert(groupMembers)

          if (addError) throw addError
        }

        // Supprimer les membres retirés
        if (membersToRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('membre_group_members')
            .delete()
            .eq('group_id', editingGroup.id)
            .in('membre_id', membersToRemove)

          if (removeError) throw removeError
        }
      } else {
        // Mode création
        // Vérifier que les membres sélectionnés ne sont pas déjà dans un autre groupe
        const { data: existingMemberships, error: checkError } = await supabase
          .from('membre_group_members')
          .select('membre_id, group_id')
          .in('membre_id', groupFormData.selectedMembers)

        if (checkError) throw checkError

        if (existingMemberships && existingMemberships.length > 0) {
          // Récupérer les noms des groupes
          const groupIds = [...new Set(existingMemberships.map((m: any) => m.group_id))]
          const { data: groupsData, error: groupsError } = await supabase
            .from('membre_groups')
            .select('id, group_name')
            .in('id', groupIds)

          if (groupsError) throw groupsError

          const groupMap = new Map((groupsData || []).map(g => [g.id, g.group_name]))
          const membersInGroups = existingMemberships.map((m: any) => {
            const membre = membres.find(mem => mem.membre_id === m.membre_id)
            const groupName = groupMap.get(m.group_id) || 'Groupe inconnu'
            return `${membre?.prenom} ${membre?.nom} (${m.membre_id}) - déjà dans le groupe "${groupName}"`
          }).join('\n')
          
          alert(`Les membres suivants sont déjà dans un autre groupe :\n\n${membersInGroups}\n\nUn membre ne peut être que dans un seul groupe à la fois.`)
          setGroupSubmitting(false)
          return
        }

        // Créer le groupe
        const { data: newGroup, error: groupError } = await supabase
          .from('membre_groups')
          .insert([{
            group_name: groupFormData.group_name.trim(),
            agent_id: userProfile.agent_id,
            description: groupFormData.description.trim() || null,
          }])
          .select()
          .single()

        if (groupError) throw groupError

        // Ajouter les membres au groupe
        const groupMembers = groupFormData.selectedMembers.map(membre_id => ({
          group_id: newGroup.id,
          membre_id,
        }))

        const { error: membersError } = await supabase
          .from('membre_group_members')
          .insert(groupMembers)

        if (membersError) throw membersError
      }

      alert(editingGroup ? 'Groupe modifié avec succès!' : 'Groupe créé avec succès!')
      setShowGroupForm(false)
      setEditingGroup(null)
      setGroupFormData({
        group_name: '',
        description: '',
        selectedMembers: [],
      })
      loadGroups()
      loadMembres() // Recharger les membres pour mettre à jour les informations de groupe
    } catch (error: any) {
      console.error('Erreur lors de la création du groupe:', error)
      alert('Erreur: ' + (error.message || 'Erreur inconnue'))
    } finally {
      setGroupSubmitting(false)
    }
  }

  async function handleEditGroup(group: MembreGroup) {
    try {
      // Charger les membres actuels du groupe
      const { data: membersData, error } = await supabase
        .from('membre_group_members')
        .select('membre_id')
        .eq('group_id', group.id)

      if (error) throw error

      const memberIds = membersData?.map(m => m.membre_id) || []

      setEditingGroup(group)
      setGroupFormData({
        group_name: group.group_name,
        description: group.description || '',
        selectedMembers: memberIds,
      })
      setShowGroupForm(true)
    } catch (error) {
      console.error('Erreur lors du chargement du groupe:', error)
      alert('Erreur lors du chargement du groupe')
    }
  }

  async function handleViewGroupDetails(group: MembreGroup) {
    try {
      const { data: membersData, error } = await supabase
        .from('membre_group_members')
        .select('membre_id')
        .eq('group_id', group.id)

      if (error) throw error

      const memberIds = membersData?.map(m => m.membre_id) || []
      const groupMembers = membres.filter(m => memberIds.includes(m.membre_id))

      setSelectedGroup({
        ...group,
        members: groupMembers,
        member_count: groupMembers.length,
      })
      setGroupDetailsOpen(true)
    } catch (error) {
      console.error('Erreur lors du chargement des détails du groupe:', error)
      alert('Erreur lors du chargement des détails du groupe')
    }
  }

  async function handleTransferMemberToGroup(membre: Membre) {
    setMemberToTransfer(membre)
    setTargetGroupId('')
    setTransferMemberError(null)
    setTransferMemberDialogOpen(true)
  }

  async function handleTransferMemberSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!memberToTransfer || !targetGroupId) {
      setTransferMemberError('Veuillez sélectionner un groupe de destination')
      return
    }

    if (!selectedGroup) {
      setTransferMemberError('Erreur: Groupe source non trouvé')
      return
    }

    if (parseInt(targetGroupId) === selectedGroup.id) {
      setTransferMemberError('Le membre est déjà dans ce groupe')
      return
    }

    setTransferMemberSaving(true)
    setTransferMemberError(null)

    try {
      // Vérifier que le membre n'a pas de prêt actif
      const { data: activeLoans, error: loansError } = await supabase
        .from('prets')
        .select('pret_id')
        .eq('membre_id', memberToTransfer.membre_id)
        .in('statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])
        .limit(1)

      if (loansError) throw loansError

      if (activeLoans && activeLoans.length > 0) {
        setTransferMemberError('Ce membre a un prêt actif. Il ne peut pas être transféré vers un autre groupe tant que le prêt n\'est pas terminé.')
        setTransferMemberSaving(false)
        return
      }

      // Vérifier aussi les prêts de groupe actifs
      const { data: activeGroupLoans, error: groupLoansError } = await supabase
        .from('group_remboursements')
        .select('pret_id, group_prets!inner(statut)')
        .eq('membre_id', memberToTransfer.membre_id)
        .in('group_prets.statut', ['actif', 'en_attente_garantie', 'en_attente_approbation'])
        .limit(1)

      if (groupLoansError) throw groupLoansError

      if (activeGroupLoans && activeGroupLoans.length > 0) {
        setTransferMemberError('Ce membre a un prêt de groupe actif. Il ne peut pas être transféré vers un autre groupe tant que le prêt n\'est pas terminé.')
        setTransferMemberSaving(false)
        return
      }

      // Supprimer le membre de l'ancien groupe
      const { error: deleteError } = await supabase
        .from('membre_group_members')
        .delete()
        .eq('membre_id', memberToTransfer.membre_id)
        .eq('group_id', selectedGroup.id)

      if (deleteError) throw deleteError

      // Ajouter le membre au nouveau groupe
      const { error: insertError } = await supabase
        .from('membre_group_members')
        .insert([{
          group_id: parseInt(targetGroupId),
          membre_id: memberToTransfer.membre_id,
        }])

      if (insertError) throw insertError

      alert('Membre transféré avec succès vers le nouveau groupe!')
      setTransferMemberDialogOpen(false)
      setMemberToTransfer(null)
      setTargetGroupId('')
      
      // Recharger les groupes et les détails du groupe
      loadGroups()
      loadMembres() // Recharger les membres pour mettre à jour les informations de groupe
      if (selectedGroup) {
        handleViewGroupDetails(selectedGroup)
      }
    } catch (error: any) {
      console.error('Erreur lors du transfert du membre:', error)
      setTransferMemberError(error.message || 'Une erreur est survenue lors du transfert')
    } finally {
      setTransferMemberSaving(false)
    }
  }

  async function loadMemberHistory(membre: Membre) {
    try {
      setHistoryLoading(true)
      setMemberLoans([])
      setSelectedLoanId('')
      setSelectedMember(membre)
      const { data: pretsData, error: pretsError } = await supabase
        .from('prets')
        .select('pret_id, montant_pret, capital_restant, date_decaissement, statut, nombre_remboursements, montant_remboursement')
        .eq('membre_id', membre.membre_id)
        .order('date_decaissement', { ascending: false })

      if (pretsError) throw pretsError

      const today = new Date()
      const { data: remboursementsData, error: remboursementsError } = await supabase
        .from('remboursements')
        .select(
          'id, pret_id, numero_remboursement, montant, principal, interet, statut, date_remboursement, date_paiement',
        )
        .eq('membre_id', membre.membre_id)
        .order('date_remboursement', { ascending: true })

      if (remboursementsError) throw remboursementsError

      const remboursementsByPret = new Map<string, MemberLoanHistory['remboursements']>()
      for (const remb of remboursementsData || []) {
        const dueDate = remb.date_remboursement ? new Date(remb.date_remboursement) : null
        const paymentDate = remb.date_paiement ? new Date(remb.date_paiement) : null
        let joursRetard = 0
        if (dueDate) {
          const comparisonDate =
            remb.statut === 'paye' && paymentDate
              ? paymentDate
              : paymentDate ?? today
          const diffMs = comparisonDate.getTime() - dueDate.getTime()
          if (diffMs > 0) {
            joursRetard = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          }
        }

        const list = remboursementsByPret.get(remb.pret_id) ?? []
        list.push({
          id: remb.id,
          numero_remboursement: remb.numero_remboursement,
          montant: Number(remb.montant || 0),
          principal: Number(remb.principal || 0),
          interet: Number(remb.interet || 0),
          statut: remb.statut || 'en_attente',
          date_remboursement: remb.date_remboursement,
          date_paiement: remb.date_paiement,
          jours_retard: joursRetard,
        })
        remboursementsByPret.set(remb.pret_id, list)
      }

      const loans =
        pretsData?.map((pret) => ({
          pret_id: pret.pret_id,
          montant_pret: Number(pret.montant_pret || 0),
          capital_restant: pret.capital_restant !== null && pret.capital_restant !== undefined ? Number(pret.capital_restant) : null,
          date_decaissement: pret.date_decaissement,
          statut: pret.statut || 'actif',
          nombre_remboursements: pret.nombre_remboursements,
          remboursements: remboursementsByPret.get(pret.pret_id) ?? [],
        })) ?? []

      setMemberLoans(loans)
      setSelectedLoanId(loans[0]?.pret_id ?? '')
    } catch (error) {
      console.error('Erreur lors du chargement de l’historique des prêts:', error)
      setMemberLoans([])
    } finally {
      setHistoryLoading(false)
    }
  }

  function handleSelectLoan(pretId: string) {
    setSelectedLoanId(pretId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      // Pour les agents, s'assurer que l'agent_id est automatiquement assigné
      // IMPORTANT: Les agents peuvent créer des membres sans autorisation du manager
      // Le membre est automatiquement assigné à l'agent_id de l'agent connecté
      let finalAgentId = formData.agent_id
      
      if (userProfile?.role === 'agent') {
        // Pour les agents, utiliser directement l'agent_id du profil utilisateur
        // qui devrait être défini lors de la création du compte agent
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
        } else {
          alert('Erreur: Agent de crédit non spécifié. Veuillez sélectionner un agent.')
        }
        setSubmitting(false)
        return
      }

      // Générer le membre_id automatiquement en utilisant la fonction SQL atomique
      // Cela évite les conditions de course (race conditions) lors de créations simultanées
      const { data: membreIdData, error: membreIdError } = await supabase
        .rpc('generate_membre_id')

      if (membreIdError) {
        console.error('Erreur lors de la génération du membre_id:', membreIdError)
        throw membreIdError
      }

      const newMembreId = membreIdData || '0000'

      // Tentative d'insertion avec retry en cas de doublon (condition de course rare)
      let insertError = null
      let retryCount = 0
      const maxRetries = 3
      let currentMembreId = newMembreId

      while (retryCount < maxRetries) {
        const { error } = await supabase
          .from('membres')
          .insert([{
            membre_id: currentMembreId,
            ...formData,
            agent_id: finalAgentId, // Utiliser l'agent_id final (automatique pour les agents)
          }])

        if (!error) {
          insertError = null
          break
        }

        // Si c'est une erreur de doublon, réessayer avec un nouvel ID
        if (error.code === '23505' && error.message.includes('membre_id')) {
          retryCount++
          // Régénérer un nouvel ID
          const { data: retryMembreIdData, error: retryError } = await supabase
            .rpc('generate_membre_id')
          
          if (retryError) {
            insertError = retryError
            break
          }
          
          currentMembreId = retryMembreIdData || currentMembreId
        } else {
          insertError = error
          break
        }
      }

      if (insertError) {
        console.error('Erreur lors de l\'insertion du membre:', insertError)
        throw insertError
      }

      alert('Membre créé avec succès!')
      setShowForm(false)
      // Réinitialiser le formulaire, mais garder l'agent_id pour les agents
      const resetAgentId = userProfile?.role === 'agent' && userProfile.agent_id ? userProfile.agent_id : ''
      setFormData({ agent_id: resetAgentId, nom: '', prenom: '', telephone: '', adresse: '', photo_url: null })
      loadMembres()
      // Recharger les groupes pour les agents
      if (userProfile?.role === 'agent') {
        loadGroups()
      }
    } catch (error: any) {
      console.error('Erreur lors de la création:', error)
      alert('Erreur: ' + (error.message || 'Erreur inconnue'))
    } finally {
      setSubmitting(false)
    }
  }

  function openTransferDialog(member: Membre) {
    setTransferMember(member)
    setTransferAgentId(member.agent_id)
    setTransferError(null)
    setTransferDialogOpen(true)
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
    setSelectedMembreForDetails(membre)
    setShowDetailsModal(true)
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

      // Charger les détails financiers du membre
      await loadMembreDetails(membre.membre_id)
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  async function loadMembreDetails(membreId: string) {
    // Charger les groupes qui contiennent le membre
    const { data: groupMembersData } = await supabase
      .from('membre_group_members')
      .select('group_id, membre_id')
      .eq('membre_id', membreId)

    const groupIds = [...new Set((groupMembersData || []).map(gm => gm.group_id))]

      // Charger les prêts de groupe actifs pour ces groupes
    let groupPretsMap: Partial<GroupPret>[] = []
    if (groupIds.length > 0) {
      const { data: groupPretsData } = await supabase
        .from('group_prets')
        .select('pret_id, montant_pret, capital_restant, group_id, statut, date_decaissement, nombre_remboursements, frequence_remboursement, updated_at')
        .in('group_id', groupIds)
        .eq('statut', 'actif')

      if (groupPretsData) {
        groupPretsMap = groupPretsData.filter(gp => groupIds.includes(gp.group_id))
      }
    }

    // Charger les prêts actifs individuels
    const { data: pretsActifs } = await supabase
      .from('prets')
      .select('pret_id, montant_pret, capital_restant, statut, date_decaissement, nombre_remboursements, frequence_remboursement, updated_at')
      .eq('membre_id', membreId)
      .eq('statut', 'actif')
      .order('date_decaissement', { ascending: false })

    const pretIds = (pretsActifs || []).map(p => p.pret_id)
    
    // Récupérer le premier prêt actif (le plus récent)
    const pretActifCourant = pretsActifs && pretsActifs.length > 0 ? pretsActifs[0] : null
    
    // Charger TOUTES les garanties (collaterals) pour ce membre
    // Inclure les garanties individuelles et de groupe, même si les prêts ne sont plus actifs
    let garantieTotal = 0
    
    // Charger toutes les garanties individuelles du membre (peu importe le statut du prêt)
    const { data: collaterals, error: collateralsError } = await supabase
      .from('collaterals')
      .select('montant_depose, pret_id, group_pret_id')
      .eq('membre_id', membreId)
      .is('group_pret_id', null)

    if (!collateralsError && collaterals) {
      // Calculer la somme des montants déposés pour les garanties individuelles
      garantieTotal = collaterals.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0)
    }

    // Charger toutes les garanties de groupe pour ce membre (peu importe le statut du prêt)
    const { data: groupCollaterals, error: groupCollateralsError } = await supabase
      .from('collaterals')
      .select('montant_depose, group_pret_id')
      .eq('membre_id', membreId)
      .not('group_pret_id', 'is', null)

    if (!groupCollateralsError && groupCollaterals) {
      // Ajouter la somme des montants déposés pour les garanties de groupe
      garantieTotal += groupCollaterals.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0)
    }

    // Charger les épargnes
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
      groupPretsMap.reduce((sum, p) => {
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
        .in('statut', ['en_attente', 'en_retard'])
        .order('date_remboursement', { ascending: true })

      echeancier = remboursements || []
    }

    // Remboursements pour prêts de groupe actifs
    if (groupPretsMap.length > 0) {
      const groupPretIds = groupPretsMap.map(gp => gp.pret_id)
      const { data: groupRemboursements } = await supabase
        .from('group_remboursements')
        .select('*')
        .in('pret_id', groupPretIds)
        .eq('membre_id', membreId)
        .in('statut', ['en_attente', 'en_retard'])
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

    // Calculer le collateral pour le prêt actif actuel
    let collateralPretActif = 0
    let pretActifId: string | null = null
    let pretActifStatut: string | null = null
    let dateDecaissement: string | undefined = undefined
    let dateFin: string | undefined = undefined
    let duree: number | undefined = undefined
    let dateApprobation: string | undefined = undefined
    let dureeMois: number | undefined = undefined
    let cycleCredit: number | undefined = undefined

    if (pretActifCourant) {
      // Charger tous les collaterals pour ce prêt actif
      const { data: collateralsPret, error: collateralError } = await supabase
        .from('collaterals')
        .select('montant_depose')
        .eq('membre_id', membreId)
        .eq('pret_id', pretActifCourant.pret_id)
        .is('group_pret_id', null)

      if (!collateralError && collateralsPret) {
        // Somme de tous les montants déposés pour ce prêt
        collateralPretActif = collateralsPret.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0)
        pretActifId = pretActifCourant.pret_id
        pretActifStatut = pretActifCourant.statut || null
        dateDecaissement = pretActifCourant.date_decaissement
        
        // La date d'approbation est la date de mise à jour quand le statut est 'actif'
        // On utilise updated_at comme approximation de la date d'approbation
        if (pretActifCourant.updated_at && pretActifCourant.statut === 'actif') {
          // Pour les prêts actifs, updated_at représente généralement la date d'approbation
          // (mise à jour lors du passage de 'en_attente_approbation' à 'actif')
          dateApprobation = pretActifCourant.updated_at
        }
        
        // Compter le nombre total de crédits (prêts individuels + prêts de groupe) que ce membre a déjà eus
        // Compter les prêts individuels (actifs ou terminés)
        const { data: pretsIndividuels } = await supabase
          .from('prets')
          .select('pret_id')
          .eq('membre_id', membreId)
          .in('statut', ['actif', 'termine'])
        
        // Compter les prêts de groupe où ce membre fait partie (actifs ou terminés)
        let pretsGroupeCount = 0
        if (groupIds.length > 0) {
          const { data: pretsGroupe } = await supabase
            .from('group_prets')
            .select('pret_id')
            .in('group_id', groupIds)
            .in('statut', ['actif', 'termine'])
          
          pretsGroupeCount = pretsGroupe?.length || 0
        }
        
        // Le cycle de crédit est le nombre total de prêts (individuels + groupe) que ce membre a déjà eus
        cycleCredit = (pretsIndividuels?.length || 0) + pretsGroupeCount
      }
    } else if (groupPretsMap.length > 0) {
      // Si pas de prêt individuel actif, vérifier le prêt de groupe actif
      const groupPretActif = groupPretsMap[0] // Prendre le premier prêt de groupe actif
      const { data: collateralsGroupPret, error: collateralGroupError } = await supabase
        .from('collaterals')
        .select('montant_depose')
        .eq('membre_id', membreId)
        .eq('group_pret_id', groupPretActif.pret_id)

      if (!collateralGroupError && collateralsGroupPret) {
        // Somme de tous les montants déposés pour ce prêt de groupe
        collateralPretActif = collateralsGroupPret.reduce((sum, c) => sum + Number(c.montant_depose || 0), 0)
        pretActifId = groupPretActif.pret_id || null
        pretActifStatut = groupPretActif.statut || null
        dateDecaissement = groupPretActif.date_decaissement
        
        // La date d'approbation est la date de mise à jour quand le statut est 'actif'
        // On utilise updated_at comme approximation de la date d'approbation
        if (groupPretActif.updated_at && groupPretActif.statut === 'actif') {
          // Pour les prêts actifs, updated_at représente généralement la date d'approbation
          dateApprobation = groupPretActif.updated_at
        }
        
        // Compter le nombre total de crédits (prêts individuels + prêts de groupe) que ce membre a déjà eus
        // Compter les prêts individuels (actifs ou terminés)
        const { data: pretsIndividuels } = await supabase
          .from('prets')
          .select('pret_id')
          .eq('membre_id', membreId)
          .in('statut', ['actif', 'termine'])
        
        // Compter les prêts de groupe où ce membre fait partie (actifs ou terminés)
        let pretsGroupeCount = 0
        if (groupIds.length > 0) {
          const { data: pretsGroupe } = await supabase
            .from('group_prets')
            .select('pret_id')
            .in('group_id', groupIds)
            .in('statut', ['actif', 'termine'])
          
          pretsGroupeCount = pretsGroupe?.length || 0
        }
        
        // Le cycle de crédit est le nombre total de prêts (individuels + groupe) que ce membre a déjà eus
        cycleCredit = (pretsIndividuels?.length || 0) + pretsGroupeCount
      }
    }

    // Calculer la date de fin et la durée à partir de l'échéancier
    if (echeancier.length > 0 && dateDecaissement) {
      // La date de fin est la date de la dernière échéance
      const lastEcheance = echeancier[echeancier.length - 1]
      dateFin = lastEcheance.date_remboursement
      
      // Calculer la durée en jours
      const dateDecaissementObj = new Date(dateDecaissement)
      const dateFinObj = new Date(dateFin)
      duree = Math.ceil((dateFinObj.getTime() - dateDecaissementObj.getTime()) / (1000 * 60 * 60 * 24))
      
      // Calculer la durée en mois (approximation : 30 jours par mois)
      dureeMois = Math.round((duree / 30) * 10) / 10
    }

    setMembresDetails({
      [membreId]: {
        garantie: garantieTotal,
        epargne: epargneTotal,
        pretActif: pretActifTotal,
        echeancier,
        collateralPretActif,
        pretActifId,
        pretActifStatut,
        dateDecaissement,
        dateFin,
        duree,
        dateApprobation,
        dureeMois,
        cycleCredit,
      }
    })
  }

  async function downloadEcheancier() {
    if (!selectedMembreForDetails) return
    
    const membreId = selectedMembreForDetails.membre_id
    const membreNom = `${selectedMembreForDetails.prenom} ${selectedMembreForDetails.nom}`
    const membreAdresse = selectedMembreForDetails.adresse || 'Non renseignée'
    const echeancier = membresDetails[membreId]?.echeancier || []
    const pretId = membresDetails[membreId]?.pretActifId || 'N/A'
    
    if (echeancier.length === 0) {
      alert('Aucun remboursement dans l\'échéancier à télécharger.')
      return
    }

    // Récupérer le nom de l'agent de crédit
    const agent = agents.find(a => a.agent_id === selectedMembreForDetails.agent_id)
    const agentNom = agent ? `${agent.prenom} ${agent.nom}` : 'Non renseigné'

    // Récupérer les informations du groupe si c'est un membre de groupe
    let groupeNom = ''
    let autresMembres: string[] = []
    
    if (memberGroupInfo) {
      groupeNom = memberGroupInfo.group_name
      
      // Charger les autres membres du groupe
      const { data: groupMembersData } = await supabase
        .from('membre_group_members')
        .select('membre_id, membres(prenom, nom)')
        .eq('group_id', memberGroupInfo.group_id)
      
      if (groupMembersData) {
        autresMembres = groupMembersData
          .filter(gm => gm.membre_id !== membreId)
          .map(gm => {
            const m = gm.membres as any
            return m ? `${m.prenom} ${m.nom}` : ''
          })
          .filter(nom => nom !== '')
      }
    }

    // Créer le contenu CSV
    const headers = ['N°', 'Date prévue', 'Montant', 'Principal', 'Intérêt']
    const rows = echeancier.map((r) => [
      r.numero_remboursement.toString(),
      formatDate(r.date_remboursement),
      formatCurrency(r.montant),
      formatCurrency(r.principal || 0),
      formatCurrency(r.interet || 0)
    ])

    // Calculer les totaux
    const totalMontant = echeancier.reduce((sum, r) => sum + Number(r.montant || 0), 0)
    const totalPrincipal = echeancier.reduce((sum, r) => sum + Number(r.principal || 0), 0)
    const totalInteret = echeancier.reduce((sum, r) => sum + Number(r.interet || 0), 0)

    const csvContent = [
      ['Échéancier du prêt', `Prêt ID: ${pretId}`],
      ['Membre', membreNom],
      ['Membre ID', membreId],
      ['Adresse', membreAdresse],
      ['Agent de crédit', agentNom],
      memberGroupInfo ? ['Type de prêt', 'Prêt de groupe'] : ['Type de prêt', 'Prêt individuel'],
      memberGroupInfo ? ['Nom du groupe', groupeNom] : null,
      autresMembres.length > 0 ? ['Autres membres du groupe', autresMembres.join('; ')] : null,
      membresDetails[membreId]?.dateApprobation ? ['Date d\'approbation', formatDate(membresDetails[membreId]?.dateApprobation || '')] : null,
      membresDetails[membreId]?.dateDecaissement ? ['Date de décaissement', formatDate(membresDetails[membreId]?.dateDecaissement || '')] : null,
      membresDetails[membreId]?.dateFin ? ['Date de fin', formatDate(membresDetails[membreId]?.dateFin || '')] : null,
      membresDetails[membreId]?.duree !== undefined ? ['Durée du prêt', `${membresDetails[membreId]?.duree} jour(s)`] : null,
      membresDetails[membreId]?.dureeMois !== undefined ? ['Durée du prêt (mois)', `${membresDetails[membreId]?.dureeMois} mois`] : null,
      membresDetails[membreId]?.cycleCredit !== undefined ? ['Cycle de crédit', `${membresDetails[membreId]?.cycleCredit} crédit(s)`] : null,
      ['Date génération', formatDate(new Date().toISOString())],
      [],
      headers,
      ...rows,
      [],
      ['TOTAL', '', formatCurrency(totalMontant), formatCurrency(totalPrincipal), formatCurrency(totalInteret)]
    ].filter(row => row !== null).map(row => row!.join(',')).join('\n')

    // Créer le blob et télécharger
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `echeancier_${membreId}_${pretId}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function viewEcheancier() {
    if (!selectedMembreForDetails) return
    
    const membreId = selectedMembreForDetails.membre_id
    const membreNom = `${selectedMembreForDetails.prenom} ${selectedMembreForDetails.nom}`
    const membreAdresse = selectedMembreForDetails.adresse || 'Non renseignée'
    const echeancier = membresDetails[membreId]?.echeancier || []
    const pretId = membresDetails[membreId]?.pretActifId || 'N/A'
    
    if (echeancier.length === 0) {
      alert('Aucun remboursement dans l\'échéancier à afficher.')
      return
    }

    // Récupérer le nom de l'agent de crédit
    const agent = agents.find(a => a.agent_id === selectedMembreForDetails.agent_id)
    const agentNom = agent ? `${agent.prenom} ${agent.nom}` : 'Non renseigné'

    // Récupérer les informations du groupe si c'est un membre de groupe
    let groupeNom = ''
    let autresMembres: string[] = []
    
    if (memberGroupInfo) {
      groupeNom = memberGroupInfo.group_name
      
      // Charger les autres membres du groupe
      const { data: groupMembersData } = await supabase
        .from('membre_group_members')
        .select('membre_id, membres(prenom, nom)')
        .eq('group_id', memberGroupInfo.group_id)
      
      if (groupMembersData) {
        autresMembres = groupMembersData
          .filter(gm => gm.membre_id !== membreId)
          .map(gm => {
            const m = gm.membres as any
            return m ? `${m.prenom} ${m.nom}` : ''
          })
          .filter(nom => nom !== '')
      }
    }

    // Créer le contenu HTML pour l'échéancier
    let htmlContent = `
      <html>
        <head>
          <title>Échéancier - ${membreNom}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            .info-section { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .info-row { margin: 8px 0; }
            .info-label { font-weight: bold; display: inline-block; width: 180px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .total { font-weight: bold; background-color: #e8e8e8; }
            .group-members { margin-top: 10px; }
            .group-members ul { margin: 5px 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <h1>Échéancier du prêt</h1>
          <div class="info-section">
            <div class="info-row"><span class="info-label">Prêt ID:</span> ${pretId}</div>
            <div class="info-row"><span class="info-label">Membre:</span> ${membreNom}</div>
            <div class="info-row"><span class="info-label">Membre ID:</span> ${membreId}</div>
            <div class="info-row"><span class="info-label">Adresse:</span> ${membreAdresse}</div>
            <div class="info-row"><span class="info-label">Agent de crédit:</span> ${agentNom}</div>
            <div class="info-row"><span class="info-label">Type de prêt:</span> ${memberGroupInfo ? 'Prêt de groupe' : 'Prêt individuel'}</div>
            ${memberGroupInfo ? `<div class="info-row"><span class="info-label">Nom du groupe:</span> ${groupeNom}</div>` : ''}
            ${autresMembres.length > 0 ? `
              <div class="info-row group-members">
                <span class="info-label">Autres membres du groupe:</span>
                <ul>
                  ${autresMembres.map(m => `<li>${m}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${membresDetails[membreId]?.dateApprobation ? `<div class="info-row"><span class="info-label">Date d'approbation:</span> ${formatDate(membresDetails[membreId]?.dateApprobation || '')}</div>` : ''}
            ${membresDetails[membreId]?.dateDecaissement ? `<div class="info-row"><span class="info-label">Date de décaissement:</span> ${formatDate(membresDetails[membreId]?.dateDecaissement || '')}</div>` : ''}
            ${membresDetails[membreId]?.dateFin ? `<div class="info-row"><span class="info-label">Date de fin:</span> ${formatDate(membresDetails[membreId]?.dateFin || '')}</div>` : ''}
            ${membresDetails[membreId]?.duree !== undefined ? `<div class="info-row"><span class="info-label">Durée du prêt:</span> ${membresDetails[membreId]?.duree} jour(s)</div>` : ''}
            ${membresDetails[membreId]?.dureeMois !== undefined ? `<div class="info-row"><span class="info-label">Durée du prêt (mois):</span> ${membresDetails[membreId]?.dureeMois} mois</div>` : ''}
            ${membresDetails[membreId]?.cycleCredit !== undefined ? `<div class="info-row"><span class="info-label">Cycle de crédit:</span> ${membresDetails[membreId]?.cycleCredit} crédit(s)</div>` : ''}
            <div class="info-row"><span class="info-label">Date génération:</span> ${formatDate(new Date().toISOString())}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Date prévue</th>
                <th>Montant</th>
                <th>Principal</th>
                <th>Intérêt</th>
              </tr>
            </thead>
            <tbody>
    `

    echeancier.forEach((r) => {
      htmlContent += `
        <tr>
          <td>${r.numero_remboursement}</td>
          <td>${formatDate(r.date_remboursement)}</td>
          <td>${formatCurrency(r.montant)}</td>
          <td>${formatCurrency(r.principal || 0)}</td>
          <td>${formatCurrency(r.interet || 0)}</td>
        </tr>
      `
    })

    // Ajouter les totaux
    const totalMontant = echeancier.reduce((sum, r) => sum + Number(r.montant || 0), 0)
    const totalPrincipal = echeancier.reduce((sum, r) => sum + Number(r.principal || 0), 0)
    const totalInteret = echeancier.reduce((sum, r) => sum + Number(r.interet || 0), 0)
    
    htmlContent += `
            </tbody>
            <tfoot>
              <tr class="total">
                <td colspan="2">TOTAL</td>
                <td>${formatCurrency(totalMontant)}</td>
                <td>${formatCurrency(totalPrincipal)}</td>
                <td>${formatCurrency(totalInteret)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `

    // Ouvrir dans une nouvelle fenêtre
    const newWindow = window.open('', '_blank')
    if (newWindow) {
      newWindow.document.write(htmlContent)
      newWindow.document.close()
    }
  }

  async function handleTransferSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!transferMember || !transferAgentId) {
      setTransferError('Veuillez sélectionner un agent de destination.')
      return
    }

    if (transferAgentId === transferMember.agent_id) {
      setTransferError('Le membre est déjà assigné à cet agent.')
      return
    }

    try {
      setTransferSaving(true)
      setTransferError(null)

      const { error: memberError } = await supabase
        .from('membres')
        .update({ agent_id: transferAgentId })
        .eq('id', transferMember.id)

      if (memberError) throw memberError

      const { error: pretsError } = await supabase
        .from('prets')
        .update({ agent_id: transferAgentId })
        .eq('membre_id', transferMember.membre_id)

      if (pretsError) {
        await supabase
          .from('membres')
          .update({ agent_id: transferMember.agent_id })
          .eq('id', transferMember.id)
        throw new Error(pretsError.message)
      }

      const { error: remboursementsError } = await supabase
        .from('remboursements')
        .update({ agent_id: transferAgentId })
        .eq('membre_id', transferMember.membre_id)

      if (remboursementsError) {
        await supabase
          .from('membres')
          .update({ agent_id: transferMember.agent_id })
          .eq('id', transferMember.id)
        await supabase
          .from('prets')
          .update({ agent_id: transferMember.agent_id })
          .eq('membre_id', transferMember.membre_id)
        throw new Error(remboursementsError.message)
      }

      setTransferDialogOpen(false)
      setTransferMember(null)
      setTransferAgentId('')
      alert('Membre transféré avec succès.')
      loadMembres()
    } catch (error: any) {
      console.error('Erreur lors du transfert du membre:', error)
      setTransferError(error.message ?? 'Une erreur est survenue pendant le transfert.')
    } finally {
      setTransferSaving(false)
    }
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

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Membres</h1>
            <p className="text-muted-foreground mt-2">Créer et gérer les membres</p>
          </div>
          <div className="flex gap-2">
            {userProfile?.role === 'agent' && (
              <Button 
                onClick={() => setShowGroupForm(!showGroupForm)} 
                variant="outline"
                className="gap-2"
              >
                {showGroupForm ? (
                  <>
                    <X className="w-4 h-4" />
                    Annuler
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Nouveau Groupe
                  </>
                )}
              </Button>
            )}
            {userProfile?.role !== 'manager' && (
              <Button onClick={() => setShowForm(!showForm)} className="gap-2">
                {showForm ? (
                  <>
                    <X className="w-4 h-4" />
                    Annuler
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Nouveau Membre
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Form */}
        {showForm && userProfile?.role !== 'manager' && (
          <Card>
            <CardHeader>
              <CardTitle>Créer un nouveau membre</CardTitle>
              <CardDescription>
                {userProfile?.role === 'agent' 
                  ? 'Remplissez les informations pour créer un nouveau membre. Le membre sera automatiquement assigné à votre agent de crédit. Aucune autorisation du manager n\'est requise.'
                  : 'Remplissez les informations pour créer un nouveau membre'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Le champ agent_id est masqué pour les agents car ils ne peuvent créer que pour eux-mêmes */}
                {userProfile?.role !== 'agent' && (
                  <div className="space-y-2">
                    <Label htmlFor="agent_id">Agent de Crédit *</Label>
                    <Select
                      required
                      value={formData.agent_id}
                      onValueChange={(value) => setFormData({ ...formData, agent_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.agent_id}>
                            {agent.agent_id} - {agent.prenom} {agent.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      required
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="Nom du membre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      required
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      placeholder="Prénom du membre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input
                      id="telephone"
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      placeholder="+509 XX XX XX XX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adresse">Adresse</Label>
                    <Input
                      id="adresse"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Adresse du membre"
                    />
                  </div>
                </div>
                
                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Photo du membre (optionnel)</Label>
                  <PhotoUpload
                    currentPhotoUrl={formData.photo_url}
                    onPhotoChange={(photoUrl) => setFormData({ ...formData, photo_url: photoUrl })}
                  />
                </div>
                
                <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Créer le membre'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Group Form - Only for agents */}
        {showGroupForm && userProfile?.role === 'agent' && (
          <Card>
            <CardHeader>
              <CardTitle>{editingGroup ? 'Modifier le groupe' : 'Créer un nouveau groupe'}</CardTitle>
              <CardDescription>
                {editingGroup 
                  ? 'Modifiez le nom, la description ou les membres du groupe'
                  : 'Sélectionnez entre 2 et 10 membres pour créer un groupe'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group_name">Nom du groupe *</Label>
                  <Input
                    id="group_name"
                    required
                    value={groupFormData.group_name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, group_name: e.target.value })}
                    placeholder="Ex: Groupe A, Groupe de quartier X..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group_description">Description (optionnel)</Label>
                  <Input
                    id="group_description"
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    placeholder="Description du groupe..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group_members">
                    {editingGroup 
                      ? 'Modifier les membres du groupe (2-10) *' 
                      : 'Sélectionner les membres (2-10) *'}
                  </Label>
                  {editingGroup && (
                    <p className="text-xs text-muted-foreground mb-2">
                      💡 Vous pouvez retirer des membres (décocher) ou ajouter de nouveaux membres (cocher). 
                      Les membres déjà dans un autre groupe ne peuvent pas être ajoutés.
                    </p>
                  )}
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {membres.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun membre disponible</p>
                    ) : (
                      <div className="space-y-2">
                        {membres.map((membre) => {
                          const isSelected = groupFormData.selectedMembers.includes(membre.membre_id)
                          // Si on est en mode édition, un membre est dans un autre groupe seulement s'il est dans membersInGroups
                          // mais n'est PAS dans les membres actuellement sélectionnés (groupFormData.selectedMembers)
                          // Cela permet de retirer des membres du groupe en cours d'édition
                          const isInOtherGroup = editingGroup 
                            ? membersInGroups.has(membre.membre_id) && !groupFormData.selectedMembers.includes(membre.membre_id)
                            : membersInGroups.has(membre.membre_id)
                          return (
                            <label
                              key={membre.id}
                              className={`flex items-center space-x-2 p-2 rounded ${
                                isInOtherGroup ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isInOtherGroup}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    // Ajouter un membre
                                    if (groupFormData.selectedMembers.length >= 10) {
                                      alert('Un groupe ne peut pas contenir plus de 10 membres')
                                      return
                                    }
                                    setGroupFormData({
                                      ...groupFormData,
                                      selectedMembers: [...groupFormData.selectedMembers, membre.membre_id],
                                    })
                                  } else {
                                    // Retirer un membre
                                    setGroupFormData({
                                      ...groupFormData,
                                      selectedMembers: groupFormData.selectedMembers.filter(
                                        id => id !== membre.membre_id
                                      ),
                                    })
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">
                                {membre.membre_id} - {membre.prenom} {membre.nom}
                                {isInOtherGroup && (
                                  <span className="ml-2 text-xs text-muted-foreground italic">
                                    (déjà dans un autre groupe)
                                  </span>
                                )}
                                {editingGroup && isSelected && (
                                  <span className="ml-2 text-xs text-blue-600 font-medium">
                                    (membre actuel du groupe)
                                  </span>
                                )}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {groupFormData.selectedMembers.length} membre(s) sélectionné(s) (minimum 2, maximum 10)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={groupSubmitting || groupFormData.selectedMembers.length < 2 || groupFormData.selectedMembers.length > 10} 
                    className="w-full md:w-auto"
                  >
                    {groupSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingGroup ? 'Modification...' : 'Création...'}
                      </>
                    ) : (
                      editingGroup ? 'Modifier le groupe' : 'Créer le groupe'
                    )}
                  </Button>
                  {editingGroup && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowGroupForm(false)
                        setEditingGroup(null)
                        setGroupFormData({
                          group_name: '',
                          description: '',
                          selectedMembers: [],
                        })
                      }}
                      disabled={groupSubmitting}
                    >
                      Annuler
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Groups List - Only for agents */}
        {userProfile?.role === 'agent' && groups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Groupes de membres</CardTitle>
              <CardDescription>Total: {groups.length} groupe(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom du groupe</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Nombre de membres</TableHead>
                      <TableHead>Date de création</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.group_name}</TableCell>
                        <TableCell>{group.description || '-'}</TableCell>
                        <TableCell>{group.member_count || 0} membre(s)</TableCell>
                        <TableCell>{formatDate(group.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditGroup(group)}
                            >
                              Modifier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewGroupDetails(group)}
                            >
                              Voir détails
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des membres</CardTitle>
            <CardDescription>Total: {filteredMembres.length} membre(s) sur {membres.length}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filtres */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Recherche</h3>
                {activeSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchInput('')
                      setActiveSearch('')
                    }}
                    className="ml-auto h-7 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Réinitialiser
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Rechercher par nom, type, téléphone, ID membre, date de création ou chef de zone..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        setActiveSearch(searchInput)
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={() => setActiveSearch(searchInput)}
                  className="px-6"
                >
                  Rechercher
                </Button>
              </div>
              {activeSearch && (
                <div className="mt-3 text-sm text-muted-foreground">
                  {filteredMembres.length} membre(s) trouvé(s) sur {membres.length}
                </div>
              )}
            </div>

            {filteredMembres.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>
                  {membres.length === 0
                    ? 'Aucun membre enregistré'
                    : 'Aucun membre ne correspond aux filtres sélectionnés'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Membre</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Date création</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembres.map((membre) => (
                      <TableRow
                        key={membre.id}
                        className={selectedMember?.id === membre.id ? 'bg-muted/50' : ''}
                        onClick={() => loadMemberHistory(membre)}
                      >
                        <TableCell className="font-medium">{membre.membre_id}</TableCell>
                        <TableCell>{membre.agent_id}</TableCell>
                        <TableCell>{membre.nom}</TableCell>
                        <TableCell>{membre.prenom}</TableCell>
                        <TableCell>
                          {membersInGroups.has(membre.membre_id) ? (
                            <Badge variant="secondary" className="gap-1">
                              <Users className="w-3 h-3" />
                              Groupe: {memberGroupNames.get(membre.membre_id) || 'N/A'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <User className="w-3 h-3" />
                              Individuel
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{membre.telephone || '-'}</TableCell>
                        <TableCell>
                          {new Date(membre.created_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewDetails(membre)
                            }}
                          >
                            Voir détails
                          </Button>
                          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openTransferDialog(membre)
                              }}
                            >
                              Transférer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

{selectedMember && (
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {selectedMember.photo_url ? (
                    <img
                      src={selectedMember.photo_url}
                      alt={`${selectedMember.prenom} ${selectedMember.nom}`}
                      className="w-20 h-20 rounded-full object-cover border-4 border-primary/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle>
            Historique des prêts – {selectedMember.prenom} {selectedMember.nom} (
            {selectedMember.membre_id})
                  </CardTitle>
                  <CardDescription>
                    Suivi des décaissements et remboursements effectués par ce membre.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Agent de crédit</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedAgent
                          ? `${selectedAgent.prenom} ${selectedAgent.nom} (${selectedAgent.agent_id})`
                          : selectedMember.agent_id}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Téléphone</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedMember.telephone || 'Non renseigné'}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Adresse</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedMember.adresse || 'Non renseignée'}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Date d’inscription</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(selectedMember.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Prêts totaux</p>
                      <p className="text-lg font-semibold text-foreground">
                        {memberSummary.totalLoans}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {memberSummary.activeLoans} prêt(s) actif(s)
                      </p>
                    </div>
                    <div className="rounded-lg border px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Garantie totale</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatCurrency(membresDetails[selectedMember?.membre_id || '']?.garantie || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total déposé
                      </p>
                    </div>
                    <div className="rounded-lg border px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Capital restant</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatCurrency(memberSummary.outstandingPrincipal)}
                      </p>
                    </div>
                    <div className="rounded-lg border px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Échéances en retard</p>
                      <p className="text-lg font-semibold text-foreground">
                        {memberSummary.lateInstallments}
                      </p>
                    </div>
                    <div className="rounded-lg border px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Jours de retard cumulés</p>
                      <p className="text-lg font-semibold text-foreground">
                        {memberSummary.totalLateDays}
                      </p>
                    </div>
                  </div>

                  {memberLoans.length === 0 ? (
                    <div className="py-8 text-muted-foreground text-center">
                      Aucun prêt n’est enregistré pour ce membre.
                    </div>
                  ) : (
                    <>
                      {memberLoans.length > 1 && (
                        <div className="max-w-xs">
                          <Label>Prêt</Label>
                          <Select value={selectedLoanId} onValueChange={handleSelectLoan}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Sélectionner un prêt" />
                            </SelectTrigger>
                            <SelectContent>
                              {memberLoans.map((loan) => (
                                <SelectItem key={loan.pret_id} value={loan.pret_id}>
                                  {loan.pret_id} — {formatCurrency(loan.montant_pret)} (
                                  {formatDate(loan.date_decaissement)}) •{' '}
                                  {loan.statut === 'actif' ? 'Actif' : 'Terminé'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {currentLoan && (
                        <>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                            <div className="rounded-lg border bg-muted/30 px-4 py-3">
                              <p className="text-xs uppercase text-muted-foreground">Montant du prêt</p>
                              <p className="text-lg font-semibold text-foreground">
                                {formatCurrency(currentLoan.montant_pret)}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 px-4 py-3">
                              <p className="text-xs uppercase text-muted-foreground">Principal remboursé</p>
                              <p className="text-lg font-semibold text-foreground">
                                {formatCurrency(currentLoanStats.principalPaid)}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 px-4 py-3">
                              <p className="text-xs uppercase text-muted-foreground">Intérêts payés</p>
                              <p className="text-lg font-semibold text-foreground">
                                {formatCurrency(currentLoanStats.interestPaid)}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 px-4 py-3">
                              <p className="text-xs uppercase text-muted-foreground">Capital restant</p>
                              <p className="text-lg font-semibold text-foreground">
                                {formatCurrency(currentLoanStats.capitalRestant)}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 px-4 py-3">
                              <p className="text-xs uppercase text-muted-foreground">Retards en cours</p>
                              <p className="text-lg font-semibold text-foreground">
                                {currentLoanStats.lateInstallments}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {currentLoanStats.totalLateDays} jour(s) de retard cumulés
                              </p>
                            </div>
                          </div>

                          {currentLoanStats.upcomingDueDate && (
                            <p className="text-sm text-muted-foreground">
                              Prochaine échéance prévue le{' '}
                              <span className="font-semibold">
                                {formatDate(currentLoanStats.upcomingDueDate)}
                              </span>
                              .
                            </p>
                          )}

                          <div className="rounded-md border overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>#</TableHead>
                                  <TableHead>Montant</TableHead>
                                  <TableHead>Principal</TableHead>
                                  <TableHead>Intérêt</TableHead>
                                  <TableHead>Date prévue</TableHead>
                                  <TableHead>Date payée</TableHead>
                                  <TableHead>Jours de retard</TableHead>
                                  <TableHead>Statut</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {currentLoan.remboursements.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={8}
                                      className="py-6 text-center text-sm text-muted-foreground"
                                    >
                                      Aucun remboursement enregistré pour ce prêt.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  currentLoan.remboursements.map((remboursement) => (
                                    <TableRow key={remboursement.id}>
                                      <TableCell className="whitespace-nowrap text-sm">
                                        {remboursement.numero_remboursement}/
                                        {currentLoan.nombre_remboursements ??
                                          currentLoan.remboursements.length}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {formatCurrency(remboursement.montant)}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {formatCurrency(remboursement.principal)}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {formatCurrency(remboursement.interet)}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {formatDate(remboursement.date_remboursement)}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {remboursement.date_paiement
                                          ? formatDate(remboursement.date_paiement)
                                          : '-'}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm font-medium">
                                        {remboursement.jours_retard > 0
                                          ? `${remboursement.jours_retard} jour(s)`
                                          : '-'}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap">
                                        <span
                                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            remboursement.statut === 'paye'
                                              ? 'bg-green-100 text-green-800'
                                              : remboursement.statut === 'paye_partiel'
                                              ? 'bg-blue-100 text-blue-800'
                                              : remboursement.statut === 'en_retard'
                                              ? 'bg-red-100 text-red-800'
                                              : 'bg-yellow-100 text-yellow-800'
                                          }`}
                                        >
                                          {remboursement.statut === 'paye'
                                            ? 'Payé'
                                            : remboursement.statut === 'paye_partiel'
                                            ? 'Payé partiel'
                                            : remboursement.statut === 'en_retard'
                                            ? 'En retard'
                                            : 'En attente'}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Group Details Dialog */}
      {userProfile?.role === 'agent' && (
        <Dialog open={groupDetailsOpen} onOpenChange={setGroupDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détails du groupe: {selectedGroup?.group_name}</DialogTitle>
              <DialogDescription>
                {selectedGroup?.description || 'Aucune description'}
              </DialogDescription>
            </DialogHeader>
            {selectedGroup && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nombre de membres</p>
                    <p className="text-lg font-semibold">{selectedGroup.member_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date de création</p>
                    <p className="text-lg font-semibold">{formatDate(selectedGroup.created_at)}</p>
                  </div>
                </div>
                {selectedGroup.members && selectedGroup.members.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Membres du groupe</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID Membre</TableHead>
                            <TableHead>Nom</TableHead>
                            <TableHead>Prénom</TableHead>
                            <TableHead>Téléphone</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroup.members.map((membre) => (
                            <TableRow key={membre.id}>
                              <TableCell className="font-medium">{membre.membre_id}</TableCell>
                              <TableCell>{membre.nom}</TableCell>
                              <TableCell>{membre.prenom}</TableCell>
                              <TableCell>{membre.telephone || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleTransferMemberToGroup(membre)}
                                >
                                  Transférer
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Transfer Member to Group Dialog */}
      {userProfile?.role === 'agent' && (
        <Dialog open={transferMemberDialogOpen} onOpenChange={setTransferMemberDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transférer un membre vers un autre groupe</DialogTitle>
              <DialogDescription>
                Sélectionnez le groupe de destination. Le membre ne peut être transféré que s'il n'a pas de prêt actif.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransferMemberSubmit} className="space-y-4">
              <div>
                <Label>Membre</Label>
                <div className="mt-1 rounded-lg border bg-muted/40 p-3 text-sm">
                  {memberToTransfer
                    ? `${memberToTransfer.prenom} ${memberToTransfer.nom} • ${memberToTransfer.membre_id}`
                    : 'Aucun membre sélectionné'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Groupe de destination</Label>
                <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un groupe" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups
                      .filter((group) => group.id !== selectedGroup?.id)
                      .map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.group_name} ({group.member_count || 0} membre(s))
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {transferMemberError && (
                <p className="text-sm text-red-600">{transferMemberError}</p>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTransferMemberDialogOpen(false)
                    setTransferMemberError(null)
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={transferMemberSaving}>
                  {transferMemberSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transfert...
                    </>
                  ) : (
                    'Confirmer le transfert'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transférer le membre</DialogTitle>
              <DialogDescription>
                Sélectionnez l’agent vers lequel transférer ce membre.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <Label>Membre</Label>
                <div className="mt-1 rounded-lg border bg-muted/40 p-3 text-sm">
                  {transferMember
                    ? `${transferMember.prenom} ${transferMember.nom} • ${transferMember.membre_id}`
                    : 'Aucun membre sélectionné'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nouvel agent</Label>
                <Select value={transferAgentId} onValueChange={setTransferAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents
                      .filter((agent) => agent.agent_id !== transferMember?.agent_id)
                      .map((agent) => (
                        <SelectItem key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_id} - {agent.prenom} {agent.nom}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {transferError && (
                <p className="text-sm text-red-600">{transferError}</p>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={transferSaving}>
                  {transferSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transfert...
                    </>
                  ) : (
                    'Confirmer'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de détails */}
      {showDetailsModal && selectedMembreForDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Photo du membre */}
                  {selectedMembreForDetails.photo_url ? (
                    <img
                      src={selectedMembreForDetails.photo_url}
                      alt={`${selectedMembreForDetails.prenom} ${selectedMembreForDetails.nom}`}
                      className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-primary/20">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <CardTitle>
                      Détails - {selectedMembreForDetails.prenom} {selectedMembreForDetails.nom} ({selectedMembreForDetails.membre_id})
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Informations financières complètes du membre
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => {
                  setShowDetailsModal(false)
                  setEpargneTransactions([])
                  setMemberGroupInfo(null)
                  setSelectedMembreForDetails(null)
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
                          {formatCurrency(membresDetails[selectedMembreForDetails.membre_id]?.garantie || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Épargne Totale</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(membresDetails[selectedMembreForDetails.membre_id]?.epargne || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Prêt Actif</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(membresDetails[selectedMembreForDetails.membre_id]?.pretActif || 0)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Collateral pour le prêt actif */}
                  {membresDetails[selectedMembreForDetails.membre_id]?.pretActifId && membresDetails[selectedMembreForDetails.membre_id]?.collateralPretActif !== undefined && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Collateral pour le prêt en cours
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Prêt: {membresDetails[selectedMembreForDetails.membre_id]?.pretActifId}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(membresDetails[selectedMembreForDetails.membre_id]?.collateralPretActif || 0)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Informations sur les remboursements */}
                  {(() => {
                    const echeancier = membresDetails[selectedMembreForDetails.membre_id]?.echeancier || []
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
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Échéancier</h3>
                      {membresDetails[selectedMembreForDetails.membre_id]?.echeancier.length > 0 &&
                       membresDetails[selectedMembreForDetails.membre_id]?.pretActifStatut &&
                       membresDetails[selectedMembreForDetails.membre_id]?.pretActifStatut !== 'en_attente_approbation' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={viewEcheancier}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            Voir
                          </Button>
                        </div>
                      )}
                    </div>
                    {/* Informations du prêt */}
                    {membresDetails[selectedMembreForDetails.membre_id]?.dateDecaissement && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Date de décaissement:</span>
                            <p className="font-medium">{formatDate(membresDetails[selectedMembreForDetails.membre_id]?.dateDecaissement || '')}</p>
                          </div>
                          {membresDetails[selectedMembreForDetails.membre_id]?.dateApprobation && (
                            <div>
                              <span className="text-muted-foreground">Date d'approbation:</span>
                              <p className="font-medium">{formatDate(membresDetails[selectedMembreForDetails.membre_id]?.dateApprobation || '')}</p>
                            </div>
                          )}
                          {membresDetails[selectedMembreForDetails.membre_id]?.dateFin && (
                            <div>
                              <span className="text-muted-foreground">Date de fin:</span>
                              <p className="font-medium">{formatDate(membresDetails[selectedMembreForDetails.membre_id]?.dateFin || '')}</p>
                            </div>
                          )}
                          {membresDetails[selectedMembreForDetails.membre_id]?.duree !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Durée du prêt:</span>
                              <p className="font-medium">{membresDetails[selectedMembreForDetails.membre_id]?.duree} jour(s)</p>
                            </div>
                          )}
                          {membresDetails[selectedMembreForDetails.membre_id]?.dureeMois !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Durée du prêt (mois):</span>
                              <p className="font-medium">{membresDetails[selectedMembreForDetails.membre_id]?.dureeMois} mois</p>
                            </div>
                          )}
                          {membresDetails[selectedMembreForDetails.membre_id]?.cycleCredit !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Cycle de crédit:</span>
                              <p className="font-medium">{membresDetails[selectedMembreForDetails.membre_id]?.cycleCredit} crédit(s)</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {membresDetails[selectedMembreForDetails.membre_id]?.echeancier.length === 0 ? (
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
                          {membresDetails[selectedMembreForDetails.membre_id]?.echeancier.map((remboursement) => {
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
    </DashboardLayout>
  )
}

export default function MembresPage() {
  return (
    <ProtectedRoute>
      <MembresPageContent />
    </ProtectedRoute>
  )
}
