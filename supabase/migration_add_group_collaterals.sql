-- Migration: Ajout du support des garanties pour les prêts de groupe
-- Chaque membre du groupe peut avoir sa propre garantie

-- Étape 1: Rendre pret_id nullable pour permettre les prêts de groupe
-- (pour les prêts de groupe, pret_id sera NULL et group_pret_id sera défini)
ALTER TABLE collaterals 
ALTER COLUMN pret_id DROP NOT NULL;

-- Étape 2: Ajouter le champ group_pret_id à la table collaterals (optionnel)
-- Si group_pret_id est NULL, c'est une garantie pour un prêt individuel
-- Si group_pret_id est défini, c'est une garantie pour un membre dans un prêt de groupe
ALTER TABLE collaterals 
ADD COLUMN IF NOT EXISTS group_pret_id VARCHAR(50) REFERENCES group_prets(pret_id) ON DELETE CASCADE;

-- Étape 3: Modifier la contrainte UNIQUE pour permettre plusieurs garanties par prêt de groupe
-- (une par membre)
-- Supprimer l'ancienne contrainte unique sur pret_id
ALTER TABLE collaterals 
DROP CONSTRAINT IF EXISTS collaterals_pret_id_key;

-- Créer une nouvelle contrainte unique qui permet:
-- - Une seule garantie par pret_id (prêts individuels)
-- - Plusieurs garanties par group_pret_id (une par membre)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_collateral_pret_id 
ON collaterals(pret_id) 
WHERE group_pret_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_collateral_group_pret_membre 
ON collaterals(group_pret_id, membre_id) 
WHERE group_pret_id IS NOT NULL;

-- Index pour améliorer les performances des requêtes sur les prêts de groupe
CREATE INDEX IF NOT EXISTS idx_collaterals_group_pret_id 
ON collaterals(group_pret_id) 
WHERE group_pret_id IS NOT NULL;

-- Commentaire sur la table
COMMENT ON COLUMN collaterals.group_pret_id IS 'ID du prêt de groupe. NULL pour les prêts individuels, défini pour les prêts de groupe où chaque membre a sa propre garantie';

