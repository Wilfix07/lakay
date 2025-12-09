# Protection contre les doublons de prêts

## 📋 Résumé

Des mesures complètes ont été mises en place pour empêcher **TOUS** les doublons de prêts dans le système, pas seulement les prêts actifs.

## 🔒 Protections implémentées

### 1. **Migration SQL** (`supabase/migration_prevent_duplicate_loans.sql`)

#### Nettoyage des doublons existants
- Identifie et annule automatiquement les prêts en double existants
- Un doublon est défini comme: même `membre_id`, même `montant_pret`, même `date_decaissement`, même `agent_id`
- Garde le prêt le plus récent et annule les autres

#### Fonctions de vérification
- **`check_duplicate_pret()`**: Vérifie si un prêt identique existe déjà pour un membre
- **`check_duplicate_group_pret()`**: Vérifie si un prêt de groupe identique existe déjà

#### Triggers de base de données
- **`trigger_prevent_duplicate_pret`**: Empêche l'insertion de prêts en double au niveau de la base de données
- **`trigger_prevent_duplicate_group_pret`**: Empêche l'insertion de prêts de groupe en double

Ces triggers fonctionnent comme une **sécurité de dernier recours** et empêchent les doublons même si le code applicatif échoue.

### 2. **Vérifications côté application** (`app/prets/page.tsx`)

#### Avant la création d'un prêt
- Vérifie les doublons exacts avant l'insertion
- Affiche un message d'erreur clair si un doublon est détecté
- Empêche la création du prêt si un doublon existe

#### Avant la modification d'un prêt
- Vérifie les doublons si les champs clés sont modifiés (membre, montant, date, agent)
- Exclut le prêt en cours d'édition de la vérification
- Empêche la modification si elle créerait un doublon

#### Gestion des erreurs
- Capture les erreurs du trigger de base de données
- Affiche des messages d'erreur explicites pour les doublons
- Gère les erreurs de contrainte unique existante

## 🎯 Critères de détection des doublons

Un prêt est considéré comme un doublon si **TOUS** ces critères sont identiques:
- ✅ Même `membre_id` (ou `group_id` pour les prêts de groupe)
- ✅ Même `montant_pret`
- ✅ Même `date_decaissement`
- ✅ Même `agent_id`

**Note**: Les prêts annulés (`statut = 'annule'`) sont exclus de la vérification.

## 📝 Comment utiliser

### Exécuter la migration

1. **Via Supabase Dashboard**:
   - Allez dans SQL Editor
   - Copiez le contenu de `supabase/migration_prevent_duplicate_loans.sql`
   - Exécutez la requête

2. **Via Supabase CLI**:
   ```bash
   supabase migration new prevent_duplicate_loans
   # Copiez le contenu dans le fichier de migration créé
   supabase db push
   ```

### Vérifier que la migration a réussi

La migration affichera un message:
- ✅ `Aucun doublon détecté. La migration a réussi.` - Tout est OK
- ⚠️ `Il reste X groupes de prêts en double après le nettoyage` - Des doublons existent encore

## 🛡️ Niveaux de protection

### Niveau 1: Vérification côté application (avant insertion)
- ✅ Vérifie les doublons avant d'insérer dans la base
- ✅ Message d'erreur clair pour l'utilisateur
- ✅ Empêche la création/modification si doublon détecté

### Niveau 2: Trigger de base de données (pendant insertion)
- ✅ Vérifie les doublons au moment de l'insertion
- ✅ Empêche l'insertion même si le code applicatif échoue
- ✅ Message d'erreur PostgreSQL explicite

### Niveau 3: Contrainte unique existante
- ✅ Contrainte unique sur `pret_id` (empêche les IDs dupliqués)
- ✅ Index unique partiel `uniq_prets_membre_actif` (empêche plusieurs prêts actifs)

## 🔍 Exemples de messages d'erreur

### Doublon détecté avant insertion
```
❌ DOUBLON DÉTECTÉ: Un prêt identique existe déjà pour ce membre!

Prêt existant: CL-001-Janv (statut: actif)

Un membre ne peut pas avoir deux prêts identiques avec:
- Le même montant (5000 HTG)
- La même date de décaissement (2025-01-15)
- Le même agent (A1)

Veuillez vérifier le prêt existant ou modifier les informations.
```

### Erreur du trigger de base de données
```
❌ DOUBLON DÉTECTÉ: Un prêt identique existe déjà pour ce membre: CL-001-Janv (statut: actif). 
Un membre ne peut pas avoir deux prêts identiques (même montant, même date, même agent).

Veuillez vérifier les informations du prêt.
```

## ⚙️ Maintenance

### Vérifier les doublons manuellement

```sql
-- Vérifier les doublons de prêts individuels
SELECT 
    membre_id,
    montant_pret,
    date_decaissement,
    agent_id,
    COUNT(*) as count,
    array_agg(pret_id) as pret_ids
FROM prets
WHERE statut != 'annule'
GROUP BY membre_id, montant_pret, date_decaissement, agent_id
HAVING COUNT(*) > 1;

-- Vérifier les doublons de prêts de groupe
SELECT 
    group_id,
    montant_pret,
    date_decaissement,
    agent_id,
    COUNT(*) as count,
    array_agg(pret_id) as pret_ids
FROM group_prets
WHERE statut != 'annule'
GROUP BY group_id, montant_pret, date_decaissement, agent_id
HAVING COUNT(*) > 1;
```

### Désactiver temporairement les triggers (non recommandé)

```sql
-- Désactiver le trigger (pour maintenance uniquement)
ALTER TABLE prets DISABLE TRIGGER trigger_prevent_duplicate_pret;

-- Réactiver le trigger
ALTER TABLE prets ENABLE TRIGGER trigger_prevent_duplicate_pret;
```

## ✅ Tests recommandés

1. **Test de création de doublon**:
   - Créer un prêt pour un membre
   - Essayer de créer un prêt identique (même membre, montant, date, agent)
   - Vérifier que l'erreur est affichée

2. **Test de modification créant un doublon**:
   - Modifier un prêt pour qu'il corresponde à un autre prêt existant
   - Vérifier que l'erreur est affichée

3. **Test avec prêts annulés**:
   - Créer un prêt
   - L'annuler
   - Créer un prêt identique
   - Vérifier que cela fonctionne (les prêts annulés ne comptent pas comme doublons)

## 📚 Fichiers modifiés

1. **`supabase/migration_prevent_duplicate_loans.sql`** (nouveau)
   - Migration SQL complète pour empêcher les doublons

2. **`app/prets/page.tsx`**
   - Ajout de vérifications de doublons avant insertion
   - Ajout de vérifications de doublons avant modification
   - Amélioration de la gestion des erreurs

## 🎉 Résultat

Le système empêche maintenant **TOUS** les doublons de prêts:
- ✅ Doublons exacts (même membre, montant, date, agent)
- ✅ Plusieurs prêts actifs pour un même membre
- ✅ Prêts avec le même `pret_id`

**Aucun doublon ne peut être créé, ni par erreur, ni intentionnellement.**

