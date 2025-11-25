-- Migration: Isolation complète des données par manager
-- Date: 2025-01-XX
-- Description: S'assure qu'aucun manager ne peut voir les données d'autres managers
--              Renforce toutes les politiques RLS pour garantir l'isolation complète

-- ===================================================================
-- 1. USER_PROFILES - Isolation des agents et chefs de zone
-- ===================================================================

-- Activer RLS sur user_profiles si ce n'est pas déjà fait
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques permissives
DROP POLICY IF EXISTS manager_view_agents ON user_profiles;
DROP POLICY IF EXISTS manager_view_chefs_zone ON user_profiles;

-- Manager peut voir uniquement ses propres agents (via agents.manager_id)
CREATE POLICY manager_view_own_agents
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Si c'est un agent, vérifier qu'il appartient au manager
    role = 'agent'
    AND EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN agents a ON a.agent_id::text = user_profiles.agent_id::text
      WHERE up.id = auth.uid()
        AND up.role = 'manager'
        AND a.manager_id = up.id::text
    )
  );

-- Manager peut voir uniquement les chefs de zone de son portefeuille
CREATE POLICY manager_view_own_chefs_zone
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Si c'est un chef de zone, vérifier qu'il est lié aux agents du manager
    role = 'chef_zone'
    AND EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'manager'
        AND (
          -- Chef de zone attaché directement à un agent du manager
          EXISTS (
            SELECT 1
            FROM agents a
            WHERE a.manager_id = up.id::text
              AND a.agent_id = user_profiles.agent_id
          )
          OR
          -- Chef de zone qui a des membres assignés appartenant aux agents du manager
          EXISTS (
            SELECT 1
            FROM agents a
            JOIN membres m ON m.agent_id = a.agent_id
            JOIN chef_zone_membres czm ON czm.membre_id = m.membre_id
            WHERE a.manager_id = up.id::text
              AND czm.chef_zone_id = user_profiles.id
          )
        )
    )
  );

-- Manager ne peut PAS voir les autres managers
-- (Aucune politique spécifique = pas d'accès)

-- ===================================================================
-- 2. GROUP_PRETS - Isolation des prêts de groupe
-- ===================================================================

-- Activer RLS si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_prets') THEN
        ALTER TABLE group_prets ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques permissives
        DROP POLICY IF EXISTS manager_own_group_prets ON group_prets;
        DROP POLICY IF EXISTS "Allow authenticated users full access to group_prets" ON group_prets;
        
        -- Manager peut voir uniquement les prêts de groupe de ses agents
        CREATE POLICY manager_own_group_prets
          ON group_prets
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN agents a ON a.agent_id = group_prets.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN agents a ON a.agent_id = group_prets.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- ===================================================================
-- 3. GROUP_REMBOURSEMENTS - Isolation des remboursements de groupe
-- ===================================================================

-- Activer RLS si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_remboursements') THEN
        ALTER TABLE group_remboursements ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques permissives
        DROP POLICY IF EXISTS manager_own_group_remboursements ON group_remboursements;
        DROP POLICY IF EXISTS "Allow authenticated users full access to group_remboursements" ON group_remboursements;
        
        -- Manager peut voir uniquement les remboursements de groupe de ses agents
        CREATE POLICY manager_own_group_remboursements
          ON group_remboursements
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN agents a ON a.agent_id = group_remboursements.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN agents a ON a.agent_id = group_remboursements.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- ===================================================================
-- 4. EPARGNE_TRANSACTIONS - Isolation des transactions d'épargne
-- ===================================================================

-- Activer RLS si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'epargne_transactions') THEN
        ALTER TABLE epargne_transactions ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques permissives
        DROP POLICY IF EXISTS manager_own_epargne_transactions ON epargne_transactions;
        DROP POLICY IF EXISTS "Allow authenticated users full access to epargne_transactions" ON epargne_transactions;
        
        -- Manager peut voir uniquement les transactions d'épargne des membres de ses agents
        CREATE POLICY manager_own_epargne_transactions
          ON epargne_transactions
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = epargne_transactions.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = epargne_transactions.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- ===================================================================
-- 5. COLLATERALS - Isolation des garanties
-- ===================================================================

-- Activer RLS si ce n'est pas déjà fait
ALTER TABLE collaterals ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques permissives pour les managers
DROP POLICY IF EXISTS admin_manager_full_access_collaterals ON collaterals;

-- Admin peut voir toutes les garanties
CREATE POLICY admin_all_collaterals
  ON collaterals
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  );

-- Manager peut voir uniquement les garanties des membres de ses agents (prêts individuels uniquement)
DO $$
BEGIN
    -- Vérifier si la colonne group_pret_id existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collaterals' AND column_name = 'group_pret_id') THEN
        -- Si la colonne existe, exclure les collaterals de groupe
        DROP POLICY IF EXISTS manager_own_collaterals ON collaterals;
        
        CREATE POLICY manager_own_collaterals
          ON collaterals
          FOR ALL
          TO authenticated
          USING (
            collaterals.group_pret_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = collaterals.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            collaterals.group_pret_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = collaterals.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    ELSE
        -- Si la colonne n'existe pas, créer la politique sans condition group_pret_id
        DROP POLICY IF EXISTS manager_own_collaterals ON collaterals;
        
        CREATE POLICY manager_own_collaterals
          ON collaterals
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = collaterals.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = collaterals.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- Pour les collaterals de groupe (group_pret_id), vérifier via group_prets
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collaterals' AND column_name = 'group_pret_id') THEN
        DROP POLICY IF EXISTS manager_own_group_collaterals ON collaterals;
        
        CREATE POLICY manager_own_group_collaterals
          ON collaterals
          FOR ALL
          TO authenticated
          USING (
            collaterals.group_pret_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN group_prets ON group_prets.pret_id = collaterals.group_pret_id
              JOIN agents a ON a.agent_id = group_prets.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            collaterals.group_pret_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN group_prets ON group_prets.pret_id = collaterals.group_pret_id
              JOIN agents a ON a.agent_id = group_prets.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- ===================================================================
-- 6. MEMBRE_GROUPS - Isolation des groupes de membres
-- ===================================================================

-- Activer RLS si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'membre_groups') THEN
        ALTER TABLE membre_groups ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques permissives
        DROP POLICY IF EXISTS manager_own_membre_groups ON membre_groups;
        DROP POLICY IF EXISTS "Allow authenticated users full access to membre_groups" ON membre_groups;
        
        -- Manager peut voir uniquement les groupes contenant des membres de ses agents
        CREATE POLICY manager_own_membre_groups
          ON membre_groups
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membre_group_members mgm ON mgm.group_id = membre_groups.id
              JOIN membres ON membres.membre_id = mgm.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membre_group_members mgm ON mgm.group_id = membre_groups.id
              JOIN membres ON membres.membre_id = mgm.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- ===================================================================
-- 7. CHEF_ZONE_MEMBRES - Isolation des assignations chef de zone
-- ===================================================================

-- Activer RLS si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chef_zone_membres') THEN
        ALTER TABLE chef_zone_membres ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques permissives
        DROP POLICY IF EXISTS manager_own_chef_zone_membres ON chef_zone_membres;
        DROP POLICY IF EXISTS "Allow authenticated users full access to chef_zone_membres" ON chef_zone_membres;
        
        -- Manager peut voir uniquement les assignations de membres de ses agents
        CREATE POLICY manager_own_chef_zone_membres
          ON chef_zone_membres
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = chef_zone_membres.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = chef_zone_membres.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- ===================================================================
-- 8. MEMBRE_GROUP_MEMBERS - Isolation des membres de groupes
-- ===================================================================

-- Activer RLS si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'membre_group_members') THEN
        ALTER TABLE membre_group_members ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques permissives
        DROP POLICY IF EXISTS manager_own_membre_group_members ON membre_group_members;
        DROP POLICY IF EXISTS "Allow authenticated users full access to membre_group_members" ON membre_group_members;
        
        -- Manager peut voir uniquement les membres de groupes appartenant à ses agents
        CREATE POLICY manager_own_membre_group_members
          ON membre_group_members
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = membre_group_members.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM user_profiles up
              JOIN membres ON membres.membre_id = membre_group_members.membre_id
              JOIN agents a ON a.agent_id = membres.agent_id
              WHERE up.id = auth.uid()
                AND up.role = 'manager'
                AND a.manager_id = up.id::text
            )
          );
    END IF;
END $$;

-- ===================================================================
-- 9. Vérification finale - S'assurer que RLS est activé partout
-- ===================================================================

-- Vérifier que RLS est activé sur toutes les tables critiques
DO $$
BEGIN
    -- Activer RLS sur toutes les tables si ce n'est pas déjà fait
    ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE membres ENABLE ROW LEVEL SECURITY;
    ALTER TABLE prets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE remboursements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE agent_expenses ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    
    -- Tables optionnelles (peuvent ne pas exister)
    BEGIN
        ALTER TABLE group_prets ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE group_remboursements ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE epargne_transactions ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE membre_groups ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE membre_group_members ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE chef_zone_membres ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
END $$;

-- ===================================================================
-- 10. Commentaires pour documentation
-- ===================================================================

COMMENT ON POLICY manager_view_own_agents ON user_profiles IS 
'Les managers peuvent voir uniquement leurs propres agents (via agents.manager_id)';

COMMENT ON POLICY manager_view_own_chefs_zone ON user_profiles IS 
'Les managers peuvent voir uniquement les chefs de zone liés à leurs agents';

COMMENT ON POLICY manager_own_group_prets ON group_prets IS 
'Les managers peuvent voir uniquement les prêts de groupe de leurs agents';

COMMENT ON POLICY manager_own_group_remboursements ON group_remboursements IS 
'Les managers peuvent voir uniquement les remboursements de groupe de leurs agents';

COMMENT ON POLICY manager_own_epargne_transactions ON epargne_transactions IS 
'Les managers peuvent voir uniquement les transactions d''épargne des membres de leurs agents';

COMMENT ON POLICY manager_own_collaterals ON collaterals IS 
'Les managers peuvent voir uniquement les garanties des membres de leurs agents';

COMMENT ON POLICY manager_own_group_collaterals ON collaterals IS 
'Les managers peuvent voir uniquement les garanties de groupe de leurs agents';

COMMENT ON POLICY manager_own_membre_groups ON membre_groups IS 
'Les managers peuvent voir uniquement les groupes contenant des membres de leurs agents';

COMMENT ON POLICY manager_own_chef_zone_membres ON chef_zone_membres IS 
'Les managers peuvent voir uniquement les assignations de membres de leurs agents';

COMMENT ON POLICY manager_own_membre_group_members ON membre_group_members IS 
'Les managers peuvent voir uniquement les membres de groupes appartenant à leurs agents';

