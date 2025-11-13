'use client'

import { useEffect } from 'react'
import { useDynamicData } from '@/lib/contexts/DynamicDataContext'

export function DynamicMetadata() {
  const { appSettings, localization } = useDynamicData()

  useEffect(() => {
    // Mettre à jour le titre de la page
    if (appSettings.appTitle) {
      document.title = appSettings.appTitle
    }

    // Mettre à jour la langue du document
    if (localization.appLanguage) {
      document.documentElement.lang = localization.appLanguage
    }

    // Mettre à jour la meta description
    if (appSettings.appDescription) {
      let metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription) {
        metaDescription = document.createElement('meta')
        metaDescription.setAttribute('name', 'description')
        document.head.appendChild(metaDescription)
      }
      metaDescription.setAttribute('content', appSettings.appDescription)
    }
  }, [appSettings, localization])

  return null
}

