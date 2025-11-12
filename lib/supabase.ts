import { createClient } from '@supabase/supabase-js'

// Récupérer les variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Vérifier que les variables d'environnement sont définies
if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.error('❌ Erreur: Variables d\'environnement Supabase manquantes!')
    console.error('Veuillez créer un fichier .env.local avec:')
    console.error('NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon')
  }
}

// Créer le client Supabase avec gestion de session
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// Types pour TypeScript
export interface Agent {
  id: number
  agent_id: string
  nom: string
  prenom: string
  email?: string
  telephone?: string
  created_at: string
  updated_at: string
}

export interface Membre {
  id: number
  membre_id: string
  agent_id: string
  nom: string
  prenom: string
  telephone?: string
  adresse?: string
  photo_url?: string | null
  created_at: string
  updated_at: string
}

export interface Pret {
  id: number
  pret_id: string
  membre_id: string
  agent_id: string
  montant_pret: number
  montant_remboursement: number
  nombre_remboursements: number
  date_decaissement: string
  date_premier_remboursement: string
  statut: 'en_attente_garantie' | 'actif' | 'termine' | 'annule'
  capital_restant?: number
  frequence_remboursement?: 'journalier' | 'mensuel' | string
  created_at: string
  updated_at: string
}

export interface Remboursement {
  id: number
  pret_id: string
  membre_id: string
  agent_id: string
  numero_remboursement: number
  montant: number
  principal?: number
  interet?: number
  date_remboursement: string
  date_paiement?: string
  statut: 'en_attente' | 'paye' | 'en_retard' | 'paye_partiel'
  created_at: string
  updated_at: string
}

export type UserRole = 'admin' | 'manager' | 'agent'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  agent_id?: string
  nom?: string
  prenom?: string
  created_at: string
  updated_at: string
}

export interface SystemSetting {
  id: number
  key: string
  value: Record<string, any>
  description?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
}

export interface LoanAmountBracket {
  id: number
  label?: string | null
  min_amount: number
  max_amount?: number | null
  default_interest_rate?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ExpenseCategory {
  id: number
  name: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AgentExpense {
  id: number
  agent_id: string
  amount: number
  category?: string | null
  description?: string | null
  expense_date: string
  created_by?: string | null
  created_at: string
  updated_at?: string
}

export interface Collateral {
  id: number
  pret_id: string
  membre_id: string
  montant_requis: number
  montant_depose: number
  montant_restant: number
  statut: 'partiel' | 'complet' | 'rembourse'
  date_depot?: string | null
  date_remboursement?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

