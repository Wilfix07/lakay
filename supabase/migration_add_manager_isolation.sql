-- Migration: Isolation des données par manager
-- Date: 2024-12-19
-- Description: Ajoute manager_id à la table agents pour permettre l'isolation des données par manager

-- Étape 1: Ajouter la colonne manager_id à la table agents (si elle n'existe pas déjà)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name = 'manager_id'
    ) THEN
        ALTER TABLE agents ADD COLUMN manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Étape 2: Supprimer l'ancienne contrainte UNIQUE sur agent_id si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'agents_agent_id_key'
    ) THEN
        ALTER TABLE agents DROP CONSTRAINT agents_agent_id_key;
    END IF;
END $$;

-- Étape 3: Ajouter la nouvelle contrainte UNIQUE sur (agent_id, manager_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'agents_agent_id_manager_id_key'
    ) THEN
        ALTER TABLE agents ADD CONSTRAINT agents_agent_id_manager_id_key 
        UNIQUE (agent_id, manager_id);
    END IF;
END $$;

-- Étape 4: Créer un index sur manager_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_agents_manager_id ON agents(manager_id);

-- Étape 5: Activer RLS sur la table agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Étape 6: Créer les politiques RLS pour agents
-- Admin peut voir tous les agents
DROP POLICY IF EXISTS admin_all_agents ON agents;
CREATE POLICY admin_all_agents
    ON agents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

-- Manager peut voir et gérer uniquement ses propres agents
DROP POLICY IF EXISTS manager_own_agents ON agents;
CREATE POLICY manager_own_agents
    ON agents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.role = 'manager'
            AND agents.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.role = 'manager'
            AND agents.manager_id = up.id
        )
    );

-- Agent peut voir uniquement son propre agent record
DROP POLICY IF EXISTS agent_own_agent_record ON agents;
CREATE POLICY agent_own_agent_record
    ON agents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'agent'
            AND up.agent_id = agents.agent_id
        )
    );

-- Étape 7: Activer RLS sur les autres tables et ajouter des politiques pour l'isolation par manager
-- Membres: filtrer par manager via agents
ALTER TABLE membres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_membres ON membres;
CREATE POLICY admin_all_membres
    ON membres
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

DROP POLICY IF EXISTS manager_own_membres ON membres;
CREATE POLICY manager_own_membres
    ON membres
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = membres.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = membres.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    );

-- Prêts: filtrer par manager via agents
ALTER TABLE prets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_prets ON prets;
CREATE POLICY admin_all_prets
    ON prets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

DROP POLICY IF EXISTS manager_own_prets ON prets;
CREATE POLICY manager_own_prets
    ON prets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = prets.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = prets.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    );

-- Remboursements: filtrer par manager via agents
ALTER TABLE remboursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_remboursements ON remboursements;
CREATE POLICY admin_all_remboursements
    ON remboursements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

DROP POLICY IF EXISTS manager_own_remboursements ON remboursements;
CREATE POLICY manager_own_remboursements
    ON remboursements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = remboursements.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = remboursements.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    );

-- Dépenses des agents: filtrer par manager via agents
ALTER TABLE agent_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_agent_expenses ON agent_expenses;
CREATE POLICY admin_all_agent_expenses
    ON agent_expenses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

DROP POLICY IF EXISTS manager_own_agent_expenses ON agent_expenses;
CREATE POLICY manager_own_agent_expenses
    ON agent_expenses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = agent_expenses.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN agents a ON a.agent_id = agent_expenses.agent_id
            WHERE up.id = auth.uid()
            AND up.role = 'manager'
            AND a.manager_id = up.id
        )
    );

-- Note: Pour les agents existants sans manager_id, vous devrez les assigner manuellement
-- ou créer une migration de données. Les agents existants resteront accessibles aux admins uniquement.

