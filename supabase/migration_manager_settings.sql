-- Migration: Paramètres système par manager
-- Date: 2024-12-19
-- Description: Permet d'associer les paramètres système à un manager spécifique

-- Étape 1: Ajouter la colonne manager_id à la table system_settings (si elle n'existe pas déjà)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'system_settings' AND column_name = 'manager_id'
    ) THEN
        ALTER TABLE system_settings ADD COLUMN manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Étape 2: Créer un index sur manager_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_system_settings_manager_id ON system_settings(manager_id);

-- Étape 3: Modifier la contrainte UNIQUE pour permettre (key, manager_id) unique
-- Supprimer l'ancienne contrainte UNIQUE sur key si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'system_settings_key_key'
    ) THEN
        ALTER TABLE system_settings DROP CONSTRAINT system_settings_key_key;
    END IF;
END $$;

-- Ajouter la nouvelle contrainte UNIQUE sur (key, manager_id)
-- NULL manager_id représente les paramètres globaux (admin)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'system_settings_key_manager_id_key'
    ) THEN
        ALTER TABLE system_settings ADD CONSTRAINT system_settings_key_manager_id_key 
        UNIQUE (key, manager_id);
    END IF;
END $$;

-- Étape 4: Mettre à jour les politiques RLS pour permettre aux managers de voir leurs propres paramètres
DROP POLICY IF EXISTS manager_own_settings ON system_settings;
CREATE POLICY manager_own_settings
    ON system_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND system_settings.manager_id = up.id
        )
        OR manager_id IS NULL  -- Les paramètres globaux sont visibles par tous
    );

-- Les managers peuvent voir les paramètres globaux (manager_id = NULL) en lecture seule
-- Seuls les admins peuvent modifier

-- Note: Les paramètres existants avec manager_id = NULL resteront des paramètres globaux
-- Pour créer des paramètres spécifiques à un manager, insérez avec le manager_id du manager

