-- Migration: Corriger la structure de la table system_settings
-- Date: 2025-01-XX
-- Description: 
--   1. Ajouter les colonnes manquantes (description, updated_by)
--   2. Créer la contrainte unique sur (setting_key, manager_id)
--   3. S'assurer que manager_id peut être NULL pour les paramètres globaux

-- Cette migration a déjà été appliquée via MCP Supabase
-- Elle est documentée ici pour référence

-- Les corrections appliquées :
-- 1. Ajout de la colonne description (TEXT, nullable)
-- 2. Ajout de la colonne updated_by (UUID, référence auth.users)
-- 3. Création de la contrainte unique system_settings_setting_key_manager_id_key
-- 4. S'assurer que manager_id est nullable

