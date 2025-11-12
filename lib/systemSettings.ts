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

/**
 * Récupère les paramètres d'échéancier depuis la base de données
 */
export async function getScheduleSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'schedule')
      .single()

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
 */
export async function getInterestRates() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'interest_rates')
      .single()

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
 */
export async function getLoanAmountBrackets() {
  try {
    const { data, error } = await supabase
      .from('loan_amount_brackets')
      .select('*')
      .eq('is_active', true)
      .order('min_amount', { ascending: true })

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
 */
export async function getExpenseCategories() {
  try {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

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

