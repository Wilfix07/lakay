'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserProfile, getUserRole, signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { UserProfile as UserProfileType, UserRole } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    agents: 0,
    membres: 0,
    prets: 0,
    remboursements: 0,
    remboursementsPayes: 0,
    montantTotal: 0,
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile) {
      loadStats()
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

  async function loadStats() {
    if (!userProfile) return

    try {
      // Stats pour Admin et Manager (tous les agents)
      if (userProfile.role === 'admin' || userProfile.role === 'manager') {
        const [agentsRes, membresRes, pretsRes, remboursementsRes] = await Promise.all([
          supabase.from('agents').select('id', { count: 'exact', head: true }),
          supabase.from('membres').select('id', { count: 'exact', head: true }),
          supabase.from('prets').select('id, montant_pret', { count: 'exact' }),
          supabase.from('remboursements').select('id, statut', { count: 'exact' }),
        ])

        const montantTotal = pretsRes.data?.reduce((sum, p) => sum + Number(p.montant_pret || 0), 0) || 0
        const remboursementsPayes = remboursementsRes.data?.filter(r => r.statut === 'paye').length || 0

        setStats({
          agents: agentsRes.count || 0,
          membres: membresRes.count || 0,
          prets: pretsRes.count || 0,
          remboursements: remboursementsRes.count || 0,
          remboursementsPayes,
          montantTotal,
        })
      } 
      // Stats pour Agent (seulement ses données)
      else if (userProfile.role === 'agent' && userProfile.agent_id) {
        const [membresRes, pretsRes, remboursementsRes] = await Promise.all([
          supabase.from('membres').select('id', { count: 'exact', head: true }).eq('agent_id', userProfile.agent_id),
          supabase.from('prets').select('id, montant_pret').eq('agent_id', userProfile.agent_id),
          supabase.from('remboursements').select('id, statut').eq('agent_id', userProfile.agent_id),
        ])

        const montantTotal = pretsRes.data?.reduce((sum, p) => sum + Number(p.montant_pret || 0), 0) || 0
        const remboursementsPayes = remboursementsRes.data?.filter(r => r.statut === 'paye').length || 0

        setStats({
          agents: 0,
          membres: membresRes.count || 0,
          prets: pretsRes.data?.length || 0,
          remboursements: remboursementsRes.data?.length || 0,
          remboursementsPayes,
          montantTotal,
        })
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Chargement...</div>
      </div>
    )
  }

  if (!userProfile) {
    return null
  }

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrateur',
    manager: 'Manager',
    agent: 'Agent de Crédit',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-600">
                {roleLabels[userProfile.role]} • {userProfile.email}
                {userProfile.agent_id && ` • Agent: ${userProfile.agent_id}`}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {(userProfile.role === 'admin' || userProfile.role === 'manager') && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-sm text-gray-600 mb-1">Agents</div>
              <div className="text-3xl font-bold text-gray-900">{stats.agents}</div>
            </div>
          )}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Membres</div>
            <div className="text-3xl font-bold text-gray-900">{stats.membres}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Prêts</div>
            <div className="text-3xl font-bold text-gray-900">{stats.prets}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Remboursements</div>
            <div className="text-3xl font-bold text-gray-900">{stats.remboursements}</div>
            <div className="text-sm text-green-600 mt-1">
              {stats.remboursementsPayes} payés
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Montant Total</div>
            <div className="text-3xl font-bold text-gray-900">
              {new Intl.NumberFormat('fr-FR').format(stats.montantTotal)} HTG
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Actions rapides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(userProfile.role === 'admin' || userProfile.role === 'manager') && (
              <>
                <Link
                  href="/utilisateurs"
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
                >
                  <div className="text-2xl mb-2">👤</div>
                  <div className="font-semibold">Gérer les Utilisateurs</div>
                  <div className="text-sm text-gray-600">
                    {userProfile.role === 'admin' ? 'Créer managers et agents' : 'Créer des agents'}
                  </div>
                </Link>
                <Link
                  href="/agents"
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                >
                  <div className="text-2xl mb-2">👥</div>
                  <div className="font-semibold">Gérer les Agents</div>
                  <div className="text-sm text-gray-600">Créer et modifier</div>
                </Link>
              </>
            )}
            {(userProfile.role === 'admin' || userProfile.role === 'agent') && (
              <>
                <Link
                  href="/membres"
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                >
                  <div className="text-2xl mb-2">👤</div>
                  <div className="font-semibold">Gérer les Membres</div>
                  <div className="text-sm text-gray-600">Créer et modifier</div>
                </Link>
                <Link
                  href="/prets"
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                >
                  <div className="text-2xl mb-2">💰</div>
                  <div className="font-semibold">Gérer les Prêts</div>
                  <div className="text-sm text-gray-600">Créer et décaisser</div>
                </Link>
                <Link
                  href="/remboursements"
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                >
                  <div className="text-2xl mb-2">💳</div>
                  <div className="font-semibold">Remboursements</div>
                  <div className="text-sm text-gray-600">Enregistrer les paiements</div>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

