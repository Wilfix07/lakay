-- Migration: Empêcher TOUS les doublons de prêts
-- Date: 2025-01-XX
-- Description: Cette migration ajoute des contraintes et vérifications pour empêcher
--              la création de prêts en double (même membre, même montant, même date, etc.)

-- Étape 1: Identifier et nettoyer les doublons existants (prêts identiques)
-- Un doublon est défini comme: même membre_id, même montant_pret, même date_decaissement, même agent_id
DO $$
DECLARE
    duplicate_record RECORD;
    duplicates_cursor CURSOR FOR
        SELECT 
            membre_id,
            montant_pret,
            date_decaissement,
            agent_id,
            COUNT(*) as count,
            array_agg(pret_id ORDER BY created_at DESC) as pret_ids,
            array_agg(id ORDER BY created_at DESC) as ids
        FROM prets
        WHERE statut != 'annule' -- Ignorer les prêts annulés
        GROUP BY membre_id, montant_pret, date_decaissement, agent_id
        HAVING COUNT(*) > 1;
BEGIN
    -- Parcourir tous les groupes de prêts en double
    FOR duplicate_record IN duplicates_cursor LOOP
        -- Garder le plus récent (premier dans le tableau trié) et annuler les autres
        FOR i IN 2..array_length(duplicate_record.ids, 1) LOOP
            UPDATE prets
            SET statut = 'annule',
                updated_at = NOW()
            WHERE id = duplicate_record.ids[i];
            
            RAISE NOTICE 'Prêt % annulé (doublon de %)', 
                (SELECT pret_id FROM prets WHERE id = duplicate_record.ids[i]),
                duplicate_record.pret_ids[1];
        END LOOP;
    END LOOP;
END $$;

-- Étape 2: Créer une fonction pour vérifier les doublons avant insertion
CREATE OR REPLACE FUNCTION check_duplicate_pret(
    p_membre_id VARCHAR(4),
    p_montant_pret DECIMAL(10, 2),
    p_date_decaissement DATE,
    p_agent_id VARCHAR(2),
    p_pret_id VARCHAR(50) DEFAULT NULL -- Pour exclure le prêt en cours d'édition
)
RETURNS TABLE(
    is_duplicate BOOLEAN,
    existing_pret_id VARCHAR(50),
    existing_statut VARCHAR(50)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_pret RECORD;
BEGIN
    -- Vérifier s'il existe un prêt identique (même membre, montant, date, agent)
    -- Exclure les prêts annulés et le prêt en cours d'édition si fourni
    SELECT pret_id, statut INTO existing_pret
    FROM prets
    WHERE membre_id = p_membre_id
      AND montant_pret = p_montant_pret
      AND date_decaissement = p_date_decaissement
      AND agent_id = p_agent_id
      AND statut != 'annule'
      AND (p_pret_id IS NULL OR pret_id != p_pret_id)
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, existing_pret.pret_id, existing_pret.statut;
    ELSE
        RETURN QUERY SELECT FALSE, NULL::VARCHAR(50), NULL::VARCHAR(50);
    END IF;
END;
$$;

-- Étape 3: Créer un trigger pour empêcher les doublons à l'insertion
-- Ce trigger vérifie les doublons avant d'autoriser l'insertion
CREATE OR REPLACE FUNCTION prevent_duplicate_pret_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    duplicate_check RECORD;
BEGIN
    -- Vérifier s'il existe un doublon
    SELECT * INTO duplicate_check
    FROM check_duplicate_pret(
        NEW.membre_id,
        NEW.montant_pret,
        NEW.date_decaissement,
        NEW.agent_id,
        NEW.pret_id
    );
    
    -- Si un doublon est trouvé, empêcher l'insertion
    IF duplicate_check.is_duplicate THEN
        RAISE EXCEPTION 'Un prêt identique existe déjà pour ce membre: % (statut: %). Un membre ne peut pas avoir deux prêts identiques (même montant, même date, même agent).',
            duplicate_check.existing_pret_id,
            duplicate_check.existing_statut;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Créer le trigger sur la table prets
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_pret ON prets;
CREATE TRIGGER trigger_prevent_duplicate_pret
    BEFORE INSERT ON prets
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_pret_trigger();

-- Étape 4: Faire de même pour les prêts de groupe (group_prets)
CREATE OR REPLACE FUNCTION check_duplicate_group_pret(
    p_group_id INTEGER,
    p_montant_pret DECIMAL(10, 2),
    p_date_decaissement DATE,
    p_agent_id VARCHAR(2),
    p_pret_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
    is_duplicate BOOLEAN,
    existing_pret_id VARCHAR(50),
    existing_statut VARCHAR(50)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_pret RECORD;
BEGIN
    SELECT pret_id, statut INTO existing_pret
    FROM group_prets
    WHERE group_id = p_group_id
      AND montant_pret = p_montant_pret
      AND date_decaissement = p_date_decaissement
      AND agent_id = p_agent_id
      AND statut != 'annule'
      AND (p_pret_id IS NULL OR pret_id != p_pret_id)
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, existing_pret.pret_id, existing_pret.statut;
    ELSE
        RETURN QUERY SELECT FALSE, NULL::VARCHAR(50), NULL::VARCHAR(50);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_duplicate_group_pret_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    duplicate_check RECORD;
BEGIN
    SELECT * INTO duplicate_check
    FROM check_duplicate_group_pret(
        NEW.group_id,
        NEW.montant_pret,
        NEW.date_decaissement,
        NEW.agent_id,
        NEW.pret_id
    );
    
    IF duplicate_check.is_duplicate THEN
        RAISE EXCEPTION 'Un prêt de groupe identique existe déjà: % (statut: %). Un groupe ne peut pas avoir deux prêts identiques (même montant, même date, même agent).',
            duplicate_check.existing_pret_id,
            duplicate_check.existing_statut;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Créer le trigger sur la table group_prets (si elle existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_prets') THEN
        DROP TRIGGER IF EXISTS trigger_prevent_duplicate_group_pret ON group_prets;
        CREATE TRIGGER trigger_prevent_duplicate_group_pret
            BEFORE INSERT ON group_prets
            FOR EACH ROW
            EXECUTE FUNCTION prevent_duplicate_group_pret_trigger();
    END IF;
END $$;

-- Étape 5: Ajouter des commentaires pour documenter
COMMENT ON FUNCTION check_duplicate_pret IS 
'Vérifie si un prêt identique existe déjà pour un membre (même membre_id, montant, date, agent). 
Retourne TRUE si un doublon est trouvé, FALSE sinon.';

COMMENT ON FUNCTION prevent_duplicate_pret_trigger IS 
'Trigger qui empêche l''insertion de prêts en double en vérifiant avant chaque insertion.';

-- Étape 6: Vérifier qu'il n'y a plus de doublons
DO $$
DECLARE
    doublons_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doublons_count
    FROM (
        SELECT 
            membre_id,
            montant_pret,
            date_decaissement,
            agent_id,
            COUNT(*) as count
        FROM prets
        WHERE statut != 'annule'
        GROUP BY membre_id, montant_pret, date_decaissement, agent_id
        HAVING COUNT(*) > 1
    ) subquery;
    
    IF doublons_count > 0 THEN
        RAISE WARNING 'Il reste % groupes de prêts en double après le nettoyage', doublons_count;
    ELSE
        RAISE NOTICE 'Aucun doublon détecté. La migration a réussi.';
    END IF;
END $$;

