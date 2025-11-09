'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function checkAuth() {
    try {
      // Vérifier si un admin existe
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)

      // Si aucun admin n'existe, rediriger vers la connexion
      if (!admins || admins.length === 0) {
        router.push('/login')
        return
      }

      // Vérifier si l'utilisateur est connecté
      const profile = await getUserProfile()
      if (profile) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Erreur:', error)
      router.push('/login')
    } finally {
      setChecking(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Vérification...</div>
      </div>
    )
  }

  return null
}
