'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/DashboardLayout'
import { supabase, type UserProfile, type Membre, type Pret, type GroupPret, type Collateral } from '@/lib/supabase'
import { getUserProfile, signOut } from '@/lib/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import { calculateCollateralAmount } from '@/lib/systemSettings'
import { Pencil, Trash2, Lock, Unlock, ChevronDown, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

type TransactionType = 'depot' | 'retrait' | 'collateral'

type EpargneTransaction = {
  id: number
  membre_id: string
  agent_id: string
  type: TransactionType
  montant: number
  date_operation: string
  notes: string | null
  created_at: string
  is_blocked?: boolean
  blocked_for_pret_id?: string | null
  blocked_for_group_pret_id?: string | null
}

function EpargnePageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [membres, setMembres] = useState<Membre[]>([])
  const [selectedMembreId, setSelectedMembreId] = useState<string>('')
  const [transactions, setTransactions] = useState<EpargneTransaction[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [previousSoldeDisponible, setPreviousSoldeDisponible] = useState<number>(0)
  const [soldeChanged, setSoldeChanged] = useState(false)
  const [memberSearchOpen, setMemberSearchOpen] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const memberSearchInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<{
    type: TransactionType
    montant: string
    date_operation: string
    notes: string
    collateralPretId: string
    collateralGroupPretId: string
    collateralType: 'individual' | 'group' | ''
  }>({
    type: 'depot',
    montant: '',
    date_operation: new Date().toISOString().split('T')[0],
    notes: '',
    collateralPretId: '',
    collateralGroupPretId: '',
    collateralType: '',
  })

  // États pour charger les prêts
  const [prets, setPrets] = useState<Pret[]>([])
  const [groupPrets, setGroupPrets] = useState<GroupPret[]>([])
  const [loadingPrets, setLoadingPrets] = useState(false)
  
  // États pour charger les collaterals depuis la table collaterals
  const [collaterals, setCollaterals] = useState<Collateral[]>([])

  const solde = useMemo(() => {
    return transactions.reduce((sum, t) => {
      return sum + (t.type === 'depot' ? Number(t.montant || 0) : -Number(t.montant || 0))
    }, 0)
  }, [transactions])

  const soldeBloque = useMemo(() => {
    // Si aucun membre n'est sélectionné, retourner 0
    if (!selectedMembreId) return 0
    
    // Calculer le montant bloqué depuis la table collaterals
    // Les collaterals sont déjà filtrés par membre_id dans loadCollaterals
    
    // Prendre en compte TOUS les collaterals du membre
    // Un collateral peut être bloqué même si le prêt n'est pas encore actif (en attente d'approbation)
    const collateralsDuMembre = collaterals.filter(c => c.membre_id === selectedMembreId)
    
    const montantBloqueTotal = collateralsDuMembre.reduce((sum, c) => {
      const montant = Number(c.montant_depose || 0)
      return sum + (isNaN(montant) ? 0 : montant)
    }, 0)
    
    // Debug: logger pour comprendre le problème
    if (process.env.NODE_ENV === 'development') {
      if (collateralsDuMembre.length > 0) {
        console.log('🔍 Debug soldeBloque:', {
          selectedMembreId,
          totalCollaterals: collaterals.length,
          collateralsDuMembre: collateralsDuMembre.length,
          montantBloqueTotal,
          collateralsDetails: collateralsDuMembre.map(c => ({
            id: c.id,
            membre_id: c.membre_id,
            montant_depose: c.montant_depose,
            pret_id: c.pret_id,
            group_pret_id: c.group_pret_id,
          }))
        })
      }
    }
    
    return montantBloqueTotal
  }, [collaterals, selectedMembreId])

  // montantGarantieActive est identique à soldeBloque
  const montantGarantieActive = soldeBloque

  const soldeDisponible = useMemo(() => {
    // Calculer le solde depuis les transactions (dépôts et retraits uniquement)
    // Les collaterals ne sont plus dans epargne_transactions
    let total = 0
    transactions.forEach((t) => {
      const montant = Number(t.montant || 0)
      if (t.type === 'depot') {
        total += montant
      } else if (t.type === 'retrait') {
        // Les retraits normaux réduisent le total
        total -= montant
      }
    })
    
    // Soustraire le montant bloqué depuis la table collaterals (pour les prêts actifs)
    return Math.max(0, total - soldeBloque)
  }, [transactions, soldeBloque])

  // Détecter les changements du solde disponible pour l'animation
  useEffect(() => {
    if (previousSoldeDisponible !== soldeDisponible && previousSoldeDisponible !== 0) {
      setSoldeChanged(true)
      // Réinitialiser l'animation après 2 secondes
      const timer = setTimeout(() => {
        setSoldeChanged(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
    setPreviousSoldeDisponible(soldeDisponible)
  }, [soldeDisponible, previousSoldeDisponible])

  // Solde disponible pour retrait = solde total - montant de garantie des prêts actifs
  const soldeDisponiblePourRetrait = useMemo(() => {
    return Math.max(0, solde - soldeBloque)
  }, [solde, soldeBloque])

  // Fonction helper pour vérifier si un agent peut modifier/supprimer une transaction
  // Les agents peuvent modifier/supprimer seulement les transactions du jour même
  function canAgentModifyTransaction(transaction: EpargneTransaction): boolean {
    if (userProfile?.role !== 'agent') return true // Les managers et admins peuvent toujours modifier
    const today = new Date().toISOString().split('T')[0]
    return transaction.date_operation === today
  }

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadMembres()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  useEffect(() => {
    if (selectedMembreId) {
      loadTransactions(selectedMembreId)
      loadCollaterals(selectedMembreId)
      loadPretsForMember(selectedMembreId)
    } else {
      setTransactions([])
      setCollaterals([])
      setPrets([])
      setGroupPrets([])
    }
  }, [selectedMembreId])

  // Subscription Supabase Realtime pour rendre la page dynamique
  useEffect(() => {
    if (!userProfile || !selectedMembreId) return

    let transactionsChannel: ReturnType<typeof supabase.channel> | null = null
    let isUnmounting = false

    try {
      // Construire le filtre selon le rôle
      // Note: Les filtres Realtime doivent utiliser le format correct
      const transactionsFilter = `membre_id=eq.${selectedMembreId}`

      // Subscription pour les transactions d'épargne
      transactionsChannel = supabase
        .channel(`epargne-transactions-${selectedMembreId}-${Date.now()}`) // Ajouter timestamp pour éviter les conflits
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'epargne_transactions',
            filter: transactionsFilter,
          },
          (payload) => {
            if (isUnmounting) return // Ignorer les callbacks après le démontage
            if (process.env.NODE_ENV === 'development') {
              console.log('💰 Changement détecté dans epargne_transactions:', payload.eventType)
            }
            // Recharger les transactions pour ce membre de manière asynchrone
            // Utiliser setTimeout pour éviter les problèmes de timing avec les callbacks Realtime
            setTimeout(() => {
              if (!isUnmounting) {
                loadTransactions(selectedMembreId).catch((error) => {
                  // Gérer silencieusement les erreurs de rechargement
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('⚠️ Erreur lors du rechargement des transactions:', error)
                  }
                })
              }
            }, 100)
          }
        )
        .subscribe((status, err) => {
          if (isUnmounting) return // Ignorer les callbacks après le démontage
          
          // Gérer les différents statuts de subscription
          switch (status) {
            case 'SUBSCRIBED':
              setRealtimeConnected(true)
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ Subscription epargne_transactions active')
              }
              break
            case 'CHANNEL_ERROR':
              // Ne pas utiliser console.error - utiliser seulement console.warn en développement
              // L'erreur peut être due à une fermeture de connexion normale ou à un problème réseau temporaire
              if (process.env.NODE_ENV === 'development' && err) {
                console.warn('⚠️ Erreur de subscription epargne_transactions:', err.message || 'Erreur inconnue')
              }
              setRealtimeConnected(false)
              break
            case 'TIMED_OUT':
            case 'CLOSED':
              // Ne pas afficher d'erreur pour les fermetures normales ou timeouts
              // Ces statuts sont normaux et ne nécessitent pas de log
              setRealtimeConnected(false)
              break
            default:
              // Autres statuts (JOINED, etc.) - ne pas afficher d'erreur
              setRealtimeConnected(false)
              break
          }
        })
    } catch (error) {
      // Gérer les erreurs de configuration de la subscription
      console.warn('⚠️ Impossible de configurer la subscription Realtime:', error)
      setRealtimeConnected(false)
    }

    // Nettoyer la subscription au démontage ou changement de membre
    return () => {
      isUnmounting = true
      if (transactionsChannel) {
        try {
          transactionsChannel.unsubscribe()
        } catch (error) {
          // Ignorer silencieusement les erreurs lors du nettoyage
          // Ces erreurs sont normales lors de la fermeture de connexions
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Erreur lors du nettoyage de la subscription:', error)
          }
        }
      }
      setRealtimeConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, selectedMembreId])

  async function loadUserProfile() {
    try {
      const profile = await getUserProfile()
      setUserProfile(profile)
      
      // Si l'utilisateur est un agent, vérifier que son agent_id existe
      if (profile?.role === 'agent' && profile.agent_id) {
        const { data: agentExists, error: agentCheckError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('agent_id', profile.agent_id)
          .maybeSingle()
        
        if (agentCheckError && agentCheckError.code !== 'PGRST116') {
          console.error('⚠️ Erreur lors de la vérification de l\'agent_id:', agentCheckError)
        } else if (!agentExists) {
          console.error('⚠️ L\'agent_id du profil utilisateur n\'existe pas dans la table agents:', profile.agent_id)
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMembres() {
    try {
      setLoading(true)
      let query = supabase
        .from('membres')
        .select('*')
        .order('created_at', { ascending: false })

      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      } else if (userProfile?.role === 'manager') {
        // Charger uniquement les membres des agents du manager
        const { data: managerAgents, error: agentsError } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('manager_id', userProfile.id)
        if (agentsError) throw agentsError
        const agentIds = managerAgents?.map(a => a.agent_id) || []
        if (agentIds.length > 0) {
          query = query.in('agent_id', agentIds)
        } else {
          setMembres([])
          return
        }
      }

      const { data, error } = await query
      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur chargement membres:', error)
      setMembres([])
    } finally {
      setLoading(false)
    }
  }

  async function loadTransactions(membreId: string) {
    try {
      setErrorMessage(null)
      // Charger uniquement les dépôts et retraits (pas les collaterals)
      // Les collaterals sont maintenant uniquement dans la table collaterals
      const { data, error } = await supabase
        .from('epargne_transactions')
        .select('*')
        .eq('membre_id', membreId)
        .or('is_blocked.is.null,is_blocked.eq.false') // Ne charger que les transactions non bloquées (dépôts et retraits normaux)
        .order('date_operation', { ascending: false })

      if (error) {
        // Table manquante -> message d'aide
        // Postgres undefined_table: 42P01
        if ((error as any).code === '42P01') {
          setErrorMessage(
            "La table 'epargne_transactions' n'existe pas encore. Veuillez créer la table côté Supabase pour activer l'épargne."
          )
        } else {
          setErrorMessage('Erreur lors du chargement des opérations.')
        }
        setTransactions([])
        return
      }

      setTransactions((data || []) as EpargneTransaction[])
    } catch (error) {
      console.error('Erreur chargement opérations épargne:', error)
      setErrorMessage('Erreur lors du chargement des opérations.')
      setTransactions([])
    }
  }

  async function loadCollaterals(membreId: string) {
    try {
      // Charger les collaterals depuis la table collaterals
      const { data, error } = await supabase
        .from('collaterals')
        .select('*')
        .eq('membre_id', membreId)
        .order('created_at', { ascending: false })

      if (error && (error as any).code !== '42P01' && (error as any).code !== 'PGRST116') {
        console.error('Erreur chargement collaterals:', error)
      }

      setCollaterals((data || []) as Collateral[])
    } catch (error) {
      console.error('Erreur chargement collaterals:', error)
      setCollaterals([])
    }
  }

  async function loadPretsForMember(membreId: string) {
    setLoadingPrets(true)
    try {
      // Charger les prêts individuels en attente ou actifs
      const { data: pretsData, error: pretsError } = await supabase
        .from('prets')
        .select('pret_id, montant_pret, statut')
        .eq('membre_id', membreId)
        .in('statut', ['en_attente_garantie', 'en_attente_approbation', 'actif'])
        .order('created_at', { ascending: false })

      if (pretsError && pretsError.code !== '42P01' && pretsError.code !== 'PGRST116') {
        console.error('Erreur chargement prêts:', pretsError)
      }

      setPrets((pretsData || []) as Pret[])

      // Charger les prêts de groupe
      try {
        // Récupérer les groupes du membre
        const { data: groupMembers, error: groupMembersError } = await supabase
          .from('membre_group_members')
          .select('group_id')
          .eq('membre_id', membreId)

        if (groupMembersError && groupMembersError.code !== '42P01' && groupMembersError.code !== 'PGRST116') {
          throw groupMembersError
        }

        if (groupMembers && groupMembers.length > 0) {
          const groupIds = groupMembers.map(gm => gm.group_id)
          const { data: groupPretsData, error: groupPretsError } = await supabase
            .from('group_prets')
            .select('pret_id, montant_pret, statut, group_id')
            .in('group_id', groupIds)
            .in('statut', ['en_attente_garantie', 'en_attente_approbation', 'actif'])
            .order('created_at', { ascending: false })

          if (groupPretsError && groupPretsError.code !== '42P01' && groupPretsError.code !== 'PGRST116') {
            console.error('Erreur chargement prêts de groupe:', groupPretsError)
          }

          setGroupPrets((groupPretsData || []) as GroupPret[])
        } else {
          setGroupPrets([])
        }
      } catch (error: any) {
        if (error?.code !== '42P01' && error?.code !== 'PGRST116') {
          console.error('Erreur chargement groupes:', error)
        }
        setGroupPrets([])
      }
    } catch (error) {
      console.error('Erreur chargement prêts:', error)
    } finally {
      setLoadingPrets(false)
    }
  }

  const [editingTransaction, setEditingTransaction] = useState<EpargneTransaction | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMembreId) {
      alert('Veuillez sélectionner un membre.')
      return
    }
    const montant = parseFloat(formData.montant)
    if (!(montant > 0)) {
      alert('Veuillez saisir un montant positif.')
      return
    }
    // Validation pour les retraits: empêcher le retrait du montant de garantie des prêts actifs
    if (formData.type === 'retrait') {
      // Vérifier que le montant ne dépasse pas le solde disponible pour retrait
      // (qui exclut le montant de garantie des prêts actifs)
      if (montant > soldeDisponiblePourRetrait) {
        const montantGarantie = montantGarantieActive
        const soldeTotal = solde
        
        if (montantGarantie > 0) {
          alert(
            `❌ Retrait impossible!\n\n` +
            `Montant demandé: ${formatCurrency(montant)}\n` +
            `Solde total: ${formatCurrency(soldeTotal)}\n` +
            `Garantie bloquée (prêts actifs): ${formatCurrency(montantGarantie)}\n` +
            `Montant disponible pour retrait: ${formatCurrency(soldeDisponiblePourRetrait)}\n\n` +
            `⚠️ Vous ne pouvez pas retirer le montant de garantie des prêts actifs.\n` +
            `Vous pouvez seulement retirer le montant en plus: ${formatCurrency(soldeDisponiblePourRetrait)}`
          )
        } else {
          alert(`Montant du retrait supérieur au solde disponible (${formatCurrency(soldeDisponiblePourRetrait)}).`)
        }
        return
      }
    }

    // Validation pour les garanties (collateral)
    if (formData.type === 'collateral') {
      if (!formData.collateralType) {
        alert('Veuillez sélectionner un type de prêt pour la garantie.')
        return
      }
      if (formData.collateralType === 'individual' && !formData.collateralPretId) {
        alert('Veuillez sélectionner un prêt individuel pour la garantie.')
        return
      }
      if (formData.collateralType === 'group' && !formData.collateralGroupPretId) {
        alert('Veuillez sélectionner un prêt de groupe pour la garantie.')
        return
      }

      // Vérifier que le montant à bloquer ne dépasse pas le collateral requis
      try {
        let montantPret = 0
        let pretId = ''

        if (formData.collateralType === 'individual' && formData.collateralPretId) {
          const pret = prets.find(p => p.pret_id === formData.collateralPretId)
          if (!pret) {
            alert('Prêt individuel introuvable.')
            return
          }
          montantPret = Number(pret.montant_pret || 0)
          pretId = formData.collateralPretId
        } else if (formData.collateralType === 'group' && formData.collateralGroupPretId) {
          const groupPret = groupPrets.find(gp => gp.pret_id === formData.collateralGroupPretId)
          if (!groupPret) {
            alert('Prêt de groupe introuvable.')
            return
          }
          pretId = formData.collateralGroupPretId
          
          // Pour les prêts de groupe, calculer le montant individuel du membre
          // en additionnant les principaux de tous ses remboursements pour ce prêt
          const { data: groupRemboursements, error: rembError } = await supabase
            .from('group_remboursements')
            .select('principal')
            .eq('pret_id', pretId)
            .eq('membre_id', selectedMembreId)
          
          if (rembError && rembError.code !== '42P01' && rembError.code !== 'PGRST116') {
            console.error('Erreur lors du chargement des remboursements de groupe:', rembError)
            alert('Erreur lors de la récupération du montant individuel du membre pour ce prêt de groupe.')
            return
          }
          
          if (groupRemboursements && groupRemboursements.length > 0) {
            // Calculer le montant individuel en additionnant tous les principaux
            montantPret = groupRemboursements.reduce((sum, r) => sum + Number(r.principal || 0), 0)
          } else {
            // Si aucun remboursement trouvé, utiliser le montant total du prêt divisé par le nombre de membres
            // (fallback si les remboursements ne sont pas encore créés)
            const { data: groupMembersData, error: groupMembersError } = await supabase
              .from('membre_group_members')
              .select('membre_id')
              .eq('group_id', groupPret.group_id)
            
            if (groupMembersError) {
              console.error('Erreur lors du chargement des membres du groupe:', groupMembersError)
              // En cas d'erreur, utiliser 1 comme nombre de membres par défaut
              montantPret = Number(groupPret.montant_pret || 0)
            } else {
              const nombreMembres = groupMembersData?.length || 1
              montantPret = Number(groupPret.montant_pret || 0) / nombreMembres
            }
          }
        }

        if (montantPret <= 0) {
          alert('Montant du prêt invalide.')
          return
        }

        // Calculer le montant de collateral requis sur le montant individuel du membre
        const montantCollateralRequis = await calculateCollateralAmount(montantPret)

        // Calculer le montant déjà bloqué pour ce prêt
        const montantDejaBloque = transactions
          .filter(t => 
            (formData.collateralType === 'individual' && t.blocked_for_pret_id === pretId) ||
            (formData.collateralType === 'group' && t.blocked_for_group_pret_id === pretId)
          )
          .reduce((sum, t) => sum + Number(t.montant || 0), 0)

        // Vérifier que le montant à bloquer + ce qui est déjà bloqué ne dépasse pas le requis
        const montantTotalApresBlocage = montantDejaBloque + montant
        if (montantTotalApresBlocage > montantCollateralRequis) {
          const montantMaximum = Math.max(0, montantCollateralRequis - montantDejaBloque)
          alert(
            `Le montant de garantie à bloquer (${formatCurrency(montant)}) dépasse le montant requis.\n\n` +
            `Montant requis pour ce prêt: ${formatCurrency(montantCollateralRequis)}\n` +
            `Montant déjà bloqué: ${formatCurrency(montantDejaBloque)}\n` +
            `Montant maximum pouvant être bloqué: ${formatCurrency(montantMaximum)}`
          )
          return
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du collateral requis:', error)
        alert('Erreur lors de la vérification du montant de garantie requis. Veuillez réessayer.')
        return
      }
    }

    try {
      setSubmitting(true)
      setErrorMessage(null)

      // Déterminer l'agent_id applicable
      let finalAgentId = ''
      
      if (userProfile?.role === 'agent') {
        // Pour les agents, utiliser leur agent_id du profil
        finalAgentId = userProfile.agent_id || ''
      } else {
        // Pour les admins et managers, toujours utiliser l'agent_id du membre sélectionné
        // Ne jamais utiliser l'agent_id du profil admin/manager car il peut être invalide
        const membre = membres.find(m => m.membre_id === selectedMembreId)
        finalAgentId = membre?.agent_id || ''
      }
      
      if (!finalAgentId) {
        setErrorMessage("Agent de crédit introuvable pour cette opération. Veuillez sélectionner un membre valide.")
        setSubmitting(false)
        return
      }

      // Vérifier que l'agent_id existe dans la table agents
      const { data: agentExists, error: agentCheckError } = await supabase
        .from('agents')
        .select('agent_id')
        .eq('agent_id', finalAgentId)
        .single()

      if (agentCheckError || !agentExists) {
        console.error('Erreur lors de la vérification de l\'agent:', agentCheckError)
        setErrorMessage(`L'agent ${finalAgentId} n'existe pas dans la base de données. Veuillez contacter l'administrateur.`)
        setSubmitting(false)
        return
      }

      if (editingTransaction) {
        // Mise à jour d'une transaction existante
        // IMPORTANT: Les collaterals ne sont PAS dans epargne_transactions
        // On ne peut modifier que les dépôts et retraits
        
        // Si l'utilisateur essaie de modifier une transaction en collateral, refuser
        if (formData.type === 'collateral') {
          setErrorMessage('Les garanties (collaterals) ne peuvent pas être modifiées depuis cette page. Elles sont gérées dans la table collaterals.')
          setSubmitting(false)
          return
        }

        // Mise à jour uniquement pour les dépôts et retraits
        const transactionType = formData.type // 'depot' ou 'retrait' uniquement

        const { error } = await supabase
          .from('epargne_transactions')
          .update({
            type: transactionType,
            montant,
            date_operation: formData.date_operation,
            is_blocked: false, // Les transactions dans epargne_transactions ne sont jamais bloquées
            blocked_for_pret_id: null,
            blocked_for_group_pret_id: null,
          })
          .eq('id', editingTransaction.id)

        if (error) {
          console.error('Erreur lors de la mise à jour de l\'opération d\'épargne:', error)
          const errorMessage = error.message || 'Erreur inconnue'
          setErrorMessage(`Erreur lors de la mise à jour de l'opération: ${errorMessage}`)
          return
        }

        setEditingTransaction(null)
        alert('Opération mise à jour avec succès.')
      } else {
        // Création d'une nouvelle transaction
        // IMPORTANT: Les collaterals ne sont PAS créés dans epargne_transactions
        // Ils sont uniquement dans la table collaterals
        
        // Si c'est un collateral, créer uniquement dans la table collaterals (PAS dans epargne_transactions)
        if (formData.type === 'collateral') {
          // Validation : pour le collateral, vérifier que le solde disponible est suffisant
          if (montant > soldeDisponible) {
            setErrorMessage(
              `Le montant de la garantie (${formatCurrency(montant)}) dépasse le solde disponible ` +
              `(${formatCurrency(soldeDisponible)}). Veuillez réduire le montant ou ajouter des fonds au compte d'épargne.`
            )
            setSubmitting(false)
            return
          }

          // Créer/mettre à jour uniquement dans la table collaterals
          try {
            let montantPret = 0
            let pretId = ''
            let montantGarantieRequis = 0

            if (formData.collateralType === 'individual' && formData.collateralPretId) {
              const pret = prets.find(p => p.pret_id === formData.collateralPretId)
              if (!pret) {
                setErrorMessage('Prêt individuel introuvable.')
                setSubmitting(false)
                return
              }
              montantPret = Number(pret.montant_pret || 0)
              pretId = formData.collateralPretId
              montantGarantieRequis = await calculateCollateralAmount(montantPret)
            } else if (formData.collateralType === 'group' && formData.collateralGroupPretId) {
              const groupPret = groupPrets.find(gp => gp.pret_id === formData.collateralGroupPretId)
              if (!groupPret) {
                setErrorMessage('Prêt de groupe introuvable.')
                setSubmitting(false)
                return
              }
              pretId = formData.collateralGroupPretId
              
              // Pour les prêts de groupe, calculer le montant individuel du membre
              const { data: groupRemboursements, error: rembError } = await supabase
                .from('group_remboursements')
                .select('principal')
                .eq('pret_id', pretId)
                .eq('membre_id', selectedMembreId)
              
              if (!rembError && groupRemboursements && groupRemboursements.length > 0) {
                montantPret = groupRemboursements.reduce((sum, r) => sum + Number(r.principal || 0), 0)
              } else {
                // Fallback: diviser le montant total par le nombre de membres
                const { data: groupMembersData } = await supabase
                  .from('membre_group_members')
                  .select('membre_id')
                  .eq('group_id', groupPret.group_id)
                
                const nombreMembres = groupMembersData?.length || 1
                montantPret = Number(groupPret.montant_pret || 0) / nombreMembres
              }
              
              montantGarantieRequis = await calculateCollateralAmount(montantPret)
            }

            if (pretId && montantGarantieRequis > 0) {
              // Calculer le montant déjà bloqué pour ce prêt depuis la table collaterals
              const existingCollateral = collaterals.find(c => 
                (formData.collateralType === 'individual' && c.pret_id === pretId) ||
                (formData.collateralType === 'group' && c.group_pret_id === pretId)
              )
              const montantDejaBloque = existingCollateral ? Number(existingCollateral.montant_depose || 0) : 0
              
              // Vérifier que le montant à bloquer + ce qui est déjà bloqué ne dépasse pas le requis
              const montantTotalApresBlocage = montantDejaBloque + montant
              if (montantTotalApresBlocage > montantGarantieRequis) {
                const montantMaximum = Math.max(0, montantGarantieRequis - montantDejaBloque)
                setErrorMessage(
                  `Le montant de garantie à bloquer (${formatCurrency(montant)}) dépasse le montant requis.\n\n` +
                  `Montant requis pour ce prêt: ${formatCurrency(montantGarantieRequis)}\n` +
                  `Montant déjà bloqué: ${formatCurrency(montantDejaBloque)}\n` +
                  `Montant maximum pouvant être bloqué: ${formatCurrency(montantMaximum)}`
                )
                setSubmitting(false)
                return
              }

              // Vérifier si un collateral existe déjà
              const collateralQuery = formData.collateralType === 'individual'
                ? supabase
                    .from('collaterals')
                    .select('id')
                    .eq('pret_id', pretId)
                    .eq('membre_id', selectedMembreId)
                    .is('group_pret_id', null)
                    .maybeSingle()
                : supabase
                    .from('collaterals')
                    .select('id')
                    .eq('group_pret_id', pretId)
                    .eq('membre_id', selectedMembreId)
                    .maybeSingle()

              const { data: existingCollateralRecord, error: collateralCheckError } = await collateralQuery

              if (collateralCheckError && collateralCheckError.code !== 'PGRST116') {
                console.error('Erreur lors de la vérification du collateral:', collateralCheckError)
                setErrorMessage('Erreur lors de la vérification du collateral existant.')
                setSubmitting(false)
                return
              }

              if (existingCollateralRecord) {
                // Mettre à jour le collateral existant
                const { error: updateCollateralError } = await supabase
                  .from('collaterals')
                  .update({
                    montant_depose: montantTotalApresBlocage,
                    montant_restant: Math.max(0, montantGarantieRequis - montantTotalApresBlocage),
                    statut: montantTotalApresBlocage >= montantGarantieRequis ? 'complet' : 'partiel',
                    date_depot: montantTotalApresBlocage >= montantGarantieRequis ? formData.date_operation : null,
                  })
                  .eq('id', existingCollateralRecord.id)

                if (updateCollateralError) {
                  console.error('Erreur lors de la mise à jour du collateral:', updateCollateralError)
                  setErrorMessage('Erreur lors de la mise à jour du collateral.')
                  setSubmitting(false)
                  return
                }
              } else {
                // Créer un nouveau collateral
                const collateralData: any = {
                  membre_id: selectedMembreId,
                  montant_requis: montantGarantieRequis,
                  montant_depose: montantTotalApresBlocage,
                  montant_restant: Math.max(0, montantGarantieRequis - montantTotalApresBlocage),
                  statut: montantTotalApresBlocage >= montantGarantieRequis ? 'complet' : 'partiel',
                  date_depot: montantTotalApresBlocage >= montantGarantieRequis ? formData.date_operation : null,
                }

                if (formData.collateralType === 'individual') {
                  collateralData.pret_id = pretId
                  collateralData.group_pret_id = null
                } else {
                  collateralData.pret_id = null
                  collateralData.group_pret_id = pretId
                }

                const { error: createCollateralError } = await supabase
                  .from('collaterals')
                  .insert(collateralData)

                if (createCollateralError) {
                  console.error('Erreur lors de la création du collateral:', createCollateralError)
                  setErrorMessage('Erreur lors de la création du collateral.')
                  setSubmitting(false)
                  return
                }
              }

              // Recharger les collaterals après création/mise à jour
              await loadCollaterals(selectedMembreId)
              alert('Garantie enregistrée avec succès.')
              setFormData({
                type: 'depot',
                montant: '',
                date_operation: new Date().toISOString().split('T')[0],
                notes: '',
                collateralPretId: '',
                collateralGroupPretId: '',
                collateralType: '',
              })
              setSubmitting(false)
              return
            }
          } catch (error) {
            console.error('Erreur lors de la création du collateral:', error)
            setErrorMessage('Erreur lors de la création de la garantie. Veuillez réessayer.')
            setSubmitting(false)
            return
          }
        }

        // Pour les dépôts et retraits, créer dans epargne_transactions
        // Les collaterals ne sont PAS créés ici, ils sont déjà créés ci-dessus
        const transactionType = formData.type // 'depot' ou 'retrait' uniquement

        const { error } = await supabase
          .from('epargne_transactions')
          .insert([{
            membre_id: selectedMembreId,
            agent_id: finalAgentId,
            type: transactionType,
            montant,
            date_operation: formData.date_operation,
            is_blocked: false, // Les transactions dans epargne_transactions ne sont jamais bloquées
            blocked_for_pret_id: null,
            blocked_for_group_pret_id: null,
            // Note: La colonne 'notes' n'existe pas dans la table epargne_transactions
          }])

        if (error) {
          console.error('Erreur lors de l\'enregistrement de l\'opération d\'épargne:', error)
          console.error('Détails de l\'erreur:', {
            code: (error as any).code,
            message: error.message,
            details: (error as any).details,
            hint: (error as any).hint,
            finalAgentId: finalAgentId,
            selectedMembreId: selectedMembreId
          })
          
          if ((error as any).code === '42P01') {
            setErrorMessage(
              "La table 'epargne_transactions' n'existe pas encore. Veuillez créer la table côté Supabase pour activer l'épargne."
            )
          } else if (error.message?.includes('blocked_for_group_pret_id') || error.message?.includes('blocked_for_pret_id') || error.message?.includes('is_blocked')) {
            // Essayer d'exécuter la migration automatiquement via l'API
            try {
              console.log('🔄 Tentative d\'exécution automatique de la migration...')
              const migrationResponse = await fetch('/api/migrate-epargne', {
                method: 'POST',
              })
              
              if (migrationResponse.ok) {
                const migrationResult = await migrationResponse.json()
                console.log('✅ Migration exécutée:', migrationResult)
                setErrorMessage(
                  "✅ Migration exécutée automatiquement!\n\n" +
                  "Les colonnes nécessaires ont été ajoutées. Veuillez réessayer l'opération."
                )
                // Recharger les transactions après un court délai
                setTimeout(() => {
                  if (selectedMembreId) {
                    loadTransactions(selectedMembreId)
                  }
                }, 1000)
              } else {
                const migrationError = await migrationResponse.json()
                console.error('Erreur migration:', migrationError)
                setErrorMessage(
                  "❌ Colonnes manquantes dans la table 'epargne_transactions'.\n\n" +
                  "La migration automatique a échoué. Veuillez exécuter manuellement la migration SQL dans Supabase.\n\n" +
                  "Fichier de migration: supabase/migration_add_epargne_blocked.sql\n\n" +
                  "Ou exécutez d'abord: supabase/migration_add_epargne_blocked_function.sql\n" +
                  "puis réessayez l'opération."
                )
              }
            } catch (migrationErr) {
              console.error('Erreur lors de la migration automatique:', migrationErr)
              setErrorMessage(
                "❌ Colonnes manquantes dans la table 'epargne_transactions'.\n\n" +
                "Veuillez exécuter la migration SQL dans Supabase pour ajouter les colonnes nécessaires au blocage des garanties.\n\n" +
                "1. Exécutez d'abord: supabase/migration_add_epargne_blocked_function.sql\n" +
                "2. Puis réessayez l'opération.\n\n" +
                "Ou exécutez directement: supabase/migration_add_epargne_blocked.sql"
              )
            }
          } else if ((error as any).code === '23503' || error.message?.includes('foreign key constraint')) {
            // Erreur de contrainte de clé étrangère
            if (error.message?.includes('agent_id')) {
              setErrorMessage(`L'agent ${finalAgentId} n'existe pas dans la base de données. Veuillez contacter l'administrateur pour corriger ce problème.`)
            } else if (error.message?.includes('membre_id')) {
              setErrorMessage(`Le membre ${selectedMembreId} n'existe pas dans la base de données. Veuillez contacter l'administrateur.`)
            } else {
              setErrorMessage(`Erreur de référence: ${error.message || 'Une référence invalide a été détectée'}`)
            }
          } else {
            const errorMessage = error.message || 'Erreur inconnue'
            setErrorMessage(`Erreur lors de l'enregistrement de l'opération: ${errorMessage}`)
          }
          setSubmitting(false)
          return
        }

        // Les collaterals sont déjà créés/mis à jour ci-dessus si c'était un collateral
        // Pour les dépôts et retraits, la transaction a été créée dans epargne_transactions ci-dessus
        
        alert('Opération enregistrée avec succès.')
      }

      setFormData({
        type: 'depot',
        montant: '',
        date_operation: new Date().toISOString().split('T')[0],
        notes: '',
        collateralPretId: '',
        collateralGroupPretId: '',
        collateralType: '',
      })
      await loadTransactions(selectedMembreId)
    } catch (error) {
      console.error('Erreur enregistrement épargne:', error)
      setErrorMessage('Erreur lors de l\'enregistrement de l\'opération.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(transaction: EpargneTransaction) {
    // IMPORTANT: Les transactions dans epargne_transactions ne sont jamais bloquées
    // Seuls les dépôts et retraits peuvent être modifiés
    setEditingTransaction(transaction)
    setFormData({
      type: transaction.type as TransactionType, // 'depot' ou 'retrait' uniquement
      montant: transaction.montant.toString(),
      date_operation: transaction.date_operation,
      notes: transaction.notes || '',
      collateralPretId: '',
      collateralGroupPretId: '',
      collateralType: '',
    })
  }

  function handleCancelEdit() {
    setEditingTransaction(null)
    setFormData({
      type: 'depot',
      montant: '',
      date_operation: new Date().toISOString().split('T')[0],
      notes: '',
      collateralPretId: '',
      collateralGroupPretId: '',
      collateralType: '',
    })
  }

  async function handleDelete(transaction: EpargneTransaction) {
    if (!confirm('Supprimer cette transaction ?')) return
    try {
      // IMPORTANT: Les transactions dans epargne_transactions ne sont jamais bloquées
      // Seuls les dépôts et retraits peuvent être supprimés
      // Les collaterals sont dans la table collaterals et doivent être supprimés depuis là
      
      const { error } = await supabase
        .from('epargne_transactions')
        .delete()
        .eq('id', transaction.id)
      if (error) throw error
      alert('Transaction supprimée avec succès.')
      await loadTransactions(selectedMembreId)
    } catch (err: any) {
      console.error(err)
      setErrorMessage('Impossible de supprimer la transaction: ' + (err.message || 'Erreur inconnue'))
    }
  }

  // Cette fonction n'est plus nécessaire car les collaterals ne sont plus dans epargne_transactions
  // Les collaterals sont gérés uniquement dans la table collaterals
  async function handleToggleBlock(transaction: EpargneTransaction) {
    alert('Les garanties (collaterals) sont maintenant gérées uniquement dans la table collaterals. Utilisez l\'option "Collateral (Garantie)" pour créer une garantie.')
  }

  async function handleRunMigration() {
    setMigrating(true)
    setErrorMessage(null)
    
    try {
      // Essayer d'appeler la fonction RPC si elle existe
      const { data, error } = await supabase.rpc('add_epargne_blocked_columns')
      
      if (error) {
        console.log('Fonction RPC non disponible:', error.message)
        
        // Si la fonction RPC n'existe pas, essayer via l'API route
        console.log('Tentative via API route...')
        try {
          const response = await fetch('/api/migrate-epargne', {
            method: 'POST',
          })
          
          if (response.ok) {
            const result = await response.json()
            setErrorMessage(
              `✅ Migration réussie!\n\n` +
              `Les colonnes suivantes ont été ajoutées:\n` +
              result.results?.map((r: any) => `- ${r.column_name}: ${r.message}`).join('\n') || 'Toutes les colonnes'
            )
            // Recharger les transactions après un court délai
            setTimeout(() => {
              if (selectedMembreId) {
                loadTransactions(selectedMembreId)
              }
            }, 1000)
            return
          } else {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Erreur API')
          }
        } catch (apiError: any) {
          console.error('Erreur API route:', apiError)
          // Afficher les instructions pour exécuter manuellement
          setErrorMessage(
            `❌ La migration automatique n'est pas disponible (problème de connexion MCP).\n\n` +
            `📋 Pour résoudre ce problème, exécutez cette migration SQL dans Supabase Dashboard:\n\n` +
            `1. Allez dans Supabase Dashboard → SQL Editor\n` +
            `2. Copiez le contenu du fichier: supabase/migration_add_epargne_blocked_simple.sql\n` +
            `   (ou supabase/migration_add_epargne_blocked.sql pour la version complète)\n` +
            `3. Collez et exécutez dans l'éditeur SQL\n` +
            `4. Rafraîchissez cette page\n\n` +
            `📖 Consultez QUICK_MIGRATION_GUIDE.md pour plus de détails.`
          )
          return
        }
      }
      
      // Migration réussie via RPC
      if (data && data.length > 0) {
        const addedColumns = data.filter((r: any) => r.status === 'added').map((r: any) => r.column_name)
        const message = addedColumns.length > 0
          ? `✅ Migration réussie!\n\nColonnes ajoutées:\n${addedColumns.map((c: string) => `- ${c}`).join('\n')}`
          : `✅ Migration réussie!\n\nToutes les colonnes existent déjà.`
        
        setErrorMessage(message)
        // Recharger les transactions après un court délai
        setTimeout(() => {
          if (selectedMembreId) {
            loadTransactions(selectedMembreId)
          }
        }, 1000)
      } else {
        setErrorMessage('✅ Migration réussie! Toutes les colonnes existent déjà.')
      }
    } catch (err: any) {
      console.error('Erreur migration:', err)
      setErrorMessage(
        `❌ Erreur lors de la migration: ${err.message}\n\n` +
        `Veuillez exécuter manuellement la migration SQL dans Supabase Dashboard:\n\n` +
        `1. Ouvrez Supabase Dashboard → SQL Editor\n` +
        `2. Exécutez: supabase/migration_add_epargne_blocked_simple.sql\n` +
        `3. Rafraîchissez cette page\n\n` +
        `📖 Voir QUICK_MIGRATION_GUIDE.md pour plus d'aide.`
      )
    } finally {
      setMigrating(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  const filteredMembres = useMemo(() => {
    if (userProfile?.role === 'agent') return membres
    return membres
  }, [membres, userProfile])

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

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  const canOperate = userProfile.role === 'agent' || userProfile.role === 'manager' || userProfile.role === 'admin'

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Épargne</h1>
            <p className="text-muted-foreground mt-2">
              Collecte d'épargne des membres. Les agents et managers peuvent enregistrer dépôts, retraits et bloquer des garanties.
              {realtimeConnected && (
                <span className="ml-2 text-green-600 text-sm">● En direct</span>
              )}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Membre *
              </label>
              <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between"
                  >
                    <span className={selectedMembreId ? 'text-gray-900' : 'text-gray-500'}>
                      {selectedMembreId
                        ? (() => {
                            const selected = filteredMembres.find((m) => m.membre_id === selectedMembreId)
                            return selected
                              ? `${selected.membre_id} — ${selected.prenom} ${selected.nom} (${selected.agent_id})`
                              : 'Sélectionner un membre'
                          })()
                        : 'Sélectionner un membre'}
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
                      searchedMembres.map((membre) => (
                        <button
                          key={membre.id}
                          type="button"
                          onClick={() => {
                            setSelectedMembreId(membre.membre_id)
                            setMemberSearchOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                            selectedMembreId === membre.membre_id ? 'bg-blue-50 text-blue-900' : ''
                          }`}
                        >
                          <div className="font-medium">{membre.membre_id}</div>
                          <div className="text-xs text-gray-500">
                            {membre.prenom} {membre.nom} ({membre.agent_id})
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Solde total
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                {formatCurrency(selectedMembreId ? soldeDisponible + soldeBloque : 0)}
              </div>
              {selectedMembreId && (
                <p className="text-xs text-gray-500 mt-1">
                  Solde total = Solde disponible ({formatCurrency(soldeDisponible)}) + Solde bloqué ({formatCurrency(soldeBloque)})
                </p>
              )}
            </div>

            {selectedMembreId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  Solde disponible
                  {realtimeConnected && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-normal">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span>Temps réel</span>
                    </span>
                  )}
                </label>
                <div 
                  className={`px-3 py-2 border rounded-lg font-semibold transition-all duration-500 ease-in-out ${
                    soldeChanged 
                      ? 'bg-green-100 text-green-900 border-green-400 shadow-lg scale-[1.02] ring-2 ring-green-200' 
                      : 'bg-green-50 text-green-800 border-gray-200'
                  }`}
                >
                  <span className={`inline-block ${soldeChanged ? 'animate-pulse' : ''}`}>
                    {formatCurrency(soldeDisponible)}
                  </span>
                </div>
              </div>
            )}

            {/* Toujours afficher le solde bloqué (garantie), même si aucun membre n'est sélectionné */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Solde bloqué (garantie)
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-amber-50 text-amber-800 font-semibold">
                {formatCurrency(soldeBloque)}
              </div>
              {selectedMembreId && soldeBloque > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Ce montant est bloqué comme garantie pour les prêts actifs et ne peut pas être retiré.
                </p>
              )}
              {selectedMembreId && soldeBloque === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Aucune garantie bloquée pour ce membre.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date du jour
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                {formatDate(new Date().toISOString().split('T')[0])}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="whitespace-pre-line">{errorMessage}</div>
              {errorMessage.includes('Colonnes manquantes') && (
                <button
                  onClick={handleRunMigration}
                  disabled={migrating}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {migrating ? 'Migration en cours...' : '🔧 Exécuter la migration automatiquement'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d’opération *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value as TransactionType
                    setFormData({ 
                      ...formData, 
                      type: newType,
                      // Réinitialiser les champs de garantie si on change de type
                      collateralPretId: newType !== 'collateral' ? '' : formData.collateralPretId,
                      collateralGroupPretId: newType !== 'collateral' ? '' : formData.collateralGroupPretId,
                      collateralType: newType !== 'collateral' ? '' : formData.collateralType,
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!canOperate || !selectedMembreId}
                >
                  <option value="depot">Dépôt</option>
                  <option value="retrait">Retrait</option>
                  <option value="collateral">Collateral (Garantie)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant (HTG) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={formData.type === 'retrait' ? soldeDisponiblePourRetrait : undefined}
                  required
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!canOperate || !selectedMembreId}
                />
                {formData.type === 'retrait' && selectedMembreId && (
                  <div className="text-xs mt-1">
                    <p className="text-gray-500">
                      Maximum disponible: {formatCurrency(soldeDisponiblePourRetrait)}
                    </p>
                    {montantGarantieActive > 0 && (
                      <p className="text-amber-600 mt-1">
                        ⚠️ Garantie bloquée (prêts actifs): {formatCurrency(montantGarantieActive)} - non retirable
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de l’opération *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_operation}
                  onChange={(e) => setFormData({ ...formData, date_operation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!canOperate || !selectedMembreId}
                />
              </div>
            </div>

            {/* Champs pour la garantie (collateral) */}
            {formData.type === 'collateral' && selectedMembreId && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de prêt *
                  </label>
                  <select
                    value={formData.collateralType}
                    onChange={(e) => {
                      const newCollateralType = e.target.value as 'individual' | 'group' | ''
                      setFormData({
                        ...formData,
                        collateralType: newCollateralType,
                        collateralPretId: newCollateralType !== 'individual' ? '' : formData.collateralPretId,
                        collateralGroupPretId: newCollateralType !== 'group' ? '' : formData.collateralGroupPretId,
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!canOperate || !selectedMembreId || loadingPrets}
                  >
                    <option value="">Sélectionner un type</option>
                    <option value="individual">Prêt individuel</option>
                    <option value="group">Prêt de groupe</option>
                  </select>
                </div>

                {formData.collateralType === 'individual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prêt individuel *
                    </label>
                    {loadingPrets ? (
                      <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                        Chargement...
                      </div>
                    ) : prets.length === 0 ? (
                      <div className="px-3 py-2 border border-gray-300 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
                        Aucun prêt individuel disponible
                      </div>
                    ) : (
                      <select
                        value={formData.collateralPretId}
                        onChange={(e) => setFormData({ ...formData, collateralPretId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={!canOperate || !selectedMembreId}
                      >
                        <option value="">Sélectionner un prêt</option>
                        {prets.map((pret) => (
                          <option key={pret.pret_id} value={pret.pret_id}>
                            {pret.pret_id} - {formatCurrency(pret.montant_pret)} ({pret.statut})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {formData.collateralType === 'group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prêt de groupe *
                    </label>
                    {loadingPrets ? (
                      <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                        Chargement...
                      </div>
                    ) : groupPrets.length === 0 ? (
                      <div className="px-3 py-2 border border-gray-300 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
                        Aucun prêt de groupe disponible
                      </div>
                    ) : (
                      <select
                        value={formData.collateralGroupPretId}
                        onChange={(e) => setFormData({ ...formData, collateralGroupPretId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={!canOperate || !selectedMembreId}
                      >
                        <option value="">Sélectionner un prêt de groupe</option>
                        {groupPrets.map((groupPret) => (
                          <option key={groupPret.pret_id} value={groupPret.pret_id}>
                            {groupPret.pret_id} - {formatCurrency(groupPret.montant_pret)} ({groupPret.statut})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Dépôt hebdomadaire, retrait exceptionnel, etc."
                rows={3}
                disabled={!canOperate || !selectedMembreId}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  !canOperate || 
                  !selectedMembreId || 
                  submitting ||
                  (formData.type === 'retrait' && parseFloat(formData.montant || '0') > soldeDisponiblePourRetrait) ||
                  (formData.type === 'collateral' && (!formData.collateralType || 
                    (formData.collateralType === 'individual' && !formData.collateralPretId) ||
                    (formData.collateralType === 'group' && !formData.collateralGroupPretId)))
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Enregistrement...' : editingTransaction ? 'Mettre à jour' : "Enregistrer l'opération"}
              </button>
              {editingTransaction && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Historique des opérations</h2>
            {!selectedMembreId && (
              <p className="text-sm text-gray-600 mt-1">Sélectionnez un membre pour voir l’historique.</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  {(userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'agent') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedMembreId && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={(userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'agent') ? 6 : 5} className="px-6 py-4 text-center text-gray-500">
                      Aucune opération enregistrée
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(t.date_operation)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            // Identifier les collaterals : transactions bloquées OU type='retrait' avec is_blocked=true
                            (t.is_blocked === true || (t.type === 'retrait' && (t.blocked_for_pret_id || t.blocked_for_group_pret_id)))
                              ? 'bg-purple-100 text-purple-800' // Collateral
                              : t.type === 'depot'
                              ? 'bg-green-100 text-green-800' // Dépôt
                              : 'bg-amber-100 text-amber-800' // Retrait normal
                          }`}
                        >
                          {(t.is_blocked === true || (t.type === 'retrait' && (t.blocked_for_pret_id || t.blocked_for_group_pret_id)))
                            ? 'Collateral'
                            : t.type === 'depot' 
                            ? 'Dépôt'
                            : 'Retrait'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatCurrency(t.montant)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(t.is_blocked === true || (t.type === 'retrait' && (t.blocked_for_pret_id || t.blocked_for_group_pret_id))) ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Bloqué (Collateral)
                            {t.blocked_for_pret_id && ` (Prêt: ${t.blocked_for_pret_id})`}
                            {t.blocked_for_group_pret_id && ` (Groupe: ${t.blocked_for_group_pret_id})`}
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Disponible
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {t.notes || '-'}
                      </td>
                      {(userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'agent') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(t)}
                              disabled={!canAgentModifyTransaction(t)}
                              className={`p-2 rounded ${
                                canAgentModifyTransaction(t)
                                  ? 'text-blue-600 hover:bg-blue-50'
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              title={
                                !canAgentModifyTransaction(t)
                                  ? 'Vous ne pouvez modifier que les transactions du jour même. Contactez votre manager pour modifier les transactions des jours précédents.'
                                  : 'Modifier la transaction'
                              }
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {/* Les collaterals ne sont plus dans epargne_transactions, donc pas besoin de bouton de blocage */}
                            {/* Si une transaction bloquée apparaît encore (données anciennes), elle est identifiée comme Collateral */}
                            <button
                              onClick={() => handleDelete(t)}
                              disabled={!canAgentModifyTransaction(t)}
                              className={`p-2 rounded ${
                                canAgentModifyTransaction(t)
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              title={
                                !canAgentModifyTransaction(t)
                                  ? 'Vous ne pouvez supprimer que les transactions du jour même. Contactez votre manager pour supprimer les transactions des jours précédents.'
                                  : 'Supprimer la transaction'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
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

export default function EpargnePage() {
  // Lecture: tout le monde connecté. Opérations: agents/admins via contrôles UI.
  return (
    <ProtectedRoute>
      <EpargnePageContent />
    </ProtectedRoute>
  )
}


