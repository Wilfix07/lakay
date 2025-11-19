'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Membre, type Presence, type UserProfile, type ChefZoneMembre } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, CheckCircle2, XCircle, Users, CalendarDays } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Composant pour gérer l'état des notes par membre
function MembrePresenceRow({
  membre,
  presence,
  onTogglePresence,
  onSaveNotes,
  saving,
}: {
  membre: Membre
  presence?: Presence
  onTogglePresence: (membreId: string, present: boolean) => void
  onSaveNotes: (membreId: string, notes: string) => void
  saving: boolean
}) {
  const [notes, setNotes] = useState(presence?.notes || '')
  const [showNotesInput, setShowNotesInput] = useState(false)

  const isPresent = presence?.present || false

  return (
    <TableRow>
      <TableCell className="font-medium">{membre.membre_id}</TableCell>
      <TableCell>{membre.nom || '-'}</TableCell>
      <TableCell>{membre.prenom || '-'}</TableCell>
      <TableCell>
        <Badge
          variant={isPresent ? 'default' : 'destructive'}
          className="flex items-center gap-1 w-fit"
        >
          {isPresent ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              Présent
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3" />
              Absent
            </>
          )}
        </Badge>
      </TableCell>
      <TableCell>
        {showNotesInput ? (
          <div className="flex gap-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajouter des notes..."
              className="min-w-[200px]"
              rows={2}
            />
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                onClick={() => {
                  onSaveNotes(membre.membre_id, notes)
                  setShowNotesInput(false)
                }}
                disabled={saving}
              >
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNotesInput(false)
                  setNotes(presence?.notes || '')
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {presence?.notes || 'Aucune note'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNotesInput(true)}
            >
              {presence?.notes ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isPresent ? 'outline' : 'default'}
            onClick={() => onTogglePresence(membre.membre_id, !isPresent)}
            disabled={saving}
            className={isPresent ? '' : 'bg-green-600 hover:bg-green-700'}
          >
            {isPresent ? (
              <>
                <XCircle className="w-4 h-4 mr-1" />
                Marquer absent
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Marquer présent
              </>
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function PresencesContent() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [membres, setMembres] = useState<Membre[]>([])
  const [presences, setPresences] = useState<Record<string, Presence>>({})
  const [dateAppel, setDateAppel] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadMembresAssignes()
      loadPresences()
    }
  }, [userProfile, dateAppel])

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

  async function loadMembresAssignes() {
    if (!userProfile || userProfile.role !== 'chef_zone') return

    try {
      // Charger les membres assignés au chef de zone
      const { data: assignations, error: assignationsError } = await supabase
        .from('chef_zone_membres')
        .select('membre_id')
        .eq('chef_zone_id', userProfile.id)

      if (assignationsError) throw assignationsError

      const membreIds = assignations?.map(a => a.membre_id) || []
      
      if (membreIds.length === 0) {
        setMembres([])
        return
      }

      // Charger les détails des membres
      const { data: membresData, error: membresError } = await supabase
        .from('membres')
        .select('*')
        .in('membre_id', membreIds)
        .order('membre_id', { ascending: true })

      if (membresError) throw membresError
      setMembres(membresData || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres assignés:', error)
      alert('Erreur lors du chargement des membres assignés')
    }
  }

  async function loadPresences() {
    if (!userProfile || userProfile.role !== 'chef_zone') return

    try {
      const { data: presencesData, error: presencesError } = await supabase
        .from('presences')
        .select('*')
        .eq('chef_zone_id', userProfile.id)
        .eq('date_appel', dateAppel)

      if (presencesError) throw presencesError

      // Créer un map pour accès rapide
      const presencesMap: Record<string, Presence> = {}
      for (const presence of presencesData || []) {
        presencesMap[presence.membre_id] = presence
      }
      setPresences(presencesMap)
    } catch (error) {
      console.error('Erreur lors du chargement des présences:', error)
    }
  }

  async function handleTogglePresence(membreId: string, present: boolean) {
    if (!userProfile) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const existingPresence = presences[membreId]

      if (existingPresence) {
        // Mettre à jour la présence existante
        const { error: updateError } = await supabase
          .from('presences')
          .update({
            present,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPresence.id)

        if (updateError) throw updateError
      } else {
        // Créer une nouvelle présence
        const { error: insertError } = await supabase
          .from('presences')
          .insert({
            chef_zone_id: userProfile.id,
            membre_id: membreId,
            date_appel: dateAppel,
            present,
          })

        if (insertError) throw insertError
      }

      setSuccess(`Présence ${present ? 'enregistrée' : 'marquée absente'} avec succès`)
      setTimeout(() => setSuccess(''), 3000)
      
      // Recharger les présences
      await loadPresences()
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde de la présence:', error)
      setError(error.message || 'Erreur lors de la sauvegarde de la présence')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes(membreId: string, notes: string) {
    if (!userProfile) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const existingPresence = presences[membreId]

      if (existingPresence) {
        // Mettre à jour les notes
        const { error: updateError } = await supabase
          .from('presences')
          .update({
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPresence.id)

        if (updateError) throw updateError
      } else {
        // Créer une nouvelle présence avec notes
        const { error: insertError } = await supabase
          .from('presences')
          .insert({
            chef_zone_id: userProfile.id,
            membre_id: membreId,
            date_appel: dateAppel,
            present: false,
            notes: notes || null,
          })

        if (insertError) throw insertError
      }

      setSuccess('Notes enregistrées avec succès')
      setTimeout(() => setSuccess(''), 3000)
      
      // Recharger les présences
      await loadPresences()
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde des notes:', error)
      setError(error.message || 'Erreur lors de la sauvegarde des notes')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
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

  const presentCount = Object.values(presences).filter(p => p.present).length
  const absentCount = membres.length - presentCount

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={() => router.push('/login')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestion des Présences</h1>
            <p className="text-muted-foreground mt-2">
              Appels nominaux - Marquer la présence des membres assignés
            </p>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
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
              <CardTitle className="text-sm font-medium">Présents</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absents</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{absentCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Appel Nominal</CardTitle>
                <CardDescription className="mt-2">
                  Sélectionnez la date de l'appel et marquez la présence de chaque membre
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="date-appel">Date de l'appel:</Label>
                  <Input
                    id="date-appel"
                    type="date"
                    value={dateAppel}
                    onChange={(e) => setDateAppel(e.target.value)}
                    className="w-auto"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {membres.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">
                  Aucun membre ne vous est actuellement assigné
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Membre</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Présence</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membres.map((membre) => {
                    const presence = presences[membre.membre_id]
                    return (
                      <MembrePresenceRow
                        key={membre.membre_id}
                        membre={membre}
                        presence={presence}
                        onTogglePresence={handleTogglePresence}
                        onSaveNotes={handleSaveNotes}
                        saving={saving}
                      />
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function PresencesPage() {
  return (
    <ProtectedRoute>
      <PresencesContent />
    </ProtectedRoute>
  )
}

