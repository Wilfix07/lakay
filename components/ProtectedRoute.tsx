'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserProfile, getUserRole, PERMISSIONS, type UserRole } from '@/lib/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole | UserRole[]
  requiredPermission?: keyof typeof PERMISSIONS.admin
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  requiredPermission 
}: ProtectedRouteProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const profile = await getUserProfile()
      
      if (!profile) {
        router.push('/login')
        return
      }

      // Vérifier le rôle si requis
      if (requiredRole) {
        const userRole = profile.role
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
        
        if (!roles.includes(userRole)) {
          router.push('/dashboard')
          return
        }
      }

      // Vérifier la permission si requise
      if (requiredPermission) {
        const userRole = profile.role
        const hasPermission = PERMISSIONS[userRole]?.[requiredPermission]
        
        if (!hasPermission) {
          router.push('/dashboard')
          return
        }
      }

      setAuthorized(true)
    } catch (error) {
      console.error('Erreur de vérification:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Vérification...</div>
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return <>{children}</>
}

