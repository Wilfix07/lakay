/**
 * Script pour exécuter la migration via Supabase RPC
 * 
 * Usage: npx tsx scripts/run-migration-epargne.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes')
  console.error('   NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('🚀 Exécution de la migration pour ajouter les colonnes de blocage...\n')

  try {
    // Appeler la fonction RPC pour ajouter les colonnes
    const { data, error } = await supabase.rpc('add_epargne_blocked_columns')

    if (error) {
      console.error('❌ Erreur lors de l\'exécution de la migration:', error)
      console.error('\n💡 La fonction RPC n\'existe peut-être pas encore.')
      console.error('   Veuillez d\'abord exécuter le fichier:')
      console.error('   supabase/migration_add_epargne_blocked_function.sql')
      console.error('   dans le SQL Editor de Supabase Dashboard.\n')
      process.exit(1)
    }

    if (data && data.length > 0) {
      console.log('✅ Résultats de la migration:\n')
      data.forEach((result: any) => {
        const icon = result.status === 'added' ? '➕' : '✓'
        console.log(`   ${icon} ${result.column_name}: ${result.message}`)
      })
      console.log('\n✅ Migration terminée avec succès!')
    } else {
      console.log('✅ Migration exécutée (aucune colonne à ajouter)')
    }
  } catch (err: any) {
    console.error('❌ Erreur:', err.message)
    console.error('\n💡 Assurez-vous que:')
    console.error('   1. La fonction add_epargne_blocked_columns() existe dans Supabase')
    console.error('   2. Les permissions sont correctement configurées')
    console.error('   3. Vous avez les droits nécessaires')
    process.exit(1)
  }
}

runMigration()

