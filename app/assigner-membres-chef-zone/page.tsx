'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Membre, type UserProfile, type ChefZoneMembre } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, UserPlus, X } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function AssignerMembresChefZoneContent() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [chefsZone, setChefsZone] = useState<UserProfile[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [selectedChefZone, setSelectedChefZone] = useState<string>('')
  const [assignations, setAssignations] = useState<Record<string, string[]>>({}) // chef_zone_id -> membre_ids[]
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile && (userProfile.role === 'admin' || userProfile.role === 'manager')) {
      loadChefsZone()
      loadMembres()
      loadAssignations()
    }
  }, [userProfile])

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

  async function loadChefsZone() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'chef_zone')
        .order('nom', { ascending: true })

      if (error) throw error
      setChefsZone(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des chefs de zone:', error)
    }
  }

  async function loadMembres() {
    try {
      const { data, error } = await supabase
        .from('membres')
        .select('*')
        .order('membre_id', { ascending: true })

      if (error) throw error
      setMembres(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error)
    }
  }

  async function loadAssignations() {
    try {
      const { data, error } = await supabase
        .from('chef_zone_membres')
        .select('chef_zone_id, membre_id')

      if (error) throw error

      const assignationsMap: Record<string, string[]> = {}
      for (const assignation of data || []) {
        if (!assignationsMap[assignation.chef_zone_id]) {
          assignationsMap[assignation.chef_zone_id] = []
        }
        assignationsMap[assignation.chef_zone_id].push(assignation.membre_id)
      }
      setAssignations(assignationsMap)
    } catch (error) {
      console.error('Erreur lors du chargement des assignations:', error)
    }
  }

  async function handleAssignMembre(chefZoneId: string, membreId: string) {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { error: insertError } = await supabase
        .from('chef_zone_membres')
        .insert({
          chef_zone_id: chefZoneId,
          membre_id: membreId,
          assigned_by: userProfile?.id,
        })

      if (insertError) {
        // Si c'est une erreur de clé dupliquée, ignorer
        if (insertError.code !== '23505') {
          throw insertError
        }
      }

      setSuccess('Membre assigné avec succès')
      setTimeout(() => setSuccess(''), 3000)
      await loadAssignations()
    } catch (error: any) {
      console.error('Erreur lors de l\'assignation:', error)
      setError(error.message || 'Erreur lors de l\'assignation')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  async function handleUnassignMembre(chefZoneId: string, membreId: string) {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const { error: deleteError } = await supabase
        .from('chef_zone_membres')
        .delete()
        .eq('chef_zone_id', chefZoneId)
        .eq('membre_id', membreId)

      if (deleteError) throw deleteError

      setSuccess('Membre retiré avec succès')
      setTimeout(() => setSuccess(''), 3000)
      await loadAssignations()
    } catch (error: any) {
      console.error('Erreur lors du retrait:', error)
      setError(error.message || 'Erreur lors du retrait')
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

  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'manager')) {
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
            <h1 className="text-3xl font-bold tracking-tight">Assigner des Membres aux Chefs de Zone</h1>
            <p className="text-muted-foreground mt-2">
              Gérez les assignations de membres aux chefs de zone
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

        {chefsZone.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Aucun chef de zone n'a été créé. Créez-en un dans la page Utilisateurs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {chefsZone.map((chef) => {
              const membresAssignes = assignations[chef.id] || []
              const membresNonAssignes = membres.filter(
                (m) => !membresAssignes.includes(m.membre_id)
              )

              return (
                <Card key={chef.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          {chef.prenom} {chef.nom} ({chef.email})
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {membresAssignes.length} membre(s) assigné(s)
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">Chef de Zone</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {membresAssignes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Membres assignés</h3>
                        <div className="flex flex-wrap gap-2">
                          {membresAssignes.map((membreId) => {
                            const membre = membres.find((m) => m.membre_id === membreId)
                            return (
                              <Badge
                                key={membreId}
                                variant="default"
                                className="flex items-center gap-2"
                              >
                                {membre
                                  ? `${membre.prenom || ''} ${membre.nom || ''} (${membre.membre_id})`
                                  : membreId}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 hover:bg-red-100"
                                  onClick={() => handleUnassignMembre(chef.id, membreId)}
                                  disabled={saving}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {membresNonAssignes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Assigner un membre</h3>
                        <div className="flex flex-wrap gap-2">
                          {membresNonAssignes.map((membre) => (
                            <Button
                              key={membre.membre_id}
                              size="sm"
                              variant="outline"
                              onClick={() => handleAssignMembre(chef.id, membre.membre_id)}
                              disabled={saving}
                            >
                              <UserPlus className="w-4 h-4 mr-1" />
                              {membre.prenom || ''} {membre.nom || ''} ({membre.membre_id})
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {membresNonAssignes.length === 0 && membresAssignes.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Tous les membres sont assignés à ce chef de zone
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function AssignerMembresChefZonePage() {
  return (
    <ProtectedRoute>
      <AssignerMembresChefZoneContent />
    </ProtectedRoute>
  )
}

