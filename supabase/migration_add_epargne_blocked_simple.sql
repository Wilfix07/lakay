-- Migration simplifiée pour ajouter les colonnes de blocage
-- Cette version utilise des commandes ALTER TABLE simples sans bloc DO $$

-- Ajouter is_blocked
ALTER TABLE epargne_transactions 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- Ajouter blocked_for_pret_id
ALTER TABLE epargne_transactions 
ADD COLUMN IF NOT EXISTS blocked_for_pret_id VARCHAR(50);

-- Ajouter la contrainte de clé étrangère pour blocked_for_pret_id
-- (Exécutez seulement si la colonne vient d'être créée)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'epargne_transactions_blocked_for_pret_id_fkey'
    ) THEN
        ALTER TABLE epargne_transactions 
        ADD CONSTRAINT epargne_transactions_blocked_for_pret_id_fkey 
        FOREIGN KEY (blocked_for_pret_id) 
        REFERENCES prets(pret_id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Ajouter blocked_for_group_pret_id
ALTER TABLE epargne_transactions 
ADD COLUMN IF NOT EXISTS blocked_for_group_pret_id VARCHAR(50);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_epargne_transactions_blocked 
ON epargne_transactions(is_blocked, membre_id) 
WHERE is_blocked = TRUE;

CREATE INDEX IF NOT EXISTS idx_epargne_transactions_pret_id 
ON epargne_transactions(blocked_for_pret_id) 
WHERE blocked_for_pret_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_epargne_transactions_group_pret_id 
ON epargne_transactions(blocked_for_group_pret_id) 
WHERE blocked_for_group_pret_id IS NOT NULL;

-- Ajouter les commentaires
COMMENT ON COLUMN epargne_transactions.is_blocked IS 'Indique si ce montant est bloqué comme garantie pour un prêt';
COMMENT ON COLUMN epargne_transactions.blocked_for_pret_id IS 'ID du prêt pour lequel ce montant est bloqué (prêts individuels)';
COMMENT ON COLUMN epargne_transactions.blocked_for_group_pret_id IS 'ID du prêt de groupe pour lequel ce montant est bloqué (prêts de groupe)';

