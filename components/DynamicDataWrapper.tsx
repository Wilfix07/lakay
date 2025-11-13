'use client'

import { DynamicDataProvider } from '@/lib/contexts/DynamicDataContext'
import { DynamicMetadata } from '@/components/DynamicMetadata'
import { ReactNode } from 'react'

interface DynamicDataWrapperProps {
  children: ReactNode
}

export function DynamicDataWrapper({ children }: DynamicDataWrapperProps) {
  return (
    <DynamicDataProvider>
      <DynamicMetadata />
      {children}
    </DynamicDataProvider>
  )
}

