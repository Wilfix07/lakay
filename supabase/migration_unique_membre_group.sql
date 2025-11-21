-- Migration: Empêcher qu'un membre soit assigné à plusieurs groupes
-- Date: 2025-01-XX
-- Description: Cette migration nettoie les doublons existants et ajoute une contrainte unique
--              pour garantir qu'un membre ne peut être assigné qu'à un seul groupe à la fois

-- Étape 1: Supprimer les doublons en gardant seulement l'assignation la plus récente pour chaque membre
-- On utilise une sous-requête pour identifier les lignes à supprimer (celles qui ne sont pas les plus récentes)
DELETE FROM membre_group_members
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY membre_id ORDER BY id DESC) as rn
        FROM membre_group_members
    ) t
    WHERE rn > 1
);

-- Étape 2: Ajouter une contrainte unique sur membre_id pour empêcher les futurs doublons
-- D'abord, vérifier si la contrainte n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'membre_group_members_membre_id_unique'
        AND conrelid = 'membre_group_members'::regclass
    ) THEN
        ALTER TABLE membre_group_members
        ADD CONSTRAINT membre_group_members_membre_id_unique UNIQUE (membre_id);
    END IF;
END $$;

-- Commentaire pour documenter la contrainte
COMMENT ON CONSTRAINT membre_group_members_membre_id_unique ON membre_group_members IS 
'Garantit qu''un membre ne peut être assigné qu''à un seul groupe à la fois';

