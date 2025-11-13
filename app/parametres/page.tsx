'use client'

import { useEffect, useState } from 'react'
import {
  supabase,
  type UserProfile,
  type LoanAmountBracket,
  type ExpenseCategory,
} from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getUserProfile, signOut } from '@/lib/auth'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCcw, Save, Trash, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ScheduleSettings = {
  totalInstallments: number
  frequencyDays: number
  graceDays: number
  autoGenerate: boolean
}

type InterestSettings = {
  baseInterestRate: number
  penaltyRate: number
  commissionRate: number
}

const DEFAULT_SCHEDULE: ScheduleSettings = {
  totalInstallments: 23,
  frequencyDays: 1,
  graceDays: 0,
  autoGenerate: true,
}

const DEFAULT_INTEREST: InterestSettings = {
  baseInterestRate: 15,
  penaltyRate: 2,
  commissionRate: 30,
}

function ParametresPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null) // null = paramètres globaux
  const [managers, setManagers] = useState<UserProfile[]>([])
  const [scheduleForm, setScheduleForm] = useState<ScheduleSettings>(DEFAULT_SCHEDULE)
  const [interestForm, setInterestForm] = useState<InterestSettings>(DEFAULT_INTEREST)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [interestSaving, setInterestSaving] = useState(false)
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [interestMessage, setInterestMessage] = useState<string | null>(null)

  const [brackets, setBrackets] = useState<LoanAmountBracket[]>([])
  const [bracketForm, setBracketForm] = useState({
    label: '',
    minAmount: '',
    maxAmount: '',
    rate: '',
  })
  const [bracketSaving, setBracketSaving] = useState(false)
  const [bracketMessage, setBracketMessage] = useState<string | null>(null)
  const [editingBracketId, setEditingBracketId] = useState<number | null>(null)

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  })
  const [categorySaving, setCategorySaving] = useState(false)
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)

  const [collateralForm, setCollateralForm] = useState({
    collateralRate: 10,
    refundPolicy: 'automatic',
    description: '',
  })
  const [collateralSaving, setCollateralSaving] = useState(false)
  const [collateralMessage, setCollateralMessage] = useState<string | null>(null)

  // Paramètres business du manager (logo et nom)
  const [businessForm, setBusinessForm] = useState({
    business_name: '',
    logo_url: '',
  })
  const [businessSaving, setBusinessSaving] = useState(false)
  const [businessMessage, setBusinessMessage] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [])

  useEffect(() => {
    if (!userProfile) return
    
    // Si c'est un manager, charger ses propres paramètres
    if (userProfile.role === 'manager') {
      setSelectedManagerId(userProfile.id)
      loadAllSettings(userProfile.id)
      setLoading(false)
      return
    }
    
    // Si c'est un admin, charger les managers et les paramètres globaux
    if (userProfile.role === 'admin') {
      loadManagers()
      loadAllSettings(null) // Charger les paramètres globaux par défaut
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      loadAllSettings(selectedManagerId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedManagerId])

  async function loadUserProfile() {
    const profile = await getUserProfile()
    setUserProfile(profile)
  }

  async function loadManagers() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'manager')
        .order('nom', { ascending: true })

      if (error) throw error
      setManagers(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des managers:', error)
    }
  }

  async function loadBusinessSettings(managerId?: string | null) {
    if (!managerId) return
    
    try {
      const { data, error } = await supabase
        .from('manager_business_settings')
        .select('*')
        .eq('manager_id', managerId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur lors du chargement des paramètres business:', error)
      }

      if (data) {
        setBusinessForm({
          business_name: data.business_name || '',
          logo_url: data.logo_url || '',
        })
      } else {
        setBusinessForm({
          business_name: '',
          logo_url: '',
        })
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres business:', error)
    }
  }

  async function loadAllSettings(managerId?: string | null) {
    try {
      setLoading(true)
      setScheduleMessage(null)
      setInterestMessage(null)
      setBracketMessage(null)
      setCategoryMessage(null)
      
      // Charger les paramètres business si c'est un manager
      if (userProfile?.role === 'manager') {
        await loadBusinessSettings(userProfile.id)
      } else if (userProfile?.role === 'admin' && managerId) {
        await loadBusinessSettings(managerId)
      }

      // Charger les paramètres système pour le manager spécifié (ou globaux si null)
      let settingsQuery = supabase
        .from('system_settings')
        .select('*')
        .in('key', ['schedule', 'interest_rates', 'collateral_settings'])
      
      if (managerId !== null && managerId !== undefined) {
        settingsQuery = settingsQuery.eq('manager_id', managerId)
      } else {
        settingsQuery = settingsQuery.is('manager_id', null)
      }

      // Charger les barèmes et catégories avec filtrage par manager_id
      let bracketsQuery = supabase
        .from('loan_amount_brackets')
        .select('*')
        .eq('is_active', true)
        .order('min_amount', { ascending: true })
      
      let categoriesQuery = supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (managerId !== null && managerId !== undefined) {
        bracketsQuery = bracketsQuery.eq('manager_id', managerId)
        categoriesQuery = categoriesQuery.eq('manager_id', managerId)
      } else {
        bracketsQuery = bracketsQuery.is('manager_id', null)
        categoriesQuery = categoriesQuery.is('manager_id', null)
      }

      const [{ data: settingsData, error: settingsError }, { data: bracketsData, error: bracketsError }, { data: categoriesData, error: categoriesError }] =
        await Promise.all([
          settingsQuery,
          bracketsQuery,
          categoriesQuery,
        ])

      if (settingsError) throw settingsError
      if (bracketsError) throw bracketsError
      if (categoriesError) throw categoriesError

      const scheduleSetting = settingsData?.find((item) => item.key === 'schedule')
      const interestSetting = settingsData?.find((item) => item.key === 'interest_rates')
      const collateralSetting = settingsData?.find((item) => item.key === 'collateral_settings')

      if (scheduleSetting?.value) {
        const value = scheduleSetting.value as Partial<ScheduleSettings>
        setScheduleForm({
          totalInstallments: Number(value.totalInstallments ?? DEFAULT_SCHEDULE.totalInstallments),
          frequencyDays: Number(value.frequencyDays ?? DEFAULT_SCHEDULE.frequencyDays),
          graceDays: Number(value.graceDays ?? DEFAULT_SCHEDULE.graceDays),
          autoGenerate: Boolean(
            value.autoGenerate !== undefined ? value.autoGenerate : DEFAULT_SCHEDULE.autoGenerate,
          ),
        })
      } else {
        setScheduleForm(DEFAULT_SCHEDULE)
      }

      if (interestSetting?.value) {
        const value = interestSetting.value as Partial<InterestSettings>
        setInterestForm({
          baseInterestRate: Number(
            value.baseInterestRate ?? DEFAULT_INTEREST.baseInterestRate,
          ),
          penaltyRate: Number(value.penaltyRate ?? DEFAULT_INTEREST.penaltyRate),
          commissionRate: Number(value.commissionRate ?? DEFAULT_INTEREST.commissionRate),
        })
      } else {
        setInterestForm(DEFAULT_INTEREST)
      }

      setBrackets(
        (bracketsData || []).map((item) => ({
          ...item,
          min_amount: Number(item.min_amount ?? 0),
          max_amount:
            item.max_amount === null || item.max_amount === undefined
              ? null
              : Number(item.max_amount),
          default_interest_rate:
            item.default_interest_rate === null || item.default_interest_rate === undefined
              ? null
              : Number(item.default_interest_rate),
        })),
      )

      setCategories(categoriesData || [])

      if (collateralSetting?.value) {
        const value = collateralSetting.value as any
        setCollateralForm({
          collateralRate: Number(value.collateralRate ?? 10),
          refundPolicy: String(value.refundPolicy ?? 'automatic'),
          description: String(value.description ?? ''),
        })
      } else {
        setCollateralForm({
          collateralRate: 10,
          refundPolicy: 'automatic',
          description: 'Taux de garantie en pourcentage du montant du prêt',
        })
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error)
      setScheduleMessage('Erreur lors du chargement des paramètres')
    } finally {
      setLoading(false)
    }
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userProfile) return
    setScheduleMessage(null)

    if (
      scheduleForm.totalInstallments <= 0 ||
      scheduleForm.frequencyDays <= 0 ||
      scheduleForm.graceDays < 0
    ) {
      setScheduleMessage('Veuillez saisir des valeurs positives.')
      return
    }

    try {
      setScheduleSaving(true)
      
      // Déterminer le manager_id pour la sauvegarde
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      const { error } = await supabase.from('system_settings').upsert(
        {
          key: 'schedule',
          manager_id: managerId,
          value: {
            totalInstallments: scheduleForm.totalInstallments,
            frequencyDays: scheduleForm.frequencyDays,
            graceDays: scheduleForm.graceDays,
            autoGenerate: scheduleForm.autoGenerate,
          },
          description: "Paramètres de l'échéancier des prêts",
          updated_by: userProfile.id,
        },
        {
          onConflict: 'key,manager_id',
        },
      )

      if (error) throw error
      setScheduleMessage("Paramètres d'échéancier enregistrés avec succès.")
      loadAllSettings(managerId)
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'échéancier:", error)
      setScheduleMessage("Erreur lors de l'enregistrement de l'échéancier")
    } finally {
      setScheduleSaving(false)
    }
  }

  async function handleInterestSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userProfile) return
    setInterestMessage(null)

    if (interestForm.baseInterestRate < 0 || interestForm.penaltyRate < 0) {
      setInterestMessage('Veuillez saisir des taux positifs.')
      return
    }

    try {
      setInterestSaving(true)
      
      // Déterminer le manager_id pour la sauvegarde
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      const { error } = await supabase.from('system_settings').upsert(
        {
          key: 'interest_rates',
          manager_id: managerId,
          value: {
            baseInterestRate: interestForm.baseInterestRate,
            penaltyRate: interestForm.penaltyRate,
            commissionRate: interestForm.commissionRate,
          },
          description: "Taux d'intérêts appliqués aux prêts",
          updated_by: userProfile.id,
        },
        {
          onConflict: 'key,manager_id',
        },
      )

      if (error) throw error
      setInterestMessage("Taux d'intérêts enregistrés avec succès.")
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des taux:', error)
      setInterestMessage('Erreur lors de l’enregistrement des taux')
    } finally {
      setInterestSaving(false)
    }
  }

  async function handleCollateralSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userProfile) return
    setCollateralMessage(null)

    if (collateralForm.collateralRate < 0 || collateralForm.collateralRate > 100) {
      setCollateralMessage('Le taux de garantie doit être entre 0 et 100%.')
      return
    }

    try {
      setCollateralSaving(true)
      
      // Déterminer le manager_id pour la sauvegarde
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      const { error } = await supabase.from('system_settings').upsert(
        {
          key: 'collateral_settings',
          manager_id: managerId,
          value: {
            collateralRate: collateralForm.collateralRate,
            refundPolicy: collateralForm.refundPolicy,
            description: collateralForm.description || 'Taux de garantie en pourcentage du montant du prêt',
          },
          description: 'Paramètres de gestion des garanties (collateral) pour les prêts',
          updated_by: userProfile.id,
        },
        {
          onConflict: 'key,manager_id',
        },
      )

      if (error) throw error
      setCollateralMessage('Paramètres de garantie enregistrés avec succès.')
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres de garantie:', error)
      setCollateralMessage('Erreur lors de l\'enregistrement des paramètres de garantie')
    } finally {
      setCollateralSaving(false)
    }
  }

  async function handleAddBracket(e: React.FormEvent) {
    e.preventDefault()
    setBracketMessage(null)

    const min = parseFloat(bracketForm.minAmount || '0')
    const max = bracketForm.maxAmount ? parseFloat(bracketForm.maxAmount) : null
    const rate = bracketForm.rate ? parseFloat(bracketForm.rate) : null

    if (Number.isNaN(min) || min < 0) {
      setBracketMessage('Le montant minimum doit être un nombre positif.')
      return
    }
    if (max !== null && (Number.isNaN(max) || max <= min)) {
      setBracketMessage('Le montant maximum doit être supérieur au minimum.')
      return
    }
    if (rate !== null && rate < 0) {
      setBracketMessage('Le taux doit être positif.')
      return
    }

    try {
      setBracketSaving(true)
      if (!userProfile) return

      // Déterminer le manager_id pour la sauvegarde
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      if (editingBracketId) {
        const { error } = await supabase
          .from('loan_amount_brackets')
          .update({
            label: bracketForm.label || null,
            min_amount: min,
            max_amount: max,
            default_interest_rate: rate,
            manager_id: managerId,
          })
          .eq('id', editingBracketId)

        if (error) throw error
        setBracketMessage('Barème mis à jour.')
      } else {
        const { error } = await supabase.from('loan_amount_brackets').insert({
          label: bracketForm.label || null,
          min_amount: min,
          max_amount: max,
          default_interest_rate: rate,
          manager_id: managerId,
        })
        if (error) throw error
        setBracketMessage('Barème ajouté.')
      }

      setBracketForm({ label: '', minAmount: '', maxAmount: '', rate: '' })
      setEditingBracketId(null)
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du barème:', error)
      setBracketMessage('Erreur lors de la sauvegarde du barème')
    } finally {
      setBracketSaving(false)
    }
  }

  function handleEditBracket(bracket: LoanAmountBracket) {
    setEditingBracketId(bracket.id)
    setBracketForm({
      label: bracket.label ?? '',
      minAmount: bracket.min_amount.toString(),
      maxAmount: bracket.max_amount != null ? bracket.max_amount.toString() : '',
      rate: bracket.default_interest_rate != null ? bracket.default_interest_rate.toString() : '',
    })
  }

  async function handleToggleBracket(id: number, isActive: boolean) {
    try {
      if (!userProfile) return
      
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      const { error } = await supabase
        .from('loan_amount_brackets')
        .update({ is_active: !isActive })
        .eq('id', id)
      if (error) throw error
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors du changement de statut du barème:', error)
      setBracketMessage('Erreur lors du changement de statut')
    }
  }

  async function handleDeleteBracket(id: number) {
    if (!confirm('Supprimer ce barème ?')) return
    try {
      if (!userProfile) return
      
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      const { error } = await supabase.from('loan_amount_brackets').delete().eq('id', id)
      if (error) throw error
      if (editingBracketId === id) {
        setEditingBracketId(null)
        setBracketForm({ label: '', minAmount: '', maxAmount: '', rate: '' })
      }
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors de la suppression du barème:', error)
      setBracketMessage('Erreur lors de la suppression')
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    setCategoryMessage(null)

    if (!categoryForm.name.trim()) {
      setCategoryMessage('Le nom de la catégorie est requis.')
      return
    }

    try {
      setCategorySaving(true)
      if (!userProfile) return

      // Déterminer le manager_id pour la sauvegarde
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      if (editingCategoryId) {
        const { error } = await supabase
          .from('expense_categories')
          .update({
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
            manager_id: managerId,
          })
          .eq('id', editingCategoryId)
        if (error) throw error
        setCategoryMessage('Catégorie mise à jour.')
      } else {
        const { error } = await supabase.from('expense_categories').insert({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          manager_id: managerId,
        })
        if (error) throw error
        setCategoryMessage('Catégorie créée.')
      }

      setCategoryForm({ name: '', description: '' })
      setEditingCategoryId(null)
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la catégorie:', error)
      setCategoryMessage('Erreur lors de la sauvegarde de la catégorie')
    } finally {
      setCategorySaving(false)
    }
  }

  function handleEditCategory(category: ExpenseCategory) {
    setEditingCategoryId(category.id)
    setCategoryForm({
      name: category.name,
      description: category.description ?? '',
    })
  }

  async function handleToggleCategory(id: number, isActive: boolean) {
    try {
      if (!userProfile) return
      
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: !isActive })
        .eq('id', id)
      if (error) throw error
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors du changement de statut de la catégorie:', error)
      setCategoryMessage('Erreur lors du changement de statut')
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm('Supprimer cette catégorie ?')) return
    try {
      if (!userProfile) return
      
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      const { error } = await supabase.from('expense_categories').delete().eq('id', id)
      if (error) throw error
      if (editingCategoryId === id) {
        setEditingCategoryId(null)
        setCategoryForm({ name: '', description: '' })
      }
      loadAllSettings(managerId)
    } catch (error) {
      console.error('Erreur lors de la suppression de la catégorie:', error)
      setCategoryMessage('Erreur lors de la suppression')
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setBusinessMessage('Veuillez sélectionner une image valide')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setBusinessMessage('L\'image ne doit pas dépasser 5 MB')
      return
    }

    try {
      setLogoUploading(true)
      setBusinessMessage(null)

      if (!userProfile) return

      const fileExt = file.name.split('.').pop()
      const fileName = `logo_${userProfile.id}_${Date.now()}.${fileExt}`
      const filePath = `logos/${fileName}`

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        // Si le bucket n'existe pas, utiliser base64
        console.warn('Storage upload failed, using base64:', uploadError)
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result as string
          setBusinessForm(prev => ({ ...prev, logo_url: base64String }))
        }
        reader.readAsDataURL(file)
        setLogoUploading(false)
        return
      }

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('business-assets')
        .getPublicUrl(filePath)

      setBusinessForm(prev => ({ ...prev, logo_url: urlData.publicUrl }))
    } catch (error) {
      console.error('Erreur lors de l\'upload du logo:', error)
      setBusinessMessage('Erreur lors de l\'upload du logo')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userProfile) return
    
    setBusinessMessage(null)

    try {
      setBusinessSaving(true)
      
      const managerId = userProfile.role === 'manager' 
        ? userProfile.id 
        : (userProfile.role === 'admin' ? selectedManagerId : null)

      if (!managerId) {
        setBusinessMessage('Manager ID requis')
        return
      }

      const { error } = await supabase
        .from('manager_business_settings')
        .upsert({
          manager_id: managerId,
          business_name: businessForm.business_name.trim(),
          logo_url: businessForm.logo_url || null,
        }, {
          onConflict: 'manager_id',
        })

      if (error) throw error
      setBusinessMessage('Paramètres business enregistrés avec succès.')
      await loadBusinessSettings(managerId)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres business:', error)
      setBusinessMessage('Erreur lors de l\'enregistrement des paramètres business')
    } finally {
      setBusinessSaving(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      window.location.href = '/login'
    }
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (userProfile.role !== 'admin' && userProfile.role !== 'manager') {
    return (
      <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Accès restreint</CardTitle>
              <CardDescription>
                Cette section est réservée aux administrateurs et managers. Contactez un administrateur si vous
                pensez qu'il s'agit d'une erreur.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userProfile={userProfile} onSignOut={handleSignOut}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Paramètres</h1>
            <p className="text-muted-foreground mt-2">
              {userProfile.role === 'admin' 
                ? 'Configurez l\'échéancier, les taux d\'intérêts, le barème des montants et les catégories de dépenses pour chaque manager séparément.'
                : 'Configurez vos paramètres d\'échéancier, taux d\'intérêts et garanties.'
              }
            </p>
          </div>
          <Button variant="outline" onClick={() => loadAllSettings(selectedManagerId)} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Sélecteur de manager pour les admins */}
        {userProfile.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>Gérer les paramètres par manager</CardTitle>
              <CardDescription>
                Sélectionnez un manager pour gérer ses paramètres spécifiques, ou "Paramètres globaux" pour les paramètres par défaut.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="manager-select">Manager</Label>
                <Select
                  value={selectedManagerId || 'global'}
                  onValueChange={(value) => {
                    setSelectedManagerId(value === 'global' ? null : value)
                  }}
                >
                  <SelectTrigger id="manager-select">
                    <SelectValue placeholder="Sélectionner un manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Paramètres globaux (par défaut)</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.prenom} {manager.nom} ({manager.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedManagerId && (
                  <p className="text-sm text-muted-foreground">
                    Vous configurez les paramètres spécifiques pour ce manager. Ces paramètres remplaceront les paramètres globaux pour tous ses agents.
                  </p>
                )}
                {!selectedManagerId && (
                  <p className="text-sm text-muted-foreground">
                    Vous configurez les paramètres globaux qui seront utilisés par défaut pour tous les managers n'ayant pas de paramètres spécifiques.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Échéancier */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Échéancier des prêts
                      {!loading && (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Chargé depuis la BD
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Définissez le nombre d'échéances et la fréquence des remboursements générés.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadAllSettings}
                    disabled={loading}
                  >
                    <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleScheduleSubmit} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre d'échéances</Label>
                    <Input
                      type="number"
                      min={1}
                      value={scheduleForm.totalInstallments}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          totalInstallments: Number(e.target.value),
                        }))
                      }
                      required
                      className={loading ? 'bg-muted' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Valeur actuelle : {scheduleForm.totalInstallments} échéances
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Fréquence (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={scheduleForm.frequencyDays}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          frequencyDays: Number(e.target.value),
                        }))
                      }
                      required
                      className={loading ? 'bg-muted' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Valeur actuelle : {scheduleForm.frequencyDays}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Jours de grâce</Label>
                    <Input
                      type="number"
                      min={0}
                      value={scheduleForm.graceDays}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          graceDays: Number(e.target.value),
                        }))
                      }
                      required
                      className={loading ? 'bg-muted' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Valeur actuelle : {scheduleForm.graceDays}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Génération automatique</Label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={scheduleForm.autoGenerate ? 'oui' : 'non'}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          autoGenerate: e.target.value === 'oui',
                        }))
                      }
                    >
                      <option value="oui">Oui</option>
                      <option value="non">Non</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Si activé, le système génère automatiquement l’échéancier lors de la création
                      d’un prêt.
                    </p>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <Button type="submit" disabled={scheduleSaving}>
                      {scheduleSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                    {scheduleMessage && (
                      <span className="text-sm text-muted-foreground">{scheduleMessage}</span>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Paramètres Business (Logo et Nom) - Seulement pour les managers */}
            {(userProfile?.role === 'manager' || (userProfile?.role === 'admin' && selectedManagerId)) && (
              <Card>
                <CardHeader>
                  <CardTitle>Informations Business</CardTitle>
                  <CardDescription>
                    Configurez le nom de votre entreprise et votre logo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBusinessSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nom de l'entreprise</Label>
                        <Input
                          type="text"
                          value={businessForm.business_name}
                          onChange={(e) =>
                            setBusinessForm((prev) => ({ ...prev, business_name: e.target.value }))
                          }
                          placeholder="Entrez le nom de votre entreprise"
                          className={loading ? 'bg-muted' : ''}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Logo</Label>
                        <div className="flex items-center gap-4">
                          {businessForm.logo_url && (
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-300">
                              <img
                                src={businessForm.logo_url}
                                alt="Logo"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <label className="cursor-pointer">
                              <span className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
                                {businessForm.logo_url ? 'Changer le logo' : 'Télécharger un logo'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                                disabled={logoUploading}
                              />
                            </label>
                            {logoUploading && (
                              <p className="text-xs text-muted-foreground">Upload en cours...</p>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Formats acceptés : JPG, PNG, GIF (max 5 MB)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={businessSaving}>
                        {businessSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enregistrement...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Enregistrer
                          </>
                        )}
                      </Button>
                      {businessMessage && (
                        <span className={`text-sm ${businessMessage.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
                          {businessMessage}
                        </span>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Taux d'intérêts */}
            <Card>
              <CardHeader>
                <CardTitle>Taux d'intérêts</CardTitle>
                <CardDescription>
                  Gérez les taux standard et pénalités appliqués aux prêts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInterestSubmit} className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Taux d’intérêt de base (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={interestForm.baseInterestRate}
                      onChange={(e) =>
                        setInterestForm((prev) => ({
                          ...prev,
                          baseInterestRate: Number(e.target.value),
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Taux de pénalité (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={interestForm.penaltyRate}
                      onChange={(e) =>
                        setInterestForm((prev) => ({
                          ...prev,
                          penaltyRate: Number(e.target.value),
                        }))
                      }
                      required
                      className={loading ? 'bg-muted' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Actuel : {interestForm.penaltyRate}%
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Commission agents (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={interestForm.commissionRate}
                      onChange={(e) =>
                        setInterestForm((prev) => ({
                          ...prev,
                          commissionRate: Number(e.target.value),
                        }))
                      }
                      required
                      className={loading ? 'bg-muted' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Actuel : {interestForm.commissionRate}% du net mensuel
                    </p>
                  </div>
                  <div className="md:col-span-3 flex items-center gap-3">
                    <Button type="submit" disabled={interestSaving}>
                      {interestSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                    {interestMessage && (
                      <span className="text-sm text-muted-foreground">{interestMessage}</span>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Garanties (Collateral) */}
            <Card>
              <CardHeader>
                <CardTitle>Garanties (Collateral)</CardTitle>
                <CardDescription>
                  Définissez le taux de garantie que les membres doivent déposer lors de l'obtention d'un prêt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCollateralSubmit} className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="collateralRate">Taux de garantie (%)</Label>
                      <Input
                        id="collateralRate"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={collateralForm.collateralRate}
                        onChange={(e) =>
                          setCollateralForm((prev) => ({
                            ...prev,
                            collateralRate: Number(e.target.value),
                          }))
                        }
                        required
                        className={loading ? 'bg-muted' : ''}
                      />
                      <p className="text-xs text-muted-foreground">
                        Actuel : {collateralForm.collateralRate}% du montant du prêt
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        Exemple : Pour un prêt de 10,000 HTG, la garantie sera de {formatCurrency((10000 * collateralForm.collateralRate) / 100)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refundPolicy">Politique de remboursement</Label>
                      <select
                        id="refundPolicy"
                        value={collateralForm.refundPolicy}
                        onChange={(e) =>
                          setCollateralForm((prev) => ({
                            ...prev,
                            refundPolicy: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="automatic">Remboursement automatique</option>
                        <option value="manual">Remboursement manuel</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        {collateralForm.refundPolicy === 'automatic'
                          ? 'La garantie sera remboursée automatiquement à la fin du prêt'
                          : 'La garantie devra être remboursée manuellement par l\'admin'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      type="text"
                      value={collateralForm.description}
                      onChange={(e) =>
                        setCollateralForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Taux de garantie en pourcentage du montant du prêt"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={collateralSaving}>
                      {collateralSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                    {collateralMessage && (
                      <span className={`text-sm ${collateralMessage.includes('succès') ? 'text-green-600' : 'text-red-600'}`}>
                        {collateralMessage}
                      </span>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Barème des montants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Barème des montants
                  {brackets.length > 0 && (
                    <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
                      {brackets.length} barème{brackets.length > 1 ? 's' : ''}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Définissez les limites de montants autorisés ainsi que le taux associé si besoin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleAddBracket} className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={bracketForm.label}
                      onChange={(e) =>
                        setBracketForm((prev) => ({ ...prev, label: e.target.value }))
                      }
                      placeholder="Ex: Micro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Montant min</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={bracketForm.minAmount}
                      onChange={(e) =>
                        setBracketForm((prev) => ({ ...prev, minAmount: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Montant max</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={bracketForm.maxAmount}
                      onChange={(e) =>
                        setBracketForm((prev) => ({ ...prev, maxAmount: e.target.value }))
                      }
                      placeholder="Illimité"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Taux (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={bracketForm.rate}
                      onChange={(e) => setBracketForm((prev) => ({ ...prev, rate: e.target.value }))}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div className="md:col-span-4 flex items-center gap-3">
                    <Button type="submit" disabled={bracketSaving}>
                      {bracketSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          {editingBracketId ? 'Mettre à jour' : 'Ajouter'}
                        </>
                      )}
                    </Button>
                    {editingBracketId && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingBracketId(null)
                          setBracketForm({ label: '', minAmount: '', maxAmount: '', rate: '' })
                        }}
                      >
                        Annuler
                      </Button>
                    )}
                    {bracketMessage && (
                      <span className="text-sm text-muted-foreground">{bracketMessage}</span>
                    )}
                  </div>
                </form>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Montant min</TableHead>
                        <TableHead>Montant max</TableHead>
                        <TableHead>Taux (%)</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brackets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">
                            Aucun barème configuré pour le moment.
                          </TableCell>
                        </TableRow>
                      ) : (
                        brackets.map((bracket) => (
                          <TableRow key={bracket.id}>
                            <TableCell>{bracket.label ?? '-'}</TableCell>
                            <TableCell>{Number(bracket.min_amount).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              {bracket.max_amount != null
                                ? Number(bracket.max_amount).toLocaleString('fr-FR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : 'Illimité'}
                            </TableCell>
                            <TableCell>
                              {bracket.default_interest_rate != null
                                ? Number(bracket.default_interest_rate).toLocaleString('fr-FR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  bracket.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {bracket.is_active ? 'Actif' : 'Inactif'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditBracket(bracket)}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Modifier
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleBracket(bracket.id, bracket.is_active)}
                              >
                                {bracket.is_active ? 'Désactiver' : 'Activer'}
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteBracket(bracket.id)}
                              >
                                <Trash className="w-4 h-4 mr-1" />
                                Supprimer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Catégories de dépenses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Catégories de dépenses
                  {categories.length > 0 && (
                    <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                      {categories.length} catégorie{categories.length > 1 ? 's' : ''}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Organisez les dépenses des agents en définissant vos propres catégories.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleAddCategory} className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Description</Label>
                    <textarea
                      className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md"
                      value={categoryForm.description}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optionnel"
                    />
                  </div>
                  <div className="md:col-span-3 flex items-center gap-3">
                    <Button type="submit" disabled={categorySaving}>
                      {categorySaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          {editingCategoryId ? 'Mettre à jour' : 'Ajouter'}
                        </>
                      )}
                    </Button>
                    {editingCategoryId && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingCategoryId(null)
                          setCategoryForm({ name: '', description: '' })
                        }}
                      >
                        Annuler
                      </Button>
                    )}
                    {categoryMessage && (
                      <span className="text-sm text-muted-foreground">{categoryMessage}</span>
                    )}
                  </div>
                </form>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">
                            Aucune catégorie créée pour le moment.
                          </TableCell>
                        </TableRow>
                      ) : (
                        categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>{category.name}</TableCell>
                            <TableCell>{category.description ?? '-'}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  category.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {category.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCategory(category)}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Modifier
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleCategory(category.id, category.is_active)}
                              >
                                {category.is_active ? 'Désactiver' : 'Activer'}
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteCategory(category.id)}
                              >
                                <Trash className="w-4 h-4 mr-1" />
                                Supprimer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function ParametresPage() {
  return (
    <ProtectedRoute requiredRole={['admin', 'manager']}>
      <ParametresPageContent />
    </ProtectedRoute>
  )
}

