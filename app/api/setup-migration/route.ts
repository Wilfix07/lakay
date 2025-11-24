/**
 * API Route pour créer la fonction RPC de migration
 * Cette route crée la fonction PostgreSQL qui peut ensuite être appelée pour ajouter les colonnes
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

    // SQL pour créer la fonction RPC
    const createFunctionSQL = `
CREATE OR REPLACE FUNCTION add_epargne_blocked_columns()
RETURNS TABLE(
    column_name TEXT,
    status TEXT,
    message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    col_record RECORD;
BEGIN
    -- Ajouter is_blocked
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'epargne_transactions' 
        AND column_name = 'is_blocked'
    ) THEN
        ALTER TABLE epargne_transactions 
        ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
        
        col_record.column_name := 'is_blocked';
        col_record.status := 'added';
        col_record.message := 'Colonne is_blocked ajoutée avec succès';
        RETURN NEXT col_record;
    ELSE
        col_record.column_name := 'is_blocked';
        col_record.status := 'exists';
        col_record.message := 'Colonne is_blocked existe déjà';
        RETURN NEXT col_record;
    END IF;

    -- Ajouter blocked_for_pret_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'epargne_transactions' 
        AND column_name = 'blocked_for_pret_id'
    ) THEN
        ALTER TABLE epargne_transactions 
        ADD COLUMN blocked_for_pret_id VARCHAR(50) REFERENCES prets(pret_id) ON DELETE SET NULL;
        
        col_record.column_name := 'blocked_for_pret_id';
        col_record.status := 'added';
        col_record.message := 'Colonne blocked_for_pret_id ajoutée avec succès';
        RETURN NEXT col_record;
    ELSE
        col_record.column_name := 'blocked_for_pret_id';
        col_record.status := 'exists';
        col_record.message := 'Colonne blocked_for_pret_id existe déjà';
        RETURN NEXT col_record;
    END IF;

    -- Ajouter blocked_for_group_pret_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'epargne_transactions' 
        AND column_name = 'blocked_for_group_pret_id'
    ) THEN
        ALTER TABLE epargne_transactions 
        ADD COLUMN blocked_for_group_pret_id VARCHAR(50);
        
        col_record.column_name := 'blocked_for_group_pret_id';
        col_record.status := 'added';
        col_record.message := 'Colonne blocked_for_group_pret_id ajoutée avec succès';
        RETURN NEXT col_record;
    ELSE
        col_record.column_name := 'blocked_for_group_pret_id';
        col_record.status := 'exists';
        col_record.message := 'Colonne blocked_for_group_pret_id existe déjà';
        RETURN NEXT col_record;
    END IF;

    -- Créer les index
    CREATE INDEX IF NOT EXISTS idx_epargne_transactions_blocked 
    ON epargne_transactions(is_blocked, membre_id) 
    WHERE is_blocked = TRUE;

    CREATE INDEX IF NOT EXISTS idx_epargne_transactions_pret_id 
    ON epargne_transactions(blocked_for_pret_id) 
    WHERE blocked_for_pret_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_epargne_transactions_group_pret_id 
    ON epargne_transactions(blocked_for_group_pret_id) 
    WHERE blocked_for_group_pret_id IS NOT NULL;

    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION add_epargne_blocked_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION add_epargne_blocked_columns() TO anon;
    `

    // Note: Le client Supabase ne peut pas exécuter directement CREATE FUNCTION
    // Il faut utiliser le SQL Editor de Supabase Dashboard
    // Cette route retourne le SQL à exécuter
    return NextResponse.json({
      success: false,
      message: 'La création de fonction nécessite des privilèges administrateur',
      sql: createFunctionSQL,
      instructions: [
        '1. Allez dans Supabase Dashboard → SQL Editor',
        '2. Copiez le SQL fourni ci-dessus',
        '3. Collez et exécutez dans l\'éditeur SQL',
        '4. Ensuite, utilisez le bouton "Exécuter la migration" dans l\'interface'
      ]
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erreur', details: error.message },
      { status: 500 }
    )
  }
}

