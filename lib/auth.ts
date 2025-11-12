import { supabase, type UserProfile, type UserRole } from './supabase'

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !data) return null
  return data as UserProfile
}

export async function getUserRole(): Promise<UserRole | null> {
  const profile = await getUserProfile()
  return profile?.role || null
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signOut() {
  try {
    // Déconnexion de Supabase
    const { error } = await supabase.auth.signOut()
    
    // Nettoyer le localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }
    
    return { error }
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error)
    return { error: error as Error }
  }
}

export function hasPermission(userRole: UserRole | null, requiredRole: UserRole | UserRole[]): boolean {
  if (!userRole) return false
  
  const roles: UserRole[] = ['admin', 'manager', 'agent']
  const userRoleIndex = roles.indexOf(userRole)
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.some(role => {
      const requiredRoleIndex = roles.indexOf(role)
      return userRoleIndex <= requiredRoleIndex
    })
  }
  
  const requiredRoleIndex = roles.indexOf(requiredRole)
  return userRoleIndex <= requiredRoleIndex
}

// Permissions par rôle
export const PERMISSIONS = {
  admin: {
    canCreateAgents: true,
    canCreateMembers: true,
    canCreatePrets: true,
    canProcessRemboursements: true,
    canViewAll: true,
    canCreateUsers: true, // Admin peut créer managers et agents
  },
  manager: {
    canCreateAgents: true,
    canCreateMembers: false,
    canCreatePrets: false,
    canProcessRemboursements: false,
    canViewAll: true,
    canCreateUsers: true, // Manager peut créer des agents
  },
  agent: {
    canCreateAgents: false,
    canCreateMembers: true,
    canCreatePrets: true,
    canProcessRemboursements: true,
    canViewAll: false,
    canCreateUsers: false,
  },
} as const

