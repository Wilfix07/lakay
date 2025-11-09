import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utilitaires pour la génération d'IDs et autres fonctions

export function formatCurrency(amount: number): string {
  // HTG n'est pas une devise standard dans Intl.NumberFormat
  // Utiliser 'fr-FR' avec formatage manuel pour HTG
  try {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
    return `${formatted} HTG`
  } catch (error) {
    // Fallback si Intl n'est pas disponible
    return `${amount.toFixed(2)} HTG`
  }
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

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
