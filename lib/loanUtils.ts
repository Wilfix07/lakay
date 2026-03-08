import { addDays, addMonths, getDay } from 'date-fns'

export type FrequenceRemboursement = 'journalier' | 'hebdomadaire' | 'mensuel'

export interface LoanScheduleEntry {
  numero: number
  montant: number
  principal: number
  interet: number
  date: Date
  /** Capital restant dû après ce paiement (pour tableau d'amortissement) */
  capitalRestantDu?: number
}

export interface LoanPlan {
  montantEcheance: number
  totalRemboursement: number
  interetTotal: number
  datePremierRemboursement: Date
  dateDecaissement: Date
  dateFin: Date
  duree: number // Durée en jours
  schedule: LoanScheduleEntry[]
}

/**
 * Ajuste une date pour tomber un jour ouvrable (lun-ven)
 */
export function adjustToBusinessDay(date: Date): Date {
  let adjusted = new Date(date)
  const day = getDay(adjusted)
  // Si samedi (6), ajouter 2 jours pour lundi
  if (day === 6) {
    adjusted = addDays(adjusted, 2)
  } 
  // Si dimanche (0), ajouter 1 jour pour lundi
  else if (day === 0) {
    adjusted = addDays(adjusted, 1)
  }
  return adjusted
}

/**
 * Calcule la date du premier paiement selon la fréquence
 */
export function getInitialPaymentDate(
  dateDecaissement: Date,
  frequency: FrequenceRemboursement,
): Date {
  if (frequency === 'mensuel') {
    // Premier paiement 1 mois après le décaissement
    return adjustToBusinessDay(addMonths(dateDecaissement, 1))
  }
  if (frequency === 'hebdomadaire') {
    // Premier paiement 7 jours après le décaissement
    return adjustToBusinessDay(addDays(dateDecaissement, 7))
  }
  // Pour journalier: premier paiement 2 jours ouvrables après décaissement
  return adjustToBusinessDay(addDays(dateDecaissement, 2))
}

/**
 * Calcule la date du prochain paiement
 */
export function getNextPaymentDate(
  current: Date,
  frequency: FrequenceRemboursement,
): Date {
  if (frequency === 'mensuel') {
    return adjustToBusinessDay(addMonths(current, 1))
  }
  if (frequency === 'hebdomadaire') {
    return adjustToBusinessDay(addDays(current, 7))
  }
  // Pour journalier: chaque jour ouvrable
  return adjustToBusinessDay(addDays(current, 1))
}

/**
 * Calcule le plan de remboursement complet d'un prêt
 */
export async function calculateLoanPlan(
  amount: number,
  frequency: FrequenceRemboursement,
  count: number,
  decaissementDate: string,
): Promise<LoanPlan> {
  const schedule: LoanScheduleEntry[] = []
  let dateDecaissement = new Date(decaissementDate)
  
  if (Number.isNaN(dateDecaissement.getTime())) {
    dateDecaissement = new Date()
  }

  // Si montant ou nombre invalide, retourner plan vide
  if (!(amount > 0) || !(count > 0)) {
    const baseDate = getInitialPaymentDate(dateDecaissement, frequency)
    return {
      montantEcheance: 0,
      totalRemboursement: 0,
      interetTotal: 0,
      datePremierRemboursement: baseDate,
      dateDecaissement: new Date(dateDecaissement),
      dateFin: baseDate,
      duree: 0,
      schedule,
    }
  }

  // Taux de base 4,5 % (baseInterestRate)
  const taux = 0.045

  // Intérêt total = Capital × Taux × Nombre d'échéances
  const interetTotal = Number((amount * taux * count).toFixed(2))
  // Total à rembourser = Capital + Intérêt total
  const totalToRepay = Number((amount + interetTotal).toFixed(2))
  // Montant de chaque échéance = Total à rembourser / Nombre d'échéances
  const montantEcheance = Number((totalToRepay / count).toFixed(2))

  let paymentDate = getInitialPaymentDate(dateDecaissement, frequency)
  let capitalRestantDu = Number(amount.toFixed(2))

  // Générer le tableau d'amortissement (principal et intérêt par échéance, capital restant dû)
  for (let i = 1; i <= count; i++) {
    const isLast = i === count
    const principal = isLast
      ? Number((capitalRestantDu).toFixed(2))
      : Number((amount / count).toFixed(2))
    const interest = isLast
      ? Number((montantEcheance - principal).toFixed(2))
      : Number((interetTotal / count).toFixed(2))
    const montant = montantEcheance

    capitalRestantDu = Number((capitalRestantDu - principal).toFixed(2))
    if (capitalRestantDu < 0) capitalRestantDu = 0

    schedule.push({
      numero: i,
      montant,
      principal,
      interet: interest,
      date: new Date(paymentDate),
      capitalRestantDu,
    })

    if (i < count) {
      paymentDate = getNextPaymentDate(paymentDate, frequency)
    }
  }

  const totalRemboursement =
    Math.round(schedule.reduce((sum, entry) => sum + entry.montant, 0) * 100) / 100

  // Calculer la date de fin (dernière échéance)
  const dateFin = schedule.length > 0 ? schedule[schedule.length - 1].date : paymentDate
  
  // Calculer la durée en jours entre le décaissement et la fin
  const duree = Math.ceil((dateFin.getTime() - dateDecaissement.getTime()) / (1000 * 60 * 60 * 24))

  return {
    montantEcheance,
    totalRemboursement,
    interetTotal,
    datePremierRemboursement: schedule[0]?.date ?? paymentDate,
    dateDecaissement: new Date(dateDecaissement),
    dateFin,
    duree,
    schedule,
  }
}

