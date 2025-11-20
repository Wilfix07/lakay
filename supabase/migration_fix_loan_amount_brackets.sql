-- Migration: Corriger la structure de la table loan_amount_brackets
-- Date: 2025-01-XX
-- Description: 
--   1. Aligner la structure de la table avec ce que le code attend
--   2. Renommer les colonnes montant_min/montant_max/taux vers min_amount/max_amount/default_interest_rate
--   3. Ajouter les colonnes manquantes (label, is_active, manager_id, updated_at)
--   4. Permettre NULL sur max_amount et default_interest_rate

-- Cette migration a déjà été appliquée via MCP Supabase
-- Elle est documentée ici pour référence

-- Les corrections appliquées :
-- 1. Renommage des colonnes : montant_min -> min_amount, montant_max -> max_amount, taux -> default_interest_rate
-- 2. Ajout des colonnes : label, is_active, manager_id, updated_at
-- 3. Modification de max_amount et default_interest_rate pour permettre NULL

