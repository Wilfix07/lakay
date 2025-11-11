'use client'

import { useState, useEffect } from 'react'
import { supabase, type Membre, type Agent, type UserProfile, type Pret, type Remboursement } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
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
import { Plus, X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type MemberLoanHistory = {
  pret_id: string
  montant_pret: number
  date_decaissement: string
  statut: string
  remboursements: {
    id: number
    numero_remboursement: number
    montant: number
    principal: number
    interet: number
    statut: string
    date_remboursement: string
    date_paiement: string | null
  }[]
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
  const [selectedLoanId, setSelectedLoanId] = useState<string>('')
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<MemberLoanHistory | null>(null)
  const [historyMember, setHistoryMember] = useState<Membre | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [formData, setFormData] = useState({
    agent_id: '',
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
  })

  const currentLoan =
    memberLoans.find((loan) => loan.pret_id === selectedLoanId) ?? selectedMemberHistory ?? null

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadAgents()
      loadMembres()
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
      setLoading(true)
      let query = supabase
        .from('membres')
        .select('*')
        .order('created_at', { ascending: false })

      // Les agents ne voient que leurs propres membres
      if (userProfile?.role === 'agent' && userProfile.agent_id) {
        query = query.eq('agent_id', userProfile.agent_id)
      }

      const { data, error } = await query

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
      alert('Erreur lors du chargement des membres')
    } finally {
      setLoading(false)
    }
  }

  function applySelectedLoan(loans: MemberLoanHistory[], loanId?: string) {
    if (loans.length === 0) {
      setSelectedLoanId('')
      setSelectedMemberHistory(null)
      return
    }
    const targetId = loanId ?? loans[0].pret_id
    const loan = loans.find((item) => item.pret_id === targetId) ?? loans[0]
    setSelectedLoanId(loan.pret_id)
    setSelectedMemberHistory(loan)
  }

  async function loadMemberHistory(membre: Membre) {
    try {
      setHistoryLoading(true)
      setHistoryMember(membre)

      const { data: pretsData, error: pretsError } = await supabase
        .from('prets')
        .select('pret_id, montant_pret, date_decaissement, statut')
        .eq('membre_id', membre.membre_id)
        .order('date_decaissement', { ascending: false })

      if (pretsError) throw pretsError

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
        })
        remboursementsByPret.set(remb.pret_id, list)
      }

      const loans =
        pretsData?.map((pret) => ({
          pret_id: pret.pret_id,
          montant_pret: Number(pret.montant_pret || 0),
          date_decaissement: pret.date_decaissement,
          statut: pret.statut || 'actif',
          remboursements: remboursementsByPret.get(pret.pret_id) ?? [],
        })) ?? []

      setMemberLoans(loans)
      applySelectedLoan(loans)
    } catch (error) {
      console.error('Erreur lors du chargement de l’historique des prêts:', error)
      setSelectedMemberHistory(null)
      setMemberLoans([])
    } finally {
      setHistoryLoading(false)
    }
  }

  function handleSelectLoan(pretId: string) {
    applySelectedLoan(memberLoans, pretId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      // Générer le membre_id automatiquement
      const { data: maxMembres } = await supabase
        .from('membres')
        .select('membre_id')
        .order('membre_id', { ascending: false })
        .limit(1)

      let newMembreId = '0000'
      if (maxMembres && maxMembres.length > 0 && maxMembres[0]) {
        const maxNum = parseInt(maxMembres[0].membre_id, 10)
        if (!isNaN(maxNum)) {
          newMembreId = String(maxNum + 1).padStart(4, '0')
        }
      }

      const { error } = await supabase
        .from('membres')
        .insert([{
          membre_id: newMembreId,
          ...formData,
        }])

      if (error) throw error

      alert('Membre créé avec succès!')
      setShowForm(false)
      setFormData({ agent_id: '', nom: '', prenom: '', telephone: '', adresse: '' })
      loadMembres()
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
    // This will be handled by DashboardLayout
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
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Créer un nouveau membre</CardTitle>
              <CardDescription>Remplissez les informations pour créer un nouveau membre</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent_id">Agent de Crédit *</Label>
                  <Select
                    required
                    value={formData.agent_id}
                    onValueChange={(value) => setFormData({ ...formData, agent_id: value })}
                    disabled={userProfile?.role === 'agent'}
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

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des membres</CardTitle>
            <CardDescription>Total: {membres.length} membre(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {membres.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucun membre enregistré</p>
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
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Date création</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membres.map((membre) => (
                        <TableRow key={membre.id}>
                        <TableCell className="font-medium">{membre.membre_id}</TableCell>
                        <TableCell>{membre.agent_id}</TableCell>
                        <TableCell>{membre.nom}</TableCell>
                        <TableCell>{membre.prenom}</TableCell>
                        <TableCell>{membre.telephone || '-'}</TableCell>
                        <TableCell>
                          {new Date(membre.created_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <div className="inline-flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => loadMemberHistory(membre)}
                            >
                              Historique
                            </Button>
                            {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTransferDialog(membre)}
                              >
                                Transférer
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {historyMember && (
          <Card>
            <CardHeader>
              <CardTitle>
                Historique des prêts – {historyMember.prenom} {historyMember.nom} (
                {historyMember.membre_id})
              </CardTitle>
              <CardDescription>
                Suivi des décaissements et remboursements effectués par ce membre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : memberLoans.length === 0 ? (
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
                              {new Date(loan.date_decaissement).toLocaleDateString('fr-FR')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {currentLoan && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border bg-muted/30 px-4 py-3">
                          <p className="text-xs uppercase text-muted-foreground">Montant du prêt</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrency(currentLoan.montant_pret)}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 px-4 py-3">
                          <p className="text-xs uppercase text-muted-foreground">Principal remboursé</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrency(
                              currentLoan.remboursements
                                .filter((r) => r.statut === 'paye' || r.statut === 'paye_partiel')
                                .reduce((sum, r) => sum + Number(r.principal || 0), 0),
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 px-4 py-3">
                          <p className="text-xs uppercase text-muted-foreground">Intérêts payés</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrency(
                              currentLoan.remboursements
                                .filter((r) => r.statut === 'paye' || r.statut === 'paye_partiel')
                                .reduce((sum, r) => sum + Number(r.interet || 0), 0),
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 px-4 py-3">
                          <p className="text-xs uppercase text-muted-foreground">Capital restant</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrency(
                              Math.max(
                                currentLoan.montant_pret -
                                  currentLoan.remboursements
                                    .filter(
                                      (r) =>
                                        r.statut === 'paye' || r.statut === 'paye_partiel',
                                    )
                                    .reduce((sum, r) => sum + Number(r.principal || 0), 0),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                      </div>

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
                              <TableHead>Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentLoan.remboursements.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                                  Aucun remboursement enregistré pour ce prêt.
                                </TableCell>
                              </TableRow>
                            ) : (
                              currentLoan.remboursements.map((remboursement) => (
                                <TableRow key={remboursement.id}>
                                  <TableCell className="whitespace-nowrap text-sm">
                                    {remboursement.numero_remboursement}/23
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
            </CardContent>
          </Card>
        )}

      </div>

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
    </DashboardLayout>
  )
}

export default function MembresPage() {
  return (
    <ProtectedRoute requiredPermission="canCreateMembers">
      <MembresPageContent />
    </ProtectedRoute>
  )
}
