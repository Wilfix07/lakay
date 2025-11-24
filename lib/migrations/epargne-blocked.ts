/**
 * Utilitaire pour vérifier et créer les colonnes de blocage dans epargne_transactions
 * Cette fonction peut être appelée depuis le frontend pour vérifier/créer les colonnes
 */

import { supabase } from '../supabase'

export async function checkAndCreateEpargneBlockedColumns(): Promise<{
  success: boolean
  message: string
  columnsAdded: string[]
}> {
  try {
    // Vérifier si les colonnes existent en essayant de les lire
    const { data: testData, error: testError } = await supabase
      .from('epargne_transactions')
      .select('is_blocked, blocked_for_pret_id, blocked_for_group_pret_id')
      .limit(1)

    // Si aucune erreur, les colonnes existent déjà
    if (!testError) {
      return {
        success: true,
        message: 'Toutes les colonnes existent déjà',
        columnsAdded: []
      }
    }

    // Si l'erreur est liée aux colonnes manquantes, on doit les créer
    if (testError.message?.includes('blocked_for_group_pret_id') || 
        testError.message?.includes('blocked_for_pret_id') || 
        testError.message?.includes('is_blocked') ||
        testError.message?.includes('column') ||
        testError.message?.includes('does not exist')) {
      
      // Les colonnes n'existent pas, mais on ne peut pas les créer directement via le client Supabase
      // Il faut utiliser une fonction PostgreSQL ou exécuter la migration manuellement
      return {
        success: false,
        message: 'Les colonnes sont manquantes. Veuillez exécuter la migration SQL dans Supabase Dashboard.',
        columnsAdded: []
      }
    }

    // Autre erreur
    throw testError
  } catch (error: any) {
    console.error('Erreur lors de la vérification des colonnes:', error)
    return {
      success: false,
      message: `Erreur: ${error.message || 'Erreur inconnue'}`,
      columnsAdded: []
    }
  }
}

/**
 * Crée la fonction RPC pour ajouter les colonnes si elle n'existe pas
 * Cette fonction doit être appelée une seule fois depuis Supabase SQL Editor
 */
export const CREATE_RPC_FUNCTION_SQL = `
-- Fonction pour ajouter les colonnes de blocage
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

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION add_epargne_blocked_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION add_epargne_blocked_columns() TO anon;
`

