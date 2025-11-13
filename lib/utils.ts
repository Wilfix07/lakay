import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getLocalizationSettings, getMonthNames } from "./systemSettings"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cache pour les paramètres de localisation (évite les appels répétés)
let localizationCache: {
  currencyCode: string
  currencySymbol: string
  locale: string
  dateFormat: string
  timezone: string
  appLanguage: string
} | null = null
let monthNamesCache: Array<{ monthNumber: number; shortName: string; longName: string }> | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Utilitaires pour la génération d'IDs et autres fonctions

/**
 * Formatage de devise avec paramètres dynamiques
 * @param amount - Montant à formater
 * @param currencyCode - Code de devise (optionnel, récupéré depuis la DB si non fourni)
 * @param currencySymbol - Symbole de devise (optionnel, récupéré depuis la DB si non fourni)
 * @param locale - Locale (optionnel, récupéré depuis la DB si non fourni)
 */
export async function formatCurrencyDynamic(
  amount: number,
  currencyCode?: string,
  currencySymbol?: string,
  locale?: string,
  managerId?: string | null
): Promise<string> {
  try {
    // Si les paramètres ne sont pas fournis, les récupérer depuis la DB
    if (!currencyCode || !currencySymbol || !locale) {
      const now = Date.now()
      if (!localizationCache || (now - cacheTimestamp) > CACHE_DURATION) {
        localizationCache = await getLocalizationSettings(managerId)
        cacheTimestamp = now
      }
      currencyCode = currencyCode || localizationCache.currencyCode
      currencySymbol = currencySymbol || localizationCache.currencySymbol
      locale = locale || localizationCache.locale
    }

    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
    return `${formatted} ${currencySymbol}`
  } catch (error) {
    // Fallback si Intl n'est pas disponible
    return `${amount.toFixed(2)} ${currencySymbol || 'HTG'}`
  }
}

/**
 * Formatage de devise (version synchrone avec paramètres par défaut)
 * Pour compatibilité avec le code existant
 */
export function formatCurrency(amount: number, currencySymbol: string = 'HTG', locale: string = 'fr-FR'): string {
  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
    return `${formatted} ${currencySymbol}`
  } catch (error) {
    // Fallback si Intl n'est pas disponible
    return `${amount.toFixed(2)} ${currencySymbol}`
  }
}

/**
 * Formatage de date avec paramètres dynamiques
 * @param date - Date à formater
 * @param locale - Locale (optionnel, récupéré depuis la DB si non fourni)
 * @param dateFormat - Format de date (optionnel, pour usage futur)
 */
export async function formatDateDynamic(
  date: string | Date,
  locale?: string,
  managerId?: string | null
): Promise<string> {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    
    // Si la locale n'est pas fournie, la récupérer depuis la DB
    if (!locale) {
      const now = Date.now()
      if (!localizationCache || (now - cacheTimestamp) > CACHE_DURATION) {
        localizationCache = await getLocalizationSettings(managerId)
        cacheTimestamp = now
      }
      locale = localizationCache.locale
    }

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch (error) {
    // Fallback
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('fr-FR')
  }
}

/**
 * Formatage de date (version synchrone avec paramètres par défaut)
 * Pour compatibilité avec le code existant
 */
export function formatDate(date: string | Date, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch (error) {
    return d.toLocaleDateString(locale)
  }
}

/**
 * Récupère le nom du mois avec paramètres dynamiques
 * @param date - Date (optionnel, utilise la date actuelle si non fourni)
 * @param format - Format ('short' ou 'long', par défaut 'short')
 */
export async function getMonthNameDynamic(
  date: Date = new Date(),
  format: 'short' | 'long' = 'short',
  managerId?: string | null
): Promise<string> {
  try {
    const now = Date.now()
    if (!monthNamesCache || (now - cacheTimestamp) > CACHE_DURATION) {
      monthNamesCache = await getMonthNames(managerId)
      cacheTimestamp = now
    }

    const monthNumber = date.getMonth() + 1 // getMonth() retourne 0-11
    const month = monthNamesCache.find((m) => m.monthNumber === monthNumber)

    if (month) {
      return format === 'long' ? month.longName : month.shortName
    }

    // Fallback aux noms par défaut
    const defaultMonths = [
      'Janv', 'Fevr', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Aout', 'Sept', 'Oct', 'Nov', 'Dec'
    ]
    return defaultMonths[date.getMonth()]
  } catch (error) {
    // Fallback aux noms par défaut
    const defaultMonths = [
      'Janv', 'Fevr', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Aout', 'Sept', 'Oct', 'Nov', 'Dec'
    ]
    return defaultMonths[date.getMonth()]
  }
}

/**
 * Récupère le nom du mois (version synchrone avec paramètres par défaut)
 * Pour compatibilité avec le code existant
 */
export function getMonthName(date: Date = new Date()): string {
  const months = [
    'Janv', 'Fevr', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Sept', 'Oct', 'Nov', 'Dec'
  ]
  return months[date.getMonth()]
}

export function calculateRemainingDays(datePremierRemboursement: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const premierRemb = new Date(datePremierRemboursement)
  premierRemb.setHours(0, 0, 0, 0)
  
  if (premierRemb > today) {
    return 0
  }
  
  const diffTime = today.getTime() - premierRemb.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}
