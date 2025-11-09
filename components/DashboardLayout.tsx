'use client'

import { Sidebar } from './Sidebar'
import type { UserProfile } from '@/lib/supabase'

interface DashboardLayoutProps {
  children: React.ReactNode
  userProfile: UserProfile
  onSignOut: () => void
}

export function DashboardLayout({ children, userProfile, onSignOut }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      <Sidebar userProfile={userProfile} onSignOut={onSignOut} />
      <div className="lg:pl-64">
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

