import { supabase } from './supabase'

/**
 * Paramètres par défaut du système
 */
export const DEFAULT_SETTINGS = {
  schedule: {
    totalInstallments: 23,
    frequencyDays: 1,
    graceDays: 0,
    autoGenerate: true,
  },
  interestRates: {
    baseInterestRate: 0.15, // 15%
    penaltyRate: 0.02, // 2%
    commissionRate: 0.30, // 30%
  },
}

const DEFAULT_LOCALIZATION_SETTINGS = {
  currencyCode: 'HTG',
  currencySymbol: 'HTG',
  locale: 'fr-FR',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'America/Port-au-Prince',
  appLanguage: 'fr',
}

const DEFAULT_APP_SETTINGS = {
  businessName: 'Lakay',
  logoUrl: null as string | null,
  appTitle: 'Système de Microcrédit - Lakay',
  appDescription: 'Gestion de microcrédit avec remboursements quotidiens',
  appLanguage: 'fr',
}

function logSupabaseError(context: string, error?: { code?: string } | null) {
  if (!error || error.code === 'PGRST116') return
  console.error(`[Supabase] ${context}:`, error)
}

async function getActiveSession(context: string) {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error(`[Supabase] ${context} - session error:`, error)
      return null
    }
    return data.session
  } catch (error) {
    console.error(`[Supabase] ${context} - session exception:`, error)
    return null
  }
}

async function fetchBusinessSettingsRow<T>(
  columns: string,
  managerId?: string | null,
) {
  let query = supabase.from('manager_business_settings').select(columns)

  if (managerId !== undefined) {
    query = managerId === null ? query.is('manager_id', null) : query.eq('manager_id', managerId)
  } else {
    const detectedManagerId = await getCurrentUserManagerId()
    query = detectedManagerId ? query.eq('manager_id', detectedManagerId) : query.is('manager_id', null)
  }

  return query.limit(1).maybeSingle<T>()
}

function getDefaultLocalization() {
  return { ...DEFAULT_LOCALIZATION_SETTINGS }
}

function getDefaultAppSettings() {
  return { ...DEFAULT_APP_SETTINGS }
}

/**
 * Fonction utilitaire pour obtenir le manager_id de l'utilisateur actuel
 * Retourne le manager_id si l'utilisateur est un manager ou un agent
 */
async function getCurrentUserManagerId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, id, agent_id')
      .eq('id', user.id)
      .single()

    if (!profile) return null

    // Si c'est un manager, retourner son id
    if (profile.role === 'manager') {
      return profile.id
    }

    // Si c'est un agent, obtenir le manager_id via son agent_id
    if (profile.role === 'agent' && profile.agent_id) {
      const { data: agent } = await supabase
        .from('agents')
        .select('manager_id')
        .eq('agent_id', profile.agent_id)
        .single()

      return agent?.manager_id || null
    }

    return null
  } catch (error) {
    console.error('Erreur lors de la récupération du manager_id:', error)
    return null
  }
}

/**
 * Récupère les paramètres d'échéancier depuis la base de données
 * @param managerId - ID du manager (optionnel). Si null, charge les paramètres globaux ou du manager actuel
 */
export async function getScheduleSettings(managerId?: string | null) {
  try {
    let query = supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'schedule')

    // Si managerId est fourni, chercher les paramètres spécifiques à ce manager
    // Sinon, détecter automatiquement le manager_id de l'utilisateur actuel
    if (managerId !== undefined) {
      query = query.eq('manager_id', managerId)
    } else {
      // Détecter automatiquement le manager_id (pour managers et agents)
      const detectedManagerId = await getCurrentUserManagerId()
      
      if (detectedManagerId) {
        query = query.eq('manager_id', detectedManagerId)
      } else {
        // Si aucun manager détecté, charger les paramètres globaux
        query = query.is('manager_id', null)
      }
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la récupération des paramètres d\'échéancier:', error)
    }

    if (data?.value) {
      return {
        totalInstallments: Number(data.value.totalInstallments ?? DEFAULT_SETTINGS.schedule.totalInstallments),
        frequencyDays: Number(data.value.frequencyDays ?? DEFAULT_SETTINGS.schedule.frequencyDays),
        graceDays: Number(data.value.graceDays ?? DEFAULT_SETTINGS.schedule.graceDays),
        autoGenerate: Boolean(data.value.autoGenerate ?? DEFAULT_SETTINGS.schedule.autoGenerate),
      }
    }

    return DEFAULT_SETTINGS.schedule
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres d\'échéancier:', error)
    return DEFAULT_SETTINGS.schedule
  }
}

/**
 * Récupère les taux d'intérêt depuis la base de données
 * @param managerId - ID du manager (optionnel). Si null, charge les paramètres globaux ou du manager actuel
 */
export async function getInterestRates(managerId?: string | null) {
  try {
    let query = supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'interest_rates')

    // Si managerId est fourni, chercher les paramètres spécifiques à ce manager
    // Sinon, détecter automatiquement le manager_id de l'utilisateur actuel
    if (managerId !== undefined) {
      query = query.eq('manager_id', managerId)
    } else {
      // Détecter automatiquement le manager_id (pour managers et agents)
      const detectedManagerId = await getCurrentUserManagerId()
      
      if (detectedManagerId) {
        query = query.eq('manager_id', detectedManagerId)
      } else {
        // Si aucun manager détecté, charger les paramètres globaux
        query = query.is('manager_id', null)
      }
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la récupération des taux d\'intérêt:', error)
    }

    if (data?.value) {
      return {
        baseInterestRate: Number(data.value.baseInterestRate ?? DEFAULT_SETTINGS.interestRates.baseInterestRate) / 100,
        penaltyRate: Number(data.value.penaltyRate ?? DEFAULT_SETTINGS.interestRates.penaltyRate) / 100,
        commissionRate: Number(data.value.commissionRate ?? DEFAULT_SETTINGS.interestRates.commissionRate) / 100,
      }
    }

    return DEFAULT_SETTINGS.interestRates
  } catch (error) {
    console.error('Erreur lors de la récupération des taux d\'intérêt:', error)
    return DEFAULT_SETTINGS.interestRates
  }
}

/**
 * Récupère les barèmes de montants actifs
 * @param managerId - ID du manager (optionnel). Si null, charge les barèmes globaux ou du manager actuel
 */
export async function getLoanAmountBrackets(managerId?: string | null) {
  try {
    let query = supabase
      .from('loan_amount_brackets')
      .select('*')
      .eq('is_active', true)

    // Si managerId est fourni, chercher les barèmes spécifiques à ce manager
    // Sinon, détecter automatiquement le manager_id de l'utilisateur actuel
    if (managerId !== undefined) {
      query = query.eq('manager_id', managerId)
    } else {
      // Détecter automatiquement le manager_id (pour managers et agents)
      const detectedManagerId = await getCurrentUserManagerId()
      
      if (detectedManagerId) {
        query = query.eq('manager_id', detectedManagerId)
      } else {
        // Si aucun manager détecté, charger les barèmes globaux
        query = query.is('manager_id', null)
      }
    }

    const { data, error } = await query.order('min_amount', { ascending: true })

    if (error) {
      console.error('Erreur lors de la récupération des barèmes:', error)
      return []
    }

    return (data || []).map((item) => ({
      id: item.id,
      label: item.label,
      min_amount: Number(item.min_amount ?? 0),
      max_amount: item.max_amount === null ? null : Number(item.max_amount),
      default_interest_rate: item.default_interest_rate === null ? null : Number(item.default_interest_rate),
      is_active: item.is_active,
      manager_id: item.manager_id,
    }))
  } catch (error) {
    console.error('Erreur lors de la récupération des barèmes:', error)
    return []
  }
}

/**
 * Trouve le barème approprié pour un montant donné
 */
export function findBracketForAmount(brackets: any[], amount: number) {
  for (const bracket of brackets) {
    const minAmount = Number(bracket.min_amount ?? 0)
    const maxAmount = bracket.max_amount === null ? Infinity : Number(bracket.max_amount)

    if (amount >= minAmount && amount <= maxAmount) {
      return bracket
    }
  }
  return null
}

/**
 * Récupère les catégories de dépenses actives
 * @param managerId - ID du manager (optionnel). Si null, charge les catégories globales ou du manager actuel
 */
export async function getExpenseCategories(managerId?: string | null) {
  try {
    let query = supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)

    // Si managerId est fourni, chercher les catégories spécifiques à ce manager
    // Sinon, détecter automatiquement le manager_id de l'utilisateur actuel
    if (managerId !== undefined) {
      query = query.eq('manager_id', managerId)
    } else {
      // Détecter automatiquement le manager_id (pour managers et agents)
      const detectedManagerId = await getCurrentUserManagerId()
      
      if (detectedManagerId) {
        query = query.eq('manager_id', detectedManagerId)
      } else {
        // Si aucun manager détecté, charger les catégories globales
        query = query.is('manager_id', null)
      }
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Erreur lors de la récupération des catégories:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error)
    return []
  }
}

/**
 * Calcule les intérêts en utilisant le taux configuré
 */
export async function calculateInterest(principal: number, customRate?: number) {
  if (customRate !== undefined) {
    return principal * customRate
  }

  const rates = await getInterestRates()
  return principal * rates.baseInterestRate
}

/**
 * Valide qu'un montant de prêt est dans les limites autorisées
 */
export async function validateLoanAmount(amount: number): Promise<{ valid: boolean; message?: string; suggestedRate?: number }> {
  const brackets = await getLoanAmountBrackets()

  if (brackets.length === 0) {
    return { valid: true }
  }

  const bracket = findBracketForAmount(brackets, amount)

  if (!bracket) {
    const minBracket = brackets[0]
    const maxBracket = brackets[brackets.length - 1]
    const minAmount = minBracket?.min_amount ?? 0
    const maxAmount = maxBracket?.max_amount

    if (maxAmount === null) {
      return {
        valid: false,
        message: `Le montant doit être au moins ${minAmount.toLocaleString('fr-FR')} HTG`,
      }
    } else {
      return {
        valid: false,
        message: `Le montant doit être entre ${minAmount.toLocaleString('fr-FR')} HTG et ${maxAmount.toLocaleString('fr-FR')} HTG`,
      }
    }
  }

  return {
    valid: true,
    suggestedRate: bracket.default_interest_rate,
  }
}

/**
 * Récupère les paramètres de garantie (collateral) depuis la base de données
 * @param managerId - ID du manager (optionnel). Si null, charge les paramètres globaux ou du manager actuel
 */
export async function getCollateralSettings(managerId?: string | null) {
  try {
    let query = supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'collateral_settings')

    // Si managerId est fourni, chercher les paramètres spécifiques à ce manager
    // Sinon, détecter automatiquement le manager_id de l'utilisateur actuel
    if (managerId !== undefined) {
      query = query.eq('manager_id', managerId)
    } else {
      // Détecter automatiquement le manager_id (pour managers et agents)
      const detectedManagerId = await getCurrentUserManagerId()
      
      if (detectedManagerId) {
        query = query.eq('manager_id', detectedManagerId)
      } else {
        // Si aucun manager détecté, charger les paramètres globaux
        query = query.is('manager_id', null)
      }
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la récupération des paramètres de garantie:', error)
    }

    if (data?.value) {
      return {
        collateralRate: Number(data.value.collateralRate ?? 10),
        refundPolicy: String(data.value.refundPolicy ?? 'automatic'),
        description: String(data.value.description ?? ''),
      }
    }

    return {
      collateralRate: 10, // 10% par défaut
      refundPolicy: 'automatic',
      description: 'Taux de garantie en pourcentage du montant du prêt',
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres de garantie:', error)
    return {
      collateralRate: 10,
      refundPolicy: 'automatic',
      description: 'Taux de garantie en pourcentage du montant du prêt',
    }
  }
}

/**
 * Calcule le montant de garantie requis pour un prêt
 */
export async function calculateCollateralAmount(loanAmount: number, customRate?: number): Promise<number> {
  if (customRate !== undefined) {
    return (loanAmount * customRate) / 100
  }

  const settings = await getCollateralSettings()
  return (loanAmount * settings.collateralRate) / 100
}

/**
 * Récupère les paramètres de localisation depuis manager_business_settings
 * @param managerId - ID du manager (optionnel). Si null, charge les paramètres globaux ou du manager actuel
 */
export async function getLocalizationSettings(managerId?: string | null) {
  try {
    const session = await getActiveSession('getLocalizationSettings')
    if (!session) {
      return getDefaultLocalization()
    }

    const { data, error } = await fetchBusinessSettingsRow<{
      currency_code: string | null
      currency_symbol: string | null
      locale: string | null
      date_format: string | null
      timezone: string | null
      app_language: string | null
    }>(
      'currency_code, currency_symbol, locale, date_format, timezone, app_language',
      managerId,
    )

    logSupabaseError('getLocalizationSettings', error)

    if (data) {
      return {
        currencyCode: data.currency_code || DEFAULT_LOCALIZATION_SETTINGS.currencyCode,
        currencySymbol: data.currency_symbol || DEFAULT_LOCALIZATION_SETTINGS.currencySymbol,
        locale: data.locale || DEFAULT_LOCALIZATION_SETTINGS.locale,
        dateFormat: data.date_format || DEFAULT_LOCALIZATION_SETTINGS.dateFormat,
        timezone: data.timezone || DEFAULT_LOCALIZATION_SETTINGS.timezone,
        appLanguage: data.app_language || DEFAULT_LOCALIZATION_SETTINGS.appLanguage,
      }
    }

    return getDefaultLocalization()
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres de localisation:', error)
    return getDefaultLocalization()
  }
}

/**
 * Récupère les noms des mois depuis la base de données
 * @param managerId - ID du manager (optionnel). Si null, charge les noms globaux ou du manager actuel
 */
export async function getMonthNames(managerId?: string | null) {
  try {
    const session = await getActiveSession('getMonthNames')
    if (!session) {
      return getDefaultMonthNames()
    }

    let query = supabase
      .from('month_names')
      .select('month_number, short_name, long_name, locale')

    // Si managerId est fourni, chercher les noms spécifiques à ce manager
    // Sinon, détecter automatiquement le manager_id de l'utilisateur actuel
    if (managerId !== undefined) {
      if (managerId === null) {
        // Si null explicitement, chercher les noms globaux
        query = query.is('manager_id', null)
      } else {
        query = query.eq('manager_id', managerId)
      }
    } else {
      // Détecter automatiquement le manager_id (pour managers et agents)
      const detectedManagerId = await getCurrentUserManagerId()
      
      if (detectedManagerId) {
        query = query.eq('manager_id', detectedManagerId)
      } else {
        // Si aucun manager détecté, charger les noms globaux
        query = query.is('manager_id', null)
      }
    }

    const { data, error } = await query.order('month_number', { ascending: true })

    if (error) {
      logSupabaseError('getMonthNames', error)
      return getDefaultMonthNames()
    }

    if (data && data.length > 0) {
      // Récupérer aussi la locale depuis les paramètres de localisation
      const localizationSettings = await getLocalizationSettings(managerId)
      // Filtrer par locale
      const filteredData = data.filter((item) => item.locale === localizationSettings.locale)
      
      if (filteredData.length > 0) {
        return filteredData.map((item) => ({
          monthNumber: item.month_number,
          shortName: item.short_name,
          longName: item.long_name,
        }))
      }
      
      // Si aucun mois trouvé pour cette locale, retourner les premiers disponibles
      return data.map((item) => ({
        monthNumber: item.month_number,
        shortName: item.short_name,
        longName: item.long_name,
      }))
    }

    // Fallback aux noms par défaut
    return getDefaultMonthNames()
  } catch (error) {
    console.error('Erreur lors de la récupération des noms des mois:', error)
    return getDefaultMonthNames()
  }
}

/**
 * Retourne les noms des mois par défaut (français)
 */
function getDefaultMonthNames() {
  return [
    { monthNumber: 1, shortName: 'Janv', longName: 'Janvier' },
    { monthNumber: 2, shortName: 'Fevr', longName: 'Février' },
    { monthNumber: 3, shortName: 'Mars', longName: 'Mars' },
    { monthNumber: 4, shortName: 'Avril', longName: 'Avril' },
    { monthNumber: 5, shortName: 'Mai', longName: 'Mai' },
    { monthNumber: 6, shortName: 'Juin', longName: 'Juin' },
    { monthNumber: 7, shortName: 'Juillet', longName: 'Juillet' },
    { monthNumber: 8, shortName: 'Aout', longName: 'Août' },
    { monthNumber: 9, shortName: 'Sept', longName: 'Septembre' },
    { monthNumber: 10, shortName: 'Oct', longName: 'Octobre' },
    { monthNumber: 11, shortName: 'Nov', longName: 'Novembre' },
    { monthNumber: 12, shortName: 'Dec', longName: 'Décembre' },
  ]
}

/**
 * Récupère les fréquences de remboursement depuis la base de données
 * @param managerId - ID du manager (optionnel). Si null, charge les fréquences globales ou du manager actuel
 */
export async function getRepaymentFrequencies(managerId?: string | null) {
  try {
    const session = await getActiveSession('getRepaymentFrequencies')
    if (!session) {
      return [
        { key: 'journalier', label: 'Journalier', days: 1 },
        { key: 'hebdomadaire', label: 'Hebdomadaire', days: 7 },
        { key: 'mensuel', label: 'Mensuel', days: 30 },
      ]
    }

    let query = supabase
      .from('repayment_frequencies')
      .select('frequency_key, frequency_label, frequency_days, display_order')
      .eq('is_active', true)

    // Si managerId est fourni, chercher les fréquences spécifiques à ce manager
    // Sinon, détecter automatiquement le manager_id de l'utilisateur actuel
    if (managerId !== undefined) {
      if (managerId === null) {
        // Si null explicitement, chercher les fréquences globales
        query = query.is('manager_id', null)
      } else {
        query = query.eq('manager_id', managerId)
      }
    } else {
      // Détecter automatiquement le manager_id (pour managers et agents)
      const detectedManagerId = await getCurrentUserManagerId()
      
      if (detectedManagerId) {
        query = query.eq('manager_id', detectedManagerId)
      } else {
        // Si aucun manager détecté, charger les fréquences globales
        query = query.is('manager_id', null)
      }
    }

    const { data, error } = await query.order('display_order', { ascending: true })

    if (error) {
      logSupabaseError('getRepaymentFrequencies', error)
      return [
        { key: 'journalier', label: 'Journalier', days: 1 },
        { key: 'hebdomadaire', label: 'Hebdomadaire', days: 7 },
        { key: 'mensuel', label: 'Mensuel', days: 30 },
      ]
    }

    if (data && data.length > 0) {
      return data.map((item) => ({
        key: item.frequency_key,
        label: item.frequency_label,
        days: item.frequency_days,
      }))
    }

    // Fallback aux fréquences par défaut
    return [
      { key: 'journalier', label: 'Journalier', days: 1 },
      { key: 'hebdomadaire', label: 'Hebdomadaire', days: 7 },
      { key: 'mensuel', label: 'Mensuel', days: 30 },
    ]
  } catch (error) {
    console.error('Erreur lors de la récupération des fréquences de remboursement:', error)
    return [
      { key: 'journalier', label: 'Journalier', days: 1 },
      { key: 'hebdomadaire', label: 'Hebdomadaire', days: 7 },
      { key: 'mensuel', label: 'Mensuel', days: 30 },
    ]
  }
}

/**
 * Récupère les paramètres de l'application (titre, description, logo) depuis manager_business_settings
 * @param managerId - ID du manager (optionnel). Si null, charge les paramètres globaux ou du manager actuel
 */
export async function getAppSettings(managerId?: string | null) {
  try {
    const session = await getActiveSession('getAppSettings')
    if (!session) {
      return getDefaultAppSettings()
    }

    const { data, error } = await fetchBusinessSettingsRow<{
      business_name: string | null
      logo_url: string | null
      app_title: string | null
      app_description: string | null
      app_language: string | null
    }>(
      'business_name, logo_url, app_title, app_description, app_language',
      managerId,
    )

    logSupabaseError('getAppSettings', error)

    if (data) {
      return {
        businessName: data.business_name || DEFAULT_APP_SETTINGS.businessName,
        logoUrl: data.logo_url || DEFAULT_APP_SETTINGS.logoUrl,
        appTitle: data.app_title || DEFAULT_APP_SETTINGS.appTitle,
        appDescription: data.app_description || DEFAULT_APP_SETTINGS.appDescription,
        appLanguage: data.app_language || DEFAULT_APP_SETTINGS.appLanguage,
      }
    }

    return getDefaultAppSettings()
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres de l\'application:', error)
    return getDefaultAppSettings()
  }
}

