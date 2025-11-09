'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserProfile, signOut } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { UserProfile as UserProfileType } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { 
  Users, 
  UserPlus, 
  CreditCard, 
  DollarSign, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (userProfile) {
      loadStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const statCards = [
    ...(userProfile.role === 'admin' || userProfile.role === 'manager' 
      ? [{
          title: 'Agents',
          value: stats.agents,
          icon: UserPlus,
          description: 'Total agents',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        }]
      : []),
    {
      title: 'Membres',
      value: stats.membres,
      icon: Users,
      description: 'Total membres',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Prêts',
      value: stats.prets,
      icon: CreditCard,
      description: 'Prêts actifs',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Remboursements',
      value: stats.remboursements,
      icon: DollarSign,
      description: `${stats.remboursementsPayes} payés`,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      badge: stats.remboursementsPayes > 0 ? (
        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
          {stats.remboursementsPayes} payés
        </Badge>
      ) : null,
    },
    {
      title: 'Montant Total',
      value: formatCurrency(stats.montantTotal),
      icon: TrendingUp,
      description: 'Total prêté',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ]

  const actionCards = [
    ...(userProfile.role === 'admin' || userProfile.role === 'manager'
      ? [
          {
            title: 'Gérer les Utilisateurs',
            description: userProfile.role === 'admin' ? 'Créer managers et agents' : 'Créer des agents',
            href: '/utilisateurs',
            icon: Users,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            hoverColor: 'hover:bg-purple-100',
          },
          {
            title: 'Gérer les Agents',
            description: 'Créer et modifier les agents',
            href: '/agents',
            icon: UserPlus,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            hoverColor: 'hover:bg-blue-100',
          },
        ]
      : []),
    ...(userProfile.role === 'admin' || userProfile.role === 'agent'
      ? [
          {
            title: 'Gérer les Membres',
            description: 'Créer et modifier les membres',
            href: '/membres',
            icon: Users,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            hoverColor: 'hover:bg-green-100',
          },
          {
            title: 'Gérer les Prêts',
            description: 'Créer et décaisser les prêts',
            href: '/prets',
            icon: CreditCard,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            hoverColor: 'hover:bg-indigo-100',
          },
          {
            title: 'Remboursements',
            description: 'Enregistrer les paiements',
            href: '/remboursements',
            icon: DollarSign,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            hoverColor: 'hover:bg-orange-100',
          },
        ]
      : []),
  ]

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Bienvenue, {userProfile.nom && userProfile.prenom 
            ? `${userProfile.prenom} ${userProfile.nom}`
            : userProfile.email}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  {stat.description}
                  {stat.badge}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Action Cards */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4 text-foreground">
          Actions rapides
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actionCards.map((action, index) => {
            const Icon = action.icon
            return (
              <Link key={index} href={action.href}>
                <Card className={`border transition-all cursor-pointer ${action.hoverColor} hover:shadow-md`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-lg ${action.bgColor}`}>
                        <Icon className={`w-5 h-5 ${action.color}`} />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-base font-semibold mt-4">
                      {action.title}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
