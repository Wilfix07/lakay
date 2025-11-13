'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { getLocalizationSettings, getMonthNames, getRepaymentFrequencies, getAppSettings } from '@/lib/systemSettings'
import { supabase } from '@/lib/supabase'

interface LocalizationSettings {
  currencyCode: string
  currencySymbol: string
  locale: string
  dateFormat: string
  timezone: string
  appLanguage: string
}

interface MonthName {
  monthNumber: number
  shortName: string
  longName: string
}

interface RepaymentFrequency {
  key: string
  label: string
  days: number
}

interface AppSettings {
  businessName: string
  logoUrl: string | null
  appTitle: string
  appDescription: string
  appLanguage: string
}

interface DynamicDataContextType {
  localization: LocalizationSettings
  monthNames: MonthName[]
  repaymentFrequencies: RepaymentFrequency[]
  appSettings: AppSettings
  loading: boolean
  refresh: () => Promise<void>
}

const defaultLocalization: LocalizationSettings = {
  currencyCode: 'HTG',
  currencySymbol: 'HTG',
  locale: 'fr-FR',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'America/Port-au-Prince',
  appLanguage: 'fr',
}

const defaultAppSettings: AppSettings = {
  businessName: 'Lakay',
  logoUrl: null,
  appTitle: 'Système de Microcrédit - Lakay',
  appDescription: 'Gestion de microcrédit avec remboursements quotidiens',
  appLanguage: 'fr',
}

const DynamicDataContext = createContext<DynamicDataContextType>({
  localization: defaultLocalization,
  monthNames: [],
  repaymentFrequencies: [],
  appSettings: defaultAppSettings,
  loading: true,
  refresh: async () => {},
})

export function useDynamicData() {
  return useContext(DynamicDataContext)
}

interface DynamicDataProviderProps {
  children: ReactNode
}

export function DynamicDataProvider({ children }: DynamicDataProviderProps) {
  const [localization, setLocalization] = useState<LocalizationSettings>(defaultLocalization)
  const [monthNames, setMonthNames] = useState<MonthName[]>([])
  const [repaymentFrequencies, setRepaymentFrequencies] = useState<RepaymentFrequency[]>([])
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings)
  const [loading, setLoading] = useState(true)

  const loadDynamicData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Charger toutes les données dynamiques en parallèle
      const [localizationData, monthNamesData, frequenciesData, appSettingsData] = await Promise.all([
        getLocalizationSettings(),
        getMonthNames(),
        getRepaymentFrequencies(),
        getAppSettings(),
      ])

      setLocalization(localizationData)
      setMonthNames(monthNamesData)
      setRepaymentFrequencies(frequenciesData)
      setAppSettings(appSettingsData)
    } catch (error) {
      console.error('Erreur lors du chargement des données dynamiques:', error)
      // Utiliser les valeurs par défaut en cas d'erreur
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDynamicData()

    // Écouter les changements d'authentification pour recharger les données
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadDynamicData()
    })

    // Écouter les événements de rafraîchissement des données dynamiques
    const handleRefresh = () => {
      loadDynamicData()
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('dynamicDataRefresh', handleRefresh)
    }

    return () => {
      subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('dynamicDataRefresh', handleRefresh)
      }
    }
  }, [loadDynamicData])

  return (
    <DynamicDataContext.Provider
      value={{
        localization,
        monthNames,
        repaymentFrequencies,
        appSettings,
        loading,
        refresh: loadDynamicData,
      }}
    >
      {children}
    </DynamicDataContext.Provider>
  )
}

