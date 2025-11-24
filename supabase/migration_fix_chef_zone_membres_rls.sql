-- Migration: Fix RLS Policies for chef_zone_membres INSERT
-- Date: 2025-01-XX
-- Description: Corriger les politiques RLS pour permettre INSERT avec des erreurs explicites

-- ============================================================================
-- 1. Vérifier que RLS est activé
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'chef_zone_membres'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.chef_zone_membres ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur chef_zone_membres';
  ELSE
    RAISE NOTICE 'RLS déjà activé sur chef_zone_membres';
  END IF;
END $$;

-- ============================================================================
-- 2. Supprimer les anciennes politiques INSERT pour éviter les conflits
-- ============================================================================
DROP POLICY IF EXISTS chef_zone_membres_insert_admin_manager ON public.chef_zone_membres;

-- ============================================================================
-- 3. Créer une politique INSERT optimisée
-- ============================================================================
-- Utilisation de (SELECT auth.uid()) pour éviter la réévaluation pour chaque ligne
-- Cela améliore les performances et évite les erreurs silencieuses
CREATE POLICY chef_zone_membres_insert_admin_manager
ON public.chef_zone_membres
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = (SELECT auth.uid())
    AND up.role IN ('admin', 'manager')
  )
);

-- ============================================================================
-- 4. Vérifier/Créer la politique ALL pour UPDATE/DELETE
-- ============================================================================
DO $$
BEGIN
  -- Supprimer l'ancienne politique ALL si elle existe
  DROP POLICY IF EXISTS chef_zone_membres_modify_admin_manager ON public.chef_zone_membres;
  
  -- Créer une nouvelle politique ALL optimisée
  CREATE POLICY chef_zone_membres_modify_admin_manager
  ON public.chef_zone_membres
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role IN ('admin', 'manager')
    )
  );
  
  RAISE NOTICE 'Politique ALL créée pour chef_zone_membres';
END $$;

-- ============================================================================
-- 5. Vérification finale
-- ============================================================================
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Vérifier que les politiques existent
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'chef_zone_membres'
  AND cmd IN ('INSERT', 'ALL');
  
  IF policy_count < 2 THEN
    RAISE EXCEPTION 'Les politiques RLS n''ont pas été créées correctement. Nombre de politiques trouvées: %', policy_count;
  ELSE
    RAISE NOTICE 'Migration réussie: % politiques RLS créées pour chef_zone_membres', policy_count;
  END IF;
END $$;

-- ============================================================================
-- 6. Liste des politiques créées (pour référence)
-- ============================================================================
-- Les politiques suivantes existent maintenant:
-- 1. chef_zone_membres_insert_admin_manager (INSERT)
-- 2. chef_zone_membres_modify_admin_manager (ALL: UPDATE, DELETE)
-- 3. chef_zone_membres_select_admin_manager (SELECT)
-- 4. chef_zone_membres_select_own (SELECT pour chef_zone)

