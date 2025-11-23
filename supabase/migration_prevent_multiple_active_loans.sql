-- Migration: Empêcher qu'un membre ait plusieurs prêts actifs simultanément
-- Date: 2025-01-XX
-- Description: Cette migration nettoie les doublons existants et ajoute une contrainte unique
--              pour empêcher qu'un membre ait plusieurs prêts avec les statuts actifs simultanément

-- Étape 1: Identifier et nettoyer les doublons existants
-- Pour chaque membre ayant plusieurs prêts actifs, on garde le plus récent et on annule les autres
DO $$
DECLARE
    membre_record RECORD;
    pret_record RECORD;
    prets_actifs CURSOR FOR
        SELECT membre_id, COUNT(*) as count
        FROM prets
        WHERE statut IN ('actif', 'en_attente_garantie', 'en_attente_approbation')
        GROUP BY membre_id
        HAVING COUNT(*) > 1;
BEGIN
    -- Parcourir tous les membres avec plusieurs prêts actifs
    FOR membre_record IN prets_actifs LOOP
        -- Récupérer tous les prêts actifs de ce membre, triés par date de création (plus récent en premier)
        FOR pret_record IN
            SELECT pret_id, id, created_at
            FROM prets
            WHERE membre_id = membre_record.membre_id
              AND statut IN ('actif', 'en_attente_garantie', 'en_attente_approbation')
            ORDER BY created_at DESC
        LOOP
            -- Garder le premier (le plus récent) et annuler les autres
            IF pret_record.id != (
                SELECT id FROM prets
                WHERE membre_id = membre_record.membre_id
                  AND statut IN ('actif', 'en_attente_garantie', 'en_attente_approbation')
                ORDER BY created_at DESC
                LIMIT 1
            ) THEN
                -- Annuler les prêts en double
                UPDATE prets
                SET statut = 'annule',
                    updated_at = NOW()
                WHERE id = pret_record.id;
                
                RAISE NOTICE 'Prêt % annulé pour le membre % (doublon)', pret_record.pret_id, membre_record.membre_id;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Étape 2: Supprimer l'ancien index unique partiel qui ne couvrait que 'actif'
DROP INDEX IF EXISTS uniq_prets_membre_actif;

-- Étape 3: Créer un nouvel index unique partiel qui couvre TOUS les statuts actifs
-- Cet index empêche qu'un membre ait plusieurs prêts avec l'un de ces statuts simultanément:
-- - 'actif'
-- - 'en_attente_garantie'
-- - 'en_attente_approbation'
CREATE UNIQUE INDEX IF NOT EXISTS uniq_prets_membre_actif 
ON prets(membre_id) 
WHERE statut IN ('actif', 'en_attente_garantie', 'en_attente_approbation');

-- Étape 4: Ajouter un commentaire pour documenter la contrainte
COMMENT ON INDEX uniq_prets_membre_actif IS 
'Contrainte unique empêchant qu''un membre ait plusieurs prêts actifs simultanément. 
Couvre les statuts: actif, en_attente_garantie, en_attente_approbation';

-- Étape 5: Vérifier qu'il n'y a plus de doublons
DO $$
DECLARE
    doublons_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doublons_count
    FROM (
        SELECT membre_id, COUNT(*) as count
        FROM prets
        WHERE statut IN ('actif', 'en_attente_garantie', 'en_attente_approbation')
        GROUP BY membre_id
        HAVING COUNT(*) > 1
    ) subquery;
    
    IF doublons_count > 0 THEN
        RAISE WARNING 'Il reste % membres avec plusieurs prêts actifs après le nettoyage', doublons_count;
    ELSE
        RAISE NOTICE 'Aucun doublon détecté. La migration a réussi.';
    END IF;
END $$;




