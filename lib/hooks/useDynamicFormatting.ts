'use client'

import { useMemo } from 'react'
import { useDynamicData } from '@/lib/contexts/DynamicDataContext'

/**
 * Hook pour formater les montants avec la devise dynamique
 */
export function useFormatCurrency() {
  const { localization } = useDynamicData()

  return useMemo(() => {
    return (amount: number): string => {
      try {
        const formatted = new Intl.NumberFormat(localization.locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount)
        return `${formatted} ${localization.currencySymbol}`
      } catch (error) {
        return `${amount.toFixed(2)} ${localization.currencySymbol}`
      }
    }
  }, [localization])
}

/**
 * Hook pour formater les dates avec la locale dynamique
 */
export function useFormatDate() {
  const { localization } = useDynamicData()

  return useMemo(() => {
    return (date: string | Date): string => {
      try {
        const d = typeof date === 'string' ? new Date(date) : date
        return new Intl.DateTimeFormat(localization.locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(d)
      } catch (error) {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleDateString(localization.locale)
      }
    }
  }, [localization])
}

/**
 * Hook pour récupérer le nom du mois avec les données dynamiques
 */
export function useGetMonthName() {
  const { monthNames } = useDynamicData()

  return useMemo(() => {
    return (date: Date = new Date(), format: 'short' | 'long' = 'short'): string => {
      const monthNumber = date.getMonth() + 1 // getMonth() retourne 0-11
      const month = monthNames.find((m) => m.monthNumber === monthNumber)

      if (month) {
        return format === 'long' ? month.longName : month.shortName
      }

      // Fallback aux noms par défaut
      const defaultMonths = [
        'Janv', 'Fevr', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Aout', 'Sept', 'Oct', 'Nov', 'Dec'
      ]
      return defaultMonths[date.getMonth()]
    }
  }, [monthNames])
}

