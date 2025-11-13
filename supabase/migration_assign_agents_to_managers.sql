-- Migration: Assigner les agents sans manager_id aux managers existants
-- Date: 2024-12-19
-- Description: Cette migration assigne les agents existants sans manager_id au premier manager disponible

-- Étape 1: Assigner tous les agents sans manager_id au premier manager trouvé
DO $$
DECLARE
    first_manager_id UUID;
    agents_count INTEGER;
BEGIN
    -- Trouver le premier manager disponible
    SELECT id INTO first_manager_id
    FROM user_profiles
    WHERE role = 'manager'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Si un manager existe, assigner les agents sans manager_id
    IF first_manager_id IS NOT NULL THEN
        -- Compter les agents à assigner
        SELECT COUNT(*) INTO agents_count
        FROM agents
        WHERE manager_id IS NULL;
        
        -- Assigner les agents au manager
        UPDATE agents
        SET manager_id = first_manager_id,
            updated_at = NOW()
        WHERE manager_id IS NULL;
        
        RAISE NOTICE 'Assigned % agents to manager %', agents_count, first_manager_id;
    ELSE
        RAISE NOTICE 'No manager found. Agents without manager_id will remain unassigned.';
    END IF;
END $$;

-- Note: Pour réassigner des agents à un autre manager, vous pouvez exécuter:
-- UPDATE agents 
-- SET manager_id = 'UUID_DU_MANAGER', updated_at = NOW()
-- WHERE agent_id = 'XX';

