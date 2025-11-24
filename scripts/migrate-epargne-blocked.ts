/**
 * Script de migration pour ajouter les colonnes de blocage à la table epargne_transactions
 * 
 * Usage: npx tsx scripts/migrate-epargne-blocked.ts
 * ou: node --loader ts-node/esm scripts/migrate-epargne-blocked.ts
 */

import { createClient } from '@supabase/supabase-js'

// Récupérer les variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND column_name = $2
      ) as exists;
    `,
    params: [tableName, columnName]
  })

  if (error) {
    // Si la fonction RPC n'existe pas, utiliser une requête directe
    const { data: directData, error: directError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', tableName)
      .eq('column_name', columnName)
      .limit(1)

    return !directError && directData && directData.length > 0
  }

  return data?.[0]?.exists || false
}

async function addColumn(tableName: string, columnDef: string): Promise<boolean> {
  try {
    // Utiliser une requête SQL directe via Supabase
    const { error } = await supabase.rpc('exec_sql', {
      query: `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnDef};`
    })

    if (error) {
      console.error(`Erreur lors de l'ajout de la colonne:`, error)
      return false
    }
    return true
  } catch (err) {
    console.error(`Exception lors de l'ajout de la colonne:`, err)
    return false
  }
}

async function runMigration() {
  console.log('🚀 Démarrage de la migration pour ajouter les colonnes de blocage...\n')

  const tableName = 'epargne_transactions'

  // Vérifier si la table existe
  const { data: tableExists, error: tableError } = await supabase
    .from(tableName)
    .select('id')
    .limit(1)

  if (tableError && tableError.code === '42P01') {
    console.log('📋 Création de la table epargne_transactions...')
    // La table n'existe pas, on ne peut pas la créer via le client Supabase directement
    // Il faudra le faire manuellement dans Supabase Dashboard
    console.error('❌ La table epargne_transactions n\'existe pas.')
    console.error('   Veuillez d\'abord créer la table dans Supabase Dashboard.')
    process.exit(1)
  }

  console.log('✅ La table epargne_transactions existe.\n')

  // Colonnes à ajouter
  const columns = [
    {
      name: 'is_blocked',
      definition: 'is_blocked BOOLEAN DEFAULT FALSE',
      description: 'Indique si ce montant est bloqué comme garantie'
    },
    {
      name: 'blocked_for_pret_id',
      definition: 'blocked_for_pret_id VARCHAR(50) REFERENCES prets(pret_id) ON DELETE SET NULL',
      description: 'ID du prêt individuel pour lequel ce montant est bloqué'
    },
    {
      name: 'blocked_for_group_pret_id',
      definition: 'blocked_for_group_pret_id VARCHAR(50)',
      description: 'ID du prêt de groupe pour lequel ce montant est bloqué'
    }
  ]

  // Vérifier et ajouter chaque colonne
  for (const column of columns) {
    console.log(`🔍 Vérification de la colonne '${column.name}'...`)
    
    const exists = await checkColumnExists(tableName, column.name)
    
    if (exists) {
      console.log(`   ✅ La colonne '${column.name}' existe déjà.\n`)
    } else {
      console.log(`   ➕ Ajout de la colonne '${column.name}'...`)
      
      // Note: Supabase client ne permet pas d'exécuter ALTER TABLE directement
      // Il faut utiliser le SQL Editor dans Supabase Dashboard
      console.log(`   ⚠️  Impossible d'ajouter la colonne automatiquement via le client Supabase.`)
      console.log(`   📝 Veuillez exécuter cette commande SQL dans Supabase Dashboard:\n`)
      console.log(`   ALTER TABLE ${tableName} ADD COLUMN ${column.definition};\n`)
    }
  }

  console.log('✅ Migration terminée!')
  console.log('\n📋 Résumé:')
  console.log('   Si des colonnes manquaient, veuillez exécuter les commandes SQL affichées ci-dessus')
  console.log('   dans le SQL Editor de Supabase Dashboard.')
}

runMigration().catch((error) => {
  console.error('❌ Erreur lors de la migration:', error)
  process.exit(1)
})

