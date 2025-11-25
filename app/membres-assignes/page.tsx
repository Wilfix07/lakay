'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Membre, type Pret, type Collateral, type Remboursement, type UserProfile, type ChefZoneMembre, type GroupPret, type EpargneTransaction, type Agent } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Wallet, PiggyBank, CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, DollarSign, UserPlus, RefreshCw } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function MembresAssignesContent() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [membres, setMembres] = useState<Membre[]>([])
  const [membresDetails, setMembresDetails] = useState<Record<string, {
    garantie: number
    epargne: number
    pretActif: number
    echeancier: Remboursement[]
    dateDecaissement?: string
    dateFin?: string
    duree?: number
    dateApprobation?: string
    dureeMois?: number
    cycleCredit?: number
    pretActifId?: string | null
  }>>({})
  const [selectedMembre, setSelectedMembre] = useState<Membre | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [epargneTransactions, setEpargneTransactions] = useState<EpargneTransaction[]>([])
  const [memberGroupInfo, setMemberGroupInfo] = useState<{ group_name: string; group_id: number } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadMembresAssignes()
      loadAgents()
    }
  }, [userProfile])

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

  async function loadUserProfile() {
    try {
      const profile = await getUserProfile()
      if (!profile) {
        router.push('/login')
        return
      }
      setUserProfile(profile)
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  async function loadMembresAssignes(showRefreshing = false) {
    if (!userProfile || userProfile.role !== 'chef_zone') return

    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      
      // Charger les membres assignés au chef de zone
      const { data: assignations, error: assignationsError } = await supabase
        .from('chef_zone_membres')
        .select('membre_id')
        .eq('chef_zone_id', userProfile.id)

      if (assignationsError) throw assignationsError

      const membreIds = assignations?.map(a => a.membre_id) || []
      
      if (membreIds.length === 0) {
        setMembres([])
        setMembresDetails({})
        if (showRefreshing) {
          setRefreshing(false)
        } else {
          setLoading(false)
        }
        return
      }

      // Charger les détails des membres
      const { data: membresData, error: membresError } = await supabase
        .from('membres')
        .select('*')
        .in('membre_id', membreIds)

      if (membresError) throw membresError
      setMembres(membresData || [])

      // Charger les détails pour chaque membre
      await loadMembresDetails(membreIds)
    } catch (error) {
      console.error('Erreur lors du chargement des membres assignés:', error)
      alert('Erreur lors du chargement des membres assignés')
    } finally {
      if (showRefreshing) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }

  async function loadMembresDetails(membreIds: string[]) {
    const details: Record<string, {
      garantie: number
      epargne: number
      pretActif: number
      echeancier: Remboursement[]
      dateDecaissement?: string
      dateFin?: string
      duree?: number
      dateApprobation?: string
      dureeMois?: number
      cycleCredit?: number
      pretActifId?: string | null
    }> = {}

    // Charger les groupes qui contiennent les membres assignés
    const { data: groupMembersData } = await supabase
      .from('membre_group_members')
      .select('group_id, membre_id')
      .in('membre_id', membreIds)

    const groupIds = [...new Set((groupMembersData || []).map(gm => gm.group_id))]

      // Charger les prêts de groupe actifs pour ces groupes
      let groupPretsMap: Record<string, Partial<GroupPret>[]> = {}
      if (groupIds.length > 0) {
        const { data: groupPretsData } = await supabase
          .from('group_prets')
          .select('pret_id, montant_pret, capital_restant, group_id, date_decaissement, nombre_remboursements, frequence_remboursement')
          .in('group_id', groupIds)
          .eq('statut', 'actif') // Seulement les prêts actifs

      if (groupPretsData) {
        // Créer un map par membre_id pour les prêts de groupe
        for (const groupMember of groupMembersData || []) {
          const groupPret = groupPretsData.find(gp => gp.group_id === groupMember.group_id)
          if (groupPret) {
            if (!groupPretsMap[groupMember.membre_id]) {
              groupPretsMap[groupMember.membre_id] = []
            }
            groupPretsMap[groupMember.membre_id].push(groupPret)
          }
        }
      }
    }

    for (const membreId of membreIds) {
      // Charger les prêts actifs individuels d'abord pour obtenir les pret_ids
      const { data: pretsActifs } = await supabase
        .from('prets')
        .select('pret_id, montant_pret, capital_restant, date_decaissement, nombre_remboursements, frequence_remboursement')
        .eq('membre_id', membreId)
        .eq('statut', 'actif') // Seulement les prêts actifs

      const pretIds = (pretsActifs || []).map(p => p.pret_id)
      
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

      // Charger les épargnes (toutes les transactions sont pertinentes)
      const { data: epargnes } = await supabase
        .from('epargne_transactions')
        .select('type, montant')
        .eq('membre_id', membreId)

      const epargneTotal = (epargnes || []).reduce((sum, t) => {
        const montant = Number(t.montant || 0)
        return sum + (t.type === 'depot' ? montant : -montant)
      }, 0)

      // Récupérer les prêts de groupe pour ce membre
      const memberGroupPrets = groupPretsMap[membreId] || []

      // Calculer le total des prêts actifs (individuels + groupe)
      const pretActifTotal = 
        (pretsActifs || []).reduce((sum, p) => {
          return sum + Number(p.capital_restant || p.montant_pret || 0)
        }, 0) +
        memberGroupPrets.reduce((sum, p) => {
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
          .in('statut', ['en_attente', 'en_retard']) // Seulement en attente ou en retard
          .order('date_remboursement', { ascending: true })

        echeancier = remboursements || []
      }

      // Remboursements pour prêts de groupe actifs
      if (memberGroupPrets.length > 0) {
        const groupPretIds = memberGroupPrets.map(gp => gp.pret_id)
        const { data: groupRemboursements } = await supabase
          .from('group_remboursements')
          .select('*')
          .in('pret_id', groupPretIds)
          .eq('membre_id', membreId)
          .in('statut', ['en_attente', 'en_retard']) // Seulement en attente ou en retard
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

      // Déterminer le prêt actif (individuel ou de groupe) pour obtenir les informations
      const pretActifCourant = pretsActifs && pretsActifs.length > 0 ? pretsActifs[0] : null
      const groupPretActif = memberGroupPrets.length > 0 ? memberGroupPrets[0] : null

      let dateDecaissement: string | undefined = undefined
      let dateFin: string | undefined = undefined
      let duree: number | undefined = undefined
      let dateApprobation: string | undefined = undefined
      let dureeMois: number | undefined = undefined
      let cycleCredit: number | undefined = undefined
      let pretActifId: string | null = null

      // Obtenir la date de décaissement du prêt actif
      if (pretActifCourant) {
        dateDecaissement = pretActifCourant.date_decaissement
        pretActifId = pretActifCourant.pret_id
        
        // Charger les informations complètes du prêt pour obtenir updated_at
        const { data: pretComplet } = await supabase
          .from('prets')
          .select('updated_at, statut')
          .eq('pret_id', pretActifCourant.pret_id)
          .single()
        
        if (pretComplet && pretComplet.statut === 'actif' && pretComplet.updated_at) {
          dateApprobation = pretComplet.updated_at
        }
      } else if (groupPretActif) {
        dateDecaissement = groupPretActif.date_decaissement
        pretActifId = groupPretActif.pret_id || null
        
        // Charger les informations complètes du prêt de groupe pour obtenir updated_at
        const { data: groupPretComplet, error: groupPretError } = await supabase
          .from('group_prets')
          .select('updated_at, statut')
          .eq('pret_id', groupPretActif.pret_id)
          .maybeSingle()
        
        if (!groupPretError && groupPretComplet && groupPretComplet.statut === 'actif' && groupPretComplet.updated_at) {
          dateApprobation = groupPretComplet.updated_at
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

      details[membreId] = {
        garantie: garantieTotal,
        epargne: epargneTotal,
        pretActif: pretActifTotal,
        echeancier,
        dateDecaissement,
        dateFin,
        duree,
        dateApprobation,
        dureeMois,
        cycleCredit,
        pretActifId,
      }
    }

    setMembresDetails(details)
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

  async function viewEcheancier() {
    if (!selectedMembre) return
    
    const membreId = selectedMembre.membre_id
    const membreNom = `${selectedMembre.prenom} ${selectedMembre.nom}`
    const membreAdresse = selectedMembre.adresse || 'Non renseignée'
    const echeancier = membresDetails[membreId]?.echeancier || []
    const pretId = membresDetails[membreId]?.pretActifId || 'N/A'
    
    if (echeancier.length === 0) {
      alert('Aucun remboursement dans l\'échéancier à afficher.')
      return
    }

    // Récupérer le nom de l'agent de crédit
    const agent = agents.find(a => a.agent_id === selectedMembre.agent_id)
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

    // Calculer les totaux
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
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(htmlContent)
      printWindow.document.close()
    }
  }

  async function handleViewDetails(membre: Membre) {
    setSelectedMembre(membre)
    setShowDetails(true)
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
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  if (!userProfile || userProfile.role !== 'chef_zone') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Accès non autorisé</div>
      </div>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={() => router.push('/login')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Membres Assignés</h1>
            <p className="text-muted-foreground mt-2">
              Liste des membres qui vous sont assignés avec leurs détails financiers
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMembresAssignes(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {membres.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Aucun membre ne vous est actuellement assigné
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Membres</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{membres.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Garanties</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      Object.values(membresDetails).reduce((sum, d) => sum + d.garantie, 0)
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Épargnes</CardTitle>
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      Object.values(membresDetails).reduce((sum, d) => sum + d.epargne, 0)
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prêts Actifs</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      Object.values(membresDetails).reduce((sum, d) => sum + d.pretActif, 0)
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Liste des Membres</CardTitle>
                <CardDescription>
                  Cliquez sur "Voir détails" pour voir toutes les informations financières d'un membre
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Membre</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Garantie</TableHead>
                      <TableHead>Épargne</TableHead>
                      <TableHead>Prêt Actif</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membres.map((membre) => {
                      const details = membresDetails[membre.membre_id] || {
                        garantie: 0,
                        epargne: 0,
                        pretActif: 0,
                        echeancier: [],
                      }
                      return (
                        <TableRow key={membre.membre_id}>
                          <TableCell className="font-medium">{membre.membre_id}</TableCell>
                          <TableCell>{membre.nom || '-'}</TableCell>
                          <TableCell>{membre.prenom || '-'}</TableCell>
                          <TableCell>{formatCurrency(details.garantie)}</TableCell>
                          <TableCell>{formatCurrency(details.epargne)}</TableCell>
                          <TableCell>{formatCurrency(details.pretActif)}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(membre)}
                            >
                              Voir détails
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Modal de détails */}
        {showDetails && selectedMembre && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      Détails - {selectedMembre.prenom} {selectedMembre.nom} ({selectedMembre.membre_id})
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Informations financières complètes du membre
                    </CardDescription>
                  </div>
                  <Button variant="ghost" onClick={() => {
                    setShowDetails(false)
                    setEpargneTransactions([])
                    setMemberGroupInfo(null)
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
                            {formatCurrency(membresDetails[selectedMembre.membre_id]?.garantie || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Épargne Totale</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(membresDetails[selectedMembre.membre_id]?.epargne || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Prêt Actif</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(membresDetails[selectedMembre.membre_id]?.pretActif || 0)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Informations sur les remboursements */}
                    {(() => {
                      const echeancier = membresDetails[selectedMembre.membre_id]?.echeancier || []
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
                        <h3 className="text-lg font-semibold">Échéancier du prêt</h3>
                        {membresDetails[selectedMembre.membre_id]?.echeancier.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={viewEcheancier}
                            className="flex items-center gap-2"
                          >
                            <Calendar className="w-4 h-4" />
                            Voir
                          </Button>
                        )}
                      </div>
                      {/* Informations du prêt */}
                      {membresDetails[selectedMembre.membre_id]?.dateDecaissement && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Date d'approbation:</span>
                              <p className="font-medium">
                                {membresDetails[selectedMembre.membre_id]?.dateApprobation 
                                  ? formatDate(membresDetails[selectedMembre.membre_id]?.dateApprobation || '')
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date de décaissement:</span>
                              <p className="font-medium">{formatDate(membresDetails[selectedMembre.membre_id]?.dateDecaissement || '')}</p>
                            </div>
                            {membresDetails[selectedMembre.membre_id]?.dateFin && (
                              <div>
                                <span className="text-muted-foreground">Date de fin:</span>
                                <p className="font-medium">{formatDate(membresDetails[selectedMembre.membre_id]?.dateFin || '')}</p>
                              </div>
                            )}
                            {membresDetails[selectedMembre.membre_id]?.dureeMois !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Durée du prêt:</span>
                                <p className="font-medium">{membresDetails[selectedMembre.membre_id]?.dureeMois} mois</p>
                              </div>
                            )}
                            {membresDetails[selectedMembre.membre_id]?.cycleCredit !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Cycle de crédit:</span>
                                <p className="font-medium">{membresDetails[selectedMembre.membre_id]?.cycleCredit}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {membresDetails[selectedMembre.membre_id]?.echeancier.length === 0 ? (
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
                            {membresDetails[selectedMembre.membre_id]?.echeancier.map((remboursement) => {
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
      </div>
    </DashboardLayout>
  )
}

export default function MembresAssignesPage() {
  return (
    <ProtectedRoute>
      <MembresAssignesContent />
    </ProtectedRoute>
  )
}

