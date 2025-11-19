'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CreditCard,
  DollarSign,
  LogOut,
  Menu,
  ArrowDownRight,
  AlertTriangle,
  CalendarDays,
  PiggyBank,
  Settings,
  Wallet,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useState } from 'react'
import type { UserProfile, UserRole } from '@/lib/supabase'

interface SidebarProps {
  userProfile: UserProfile
  onSignOut: () => void
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  agent: 'Agent de Crédit',
  chef_zone: 'Chef de Zone',
}

export function Sidebar({ userProfile, onSignOut }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const menuItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'manager', 'agent', 'chef_zone'] as UserRole[],
    },
    {
      title: 'Utilisateurs',
      href: '/utilisateurs',
      icon: Users,
      roles: ['admin', 'manager'] as UserRole[],
    },
    {
      title: 'Agents',
      href: '/agents',
      icon: UserPlus,
      roles: ['admin', 'manager'] as UserRole[],
    },
    {
      title: 'Membres',
      href: '/membres',
      icon: Users,
      roles: ['admin', 'agent'] as UserRole[],
    },
    {
      title: 'Prêts',
      href: '/prets',
      icon: CreditCard,
      roles: ['admin', 'agent'] as UserRole[],
    },
    {
      title: 'Approbations',
      href: '/approbations',
      icon: CheckCircle2,
      roles: ['admin', 'manager'] as UserRole[],
    },
    {
      title: 'Remboursements',
      href: '/remboursements',
      icon: DollarSign,
      roles: ['admin', 'agent'] as UserRole[],
    },
    {
      title: 'Remboursements du jour',
      href: '/remboursements/aujourdhui',
      icon: CalendarDays,
      roles: ['admin', 'manager', 'agent'] as UserRole[],
    },
    {
      title: 'Garanties',
      href: '/collaterals',
      icon: Wallet,
      roles: ['admin', 'manager', 'agent'] as UserRole[],
    },
    {
      title: 'Épargnes',
      href: '/epargne',
      icon: PiggyBank,
      roles: ['admin', 'manager', 'agent'] as UserRole[],
    },
    {
      title: 'Profit & Loss',
      href: '/pnl',
      icon: PiggyBank,
      roles: ['admin', 'manager', 'agent'] as UserRole[],
    },
    {
      title: 'Impayés',
      href: '/impayes',
      icon: AlertTriangle,
      roles: ['admin', 'manager', 'agent'] as UserRole[],
    },
    {
      title: 'Paramètres',
      href: '/parametres',
      icon: Settings,
      roles: ['admin', 'manager'] as UserRole[],
    },
    {
      title: 'Dépenses',
      href: '/expenses',
      icon: ArrowDownRight,
      roles: ['admin', 'manager', 'agent'] as UserRole[],
    },
    {
      title: 'Membres Assignés',
      href: '/membres-assignes',
      icon: Users,
      roles: ['chef_zone'] as UserRole[],
    },
    {
      title: 'Présences',
      href: '/presences',
      icon: CalendarDays,
      roles: ['chef_zone'] as UserRole[],
    },
    {
      title: 'Assigner Membres',
      href: '/assigner-membres-chef-zone',
      icon: UserPlus,
      roles: ['admin', 'manager'] as UserRole[],
    },
  ].filter(item => item.roles.includes(userProfile.role))

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
          <span className="text-lg font-bold">L</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">LAKAY</h1>
          <p className="text-xs text-muted-foreground">Microcrédit</p>
        </div>
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive 
                  ? "bg-primary text-primary-foreground font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.title}</span>
            </Link>
          )
        })}
      </nav>

      <Separator className="flex-shrink-0" />

      {/* User Section */}
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {userProfile.nom?.[0]?.toUpperCase() || userProfile.email[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {userProfile.nom && userProfile.prenom 
                ? `${userProfile.prenom} ${userProfile.nom}`
                : userProfile.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {roleLabels[userProfile.role]}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full mt-3 justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}

