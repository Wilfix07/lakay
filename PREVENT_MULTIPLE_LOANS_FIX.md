# Correction: Empêcher les Prêts Multiples Actifs par Membre

## Problème Identifié

Un membre (Julienne Marc) avait 2 crédits actifs dans le système (CL-002-Nov et CL-007-Nov). Cela ne devrait jamais se produire car un membre ne peut avoir qu'UN SEUL prêt actif à la fois.

## Solution Implémentée

### 1. Migration de Base de Données

**Fichier**: `supabase/migration_prevent_multiple_active_loans.sql`

Cette migration :
- ✅ Nettoie les doublons existants (garde le plus récent, annule les autres)
- ✅ Supprime l'ancien index unique qui ne couvrait que le statut 'actif'
- ✅ Crée un nouvel index unique partiel qui couvre TOUS les statuts actifs :
  - `actif`
  - `en_attente_garantie`
  - `en_attente_approbation`

**Contrainte Unique**:
```sql
CREATE UNIQUE INDEX uniq_prets_membre_actif 
ON prets(membre_id) 
WHERE statut IN ('actif', 'en_attente_garantie', 'en_attente_approbation');
```

Cette contrainte garantit qu'un membre ne peut avoir qu'UN SEUL prêt avec l'un de ces statuts à la fois, même si plusieurs requêtes sont faites simultanément.

### 2. Amélioration de la Validation Côté Application

**Fichier**: `app/prets/page.tsx`

#### A. Validation Avant Création (ligne ~672)
- ✅ Vérification améliorée des prêts actifs avant création
- ✅ Message d'erreur plus clair et informatif
- ✅ Liste tous les prêts actifs du membre s'il y en a plusieurs

#### B. Gestion des Erreurs de Contrainte Unique (ligne ~955)
- ✅ Capture les violations de contrainte unique (code 23505)
- ✅ Affiche un message d'erreur détaillé si la contrainte est violée
- ✅ Empêche la création silencieuse de doublons

#### C. Validation Avant Modification (ligne ~1279)
- ✅ Vérifie qu'un membre n'a pas déjà un autre prêt actif avant de modifier
- ✅ Empêche de changer le membre_id vers un membre qui a déjà un prêt actif

#### D. Gestion des Erreurs lors de la Mise à Jour (ligne ~1411)
- ✅ Capture les violations de contrainte unique lors de la mise à jour
- ✅ Affiche un message d'erreur détaillé

### 3. Mise à Jour du Schéma

**Fichier**: `supabase/schema.sql`

L'index unique a été mis à jour pour couvrir tous les statuts actifs :
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uniq_prets_membre_actif 
ON prets(membre_id) 
WHERE statut IN ('actif', 'en_attente_garantie', 'en_attente_approbation');
```

## Comment Appliquer la Migration

### Option 1: Via Supabase Dashboard
1. Allez dans votre projet Supabase
2. Ouvrez l'éditeur SQL
3. Copiez-collez le contenu de `supabase/migration_prevent_multiple_active_loans.sql`
4. Exécutez la migration

### Option 2: Via Supabase CLI
```bash
supabase migration up
```

### Option 3: Via MCP Supabase (si configuré)
La migration peut être appliquée via l'outil `mcp_supabase_apply_migration`.

## Résultat Attendu

Après l'application de la migration :

1. ✅ **Les doublons existants sont nettoyés** :
   - Pour chaque membre avec plusieurs prêts actifs, seul le plus récent est conservé
   - Les autres sont automatiquement annulés (statut = 'annule')

2. ✅ **La contrainte unique empêche les futurs doublons** :
   - Impossible d'insérer un nouveau prêt si le membre a déjà un prêt actif
   - La base de données rejette automatiquement la requête avec une erreur de contrainte unique

3. ✅ **La validation côté application est renforcée** :
   - Vérification avant création
   - Vérification avant modification
   - Messages d'erreur clairs et informatifs
   - Gestion des erreurs de contrainte unique

## Test de la Solution

Pour tester que la solution fonctionne :

1. **Test 1: Créer un prêt pour un membre qui a déjà un prêt actif**
   - Résultat attendu: ❌ Erreur avec message clair

2. **Test 2: Essayer de modifier un prêt pour changer le membre vers un membre qui a déjà un prêt actif**
   - Résultat attendu: ❌ Erreur avec message clair

3. **Test 3: Créer un prêt pour un membre qui n'a pas de prêt actif**
   - Résultat attendu: ✅ Succès

4. **Test 4: Vérifier qu'après la migration, il n'y a plus de doublons**
   - Résultat attendu: ✅ Aucun membre avec plusieurs prêts actifs

## Notes Importantes

- ⚠️ **La migration annule automatiquement les prêts en double** (garde le plus récent)
- ⚠️ **Si vous voulez garder un prêt spécifique au lieu du plus récent**, modifiez la migration avant de l'exécuter
- ✅ **La contrainte unique fonctionne même en cas de requêtes simultanées** (race condition)
- ✅ **La validation côté application est une couche supplémentaire de sécurité** mais la contrainte DB est la protection principale

## Fichiers Modifiés

1. ✅ `supabase/migration_prevent_multiple_active_loans.sql` - Nouvelle migration
2. ✅ `supabase/schema.sql` - Index unique mis à jour
3. ✅ `app/prets/page.tsx` - Validation et gestion d'erreurs améliorées

---

**Date**: 2025-01-XX  
**Statut**: ✅ Implémenté et prêt à être appliqué

