/**
 * API Route pour exécuter la migration des colonnes de blocage
 * 
 * Cette route peut être appelée depuis le frontend pour exécuter la migration
 * POST /api/migrate-epargne
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Variables d\'environnement manquantes' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Appeler la fonction RPC pour ajouter les colonnes
    const { data, error } = await supabase.rpc('add_epargne_blocked_columns')

    if (error) {
      console.error('Erreur migration:', error)
      return NextResponse.json(
        { 
          error: 'Erreur lors de la migration',
          details: error.message,
          hint: 'Assurez-vous que la fonction add_epargne_blocked_columns() existe dans Supabase'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      results: data,
      message: 'Migration exécutée avec succès'
    })
  } catch (error: any) {
    console.error('Exception lors de la migration:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la migration', details: error.message },
      { status: 500 }
    )
  }
}

