-- Migration: Fonction pour ajouter les colonnes de blocage à epargne_transactions
-- Cette fonction peut être appelée via Supabase RPC pour ajouter les colonnes automatiquement

-- Fonction pour ajouter les colonnes si elles n'existent pas
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
    -- Vérifier et ajouter is_blocked
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

    -- Vérifier et ajouter blocked_for_pret_id
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

    -- Vérifier et ajouter blocked_for_group_pret_id
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

