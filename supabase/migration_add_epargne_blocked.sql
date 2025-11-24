-- Migration: Ajouter le support pour bloquer les montants d'épargne comme garantie
-- Date: 2025-01-XX
-- Description: Ajoute les colonnes nécessaires pour bloquer les montants d'épargne comme garantie pour les prêts

-- Vérifier si la table existe, sinon la créer
CREATE TABLE IF NOT EXISTS epargne_transactions (
    id SERIAL PRIMARY KEY,
    membre_id VARCHAR(4) NOT NULL REFERENCES membres(membre_id) ON DELETE CASCADE,
    agent_id VARCHAR(2) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('depot', 'retrait')),
    montant DECIMAL(12, 2) NOT NULL,
    date_operation DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter les colonnes pour le blocage si elles n'existent pas déjà
DO $$ 
BEGIN
    -- Ajouter is_blocked
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'epargne_transactions' 
        AND column_name = 'is_blocked'
    ) THEN
        ALTER TABLE epargne_transactions 
        ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
    END IF;

    -- Ajouter blocked_for_pret_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'epargne_transactions' 
        AND column_name = 'blocked_for_pret_id'
    ) THEN
        ALTER TABLE epargne_transactions 
        ADD COLUMN blocked_for_pret_id VARCHAR(50) REFERENCES prets(pret_id) ON DELETE SET NULL;
    END IF;

    -- Ajouter blocked_for_group_pret_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'epargne_transactions' 
        AND column_name = 'blocked_for_group_pret_id'
    ) THEN
        ALTER TABLE epargne_transactions 
        ADD COLUMN blocked_for_group_pret_id VARCHAR(50);
    END IF;
END $$;

-- Ajouter les index pour améliorer les performances des requêtes de blocage
CREATE INDEX IF NOT EXISTS idx_epargne_transactions_blocked 
ON epargne_transactions(is_blocked, membre_id) 
WHERE is_blocked = TRUE;

CREATE INDEX IF NOT EXISTS idx_epargne_transactions_pret_id 
ON epargne_transactions(blocked_for_pret_id) 
WHERE blocked_for_pret_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_epargne_transactions_group_pret_id 
ON epargne_transactions(blocked_for_group_pret_id) 
WHERE blocked_for_group_pret_id IS NOT NULL;

-- Commentaires sur les colonnes
COMMENT ON COLUMN epargne_transactions.is_blocked IS 'Indique si ce montant est bloqué comme garantie pour un prêt';
COMMENT ON COLUMN epargne_transactions.blocked_for_pret_id IS 'ID du prêt pour lequel ce montant est bloqué (prêts individuels)';
COMMENT ON COLUMN epargne_transactions.blocked_for_group_pret_id IS 'ID du prêt de groupe pour lequel ce montant est bloqué (prêts de groupe)';

