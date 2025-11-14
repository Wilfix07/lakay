-- Migration: Renforcer l'isolation des données par manager
-- Date: 2025-11-14
-- Objectifs :
--   * Supprimer les politiques permissives par défaut sur les tables métier
--   * Créer des politiques spécifiques aux agents/managers pour membres, prêts et remboursements
--   * Restreindre les écritures aux seules données appartenant au manager connecté
--   * Ajouter l'isolation sur les tables de configuration dynamique
--   * Empêcher les managers de consulter les agents d'autres managers

-- 1. Supprimer les politiques génériques qui exposent toutes les données
DROP POLICY IF EXISTS "Allow anonymous full access to membres" ON membres;
DROP POLICY IF EXISTS "Allow authenticated users full access to membres" ON membres;
DROP POLICY IF EXISTS "Allow anonymous full access to prets" ON prets;
DROP POLICY IF EXISTS "Allow authenticated users full access to prets" ON prets;
DROP POLICY IF EXISTS "Allow anonymous full access to remboursements" ON remboursements;
DROP POLICY IF EXISTS "Allow authenticated users full access to remboursements" ON remboursements;

-- 2. Politiques dédiées pour les agents (gestion de leurs propres données)
DROP POLICY IF EXISTS agent_manage_own_membres ON membres;
CREATE POLICY agent_manage_own_membres
    ON membres
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = membres.agent_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = membres.agent_id
        )
    );

DROP POLICY IF EXISTS agent_manage_own_prets ON prets;
CREATE POLICY agent_manage_own_prets
    ON prets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = prets.agent_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = prets.agent_id
        )
    );

DROP POLICY IF EXISTS agent_manage_own_remboursements ON remboursements;
CREATE POLICY agent_manage_own_remboursements
    ON remboursements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = remboursements.agent_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = remboursements.agent_id
        )
    );

DROP POLICY IF EXISTS agent_manage_own_agent_expenses ON agent_expenses;
CREATE POLICY agent_manage_own_agent_expenses
    ON agent_expenses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = agent_expenses.agent_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'agent'
              AND up.agent_id = agent_expenses.agent_id
        )
    );

-- 3. Collatéraux : managers ne voient que leurs prêts
DROP POLICY IF EXISTS admin_manager_full_access_collaterals ON collaterals;

CREATE POLICY admin_all_collaterals
    ON collaterals
    FOR ALL
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

DROP POLICY IF EXISTS manager_own_collaterals ON collaterals;
CREATE POLICY manager_own_collaterals
    ON collaterals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            JOIN prets p ON p.pret_id = collaterals.pret_id
            JOIN agents a ON a.agent_id = p.agent_id
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND a.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            JOIN prets p ON p.pret_id = collaterals.pret_id
            JOIN agents a ON a.agent_id = p.agent_id
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND a.manager_id = up.id
        )
    );

-- 4. Empêcher les managers d'écrire des données "globales" chez les autres
DROP POLICY IF EXISTS manager_own_loan_amount_brackets ON loan_amount_brackets;
CREATE POLICY manager_own_loan_amount_brackets
    ON loan_amount_brackets
    FOR ALL
    USING (
        (
            manager_id IS NULL
            AND EXISTS (
                SELECT 1
                FROM user_profiles up
                WHERE up.id = auth.uid()
                  AND up.role IN ('manager','agent')
            )
        )
        OR EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND loan_amount_brackets.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND loan_amount_brackets.manager_id = up.id
        )
    );

DROP POLICY IF EXISTS manager_own_expense_categories ON expense_categories;
CREATE POLICY manager_own_expense_categories
    ON expense_categories
    FOR ALL
    USING (
        (
            manager_id IS NULL
            AND EXISTS (
                SELECT 1
                FROM user_profiles up
                WHERE up.id = auth.uid()
                  AND up.role IN ('manager','agent')
            )
        )
        OR EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND expense_categories.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND expense_categories.manager_id = up.id
        )
    );

-- 5. Isolation renforcée sur user_profiles (les managers ne voient que leurs agents)
DROP POLICY IF EXISTS "Managers can view agents" ON user_profiles;
CREATE POLICY manager_view_own_agents
    ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles managers
            JOIN agents a ON a.agent_id = user_profiles.agent_id
            WHERE managers.id = auth.uid()
              AND managers.role = 'manager'
              AND user_profiles.role = 'agent'
              AND a.manager_id = managers.id
        )
    );

-- 6. Activer la RLS sur les tables de paramètres dynamiques et créer les politiques
ALTER TABLE month_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayment_frequencies ENABLE ROW LEVEL SECURITY;

-- Month names
DROP POLICY IF EXISTS admin_manage_month_names ON month_names;
CREATE POLICY admin_manage_month_names
    ON month_names
    FOR ALL
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

DROP POLICY IF EXISTS manager_manage_month_names ON month_names;
CREATE POLICY manager_manage_month_names
    ON month_names
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND month_names.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND month_names.manager_id = up.id
        )
    );

DROP POLICY IF EXISTS manager_read_month_names ON month_names;
CREATE POLICY manager_read_month_names
    ON month_names
    FOR SELECT
    USING (
        (
            month_names.manager_id IS NULL
            AND EXISTS (
                SELECT 1
                FROM user_profiles up
                WHERE up.id = auth.uid()
                  AND up.role IN ('manager','agent')
            )
        )
        OR EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND month_names.manager_id = up.id
        )
    );

-- Repayment frequencies
DROP POLICY IF EXISTS admin_manage_repayment_frequencies ON repayment_frequencies;
CREATE POLICY admin_manage_repayment_frequencies
    ON repayment_frequencies
    FOR ALL
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

DROP POLICY IF EXISTS manager_manage_repayment_frequencies ON repayment_frequencies;
CREATE POLICY manager_manage_repayment_frequencies
    ON repayment_frequencies
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND repayment_frequencies.manager_id = up.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND repayment_frequencies.manager_id = up.id
        )
    );

DROP POLICY IF EXISTS manager_read_repayment_frequencies ON repayment_frequencies;
CREATE POLICY manager_read_repayment_frequencies
    ON repayment_frequencies
    FOR SELECT
    USING (
        (
            repayment_frequencies.manager_id IS NULL
            AND EXISTS (
                SELECT 1
                FROM user_profiles up
                WHERE up.id = auth.uid()
                  AND up.role IN ('manager','agent')
            )
        )
        OR EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'manager'
              AND repayment_frequencies.manager_id = up.id
        )
    );

