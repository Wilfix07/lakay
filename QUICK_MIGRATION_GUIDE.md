# 🚀 Guide Rapide de Migration - Colonnes de Blocage Épargne

## ⚡ Solution Rapide (2 minutes)

### Étape 1: Ouvrir Supabase SQL Editor
1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Cliquez sur **"SQL Editor"** dans le menu de gauche

### Étape 2: Exécuter la Migration
1. Copiez **TOUT** le contenu du fichier `supabase/migration_add_epargne_blocked.sql`
2. Collez-le dans l'éditeur SQL de Supabase
3. Cliquez sur **"Run"** ou appuyez sur `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Étape 3: Vérifier
Après l'exécution, vous devriez voir un message de succès. Les colonnes suivantes seront ajoutées :
- ✅ `is_blocked` (BOOLEAN)
- ✅ `blocked_for_pret_id` (VARCHAR)
- ✅ `blocked_for_group_pret_id` (VARCHAR)

### Étape 4: Tester
1. Retournez dans l'application
2. Essayez d'enregistrer une garantie (Collateral)
3. Ça devrait fonctionner maintenant ! 🎉

---

## 🔍 Vérification Post-Migration

Pour vérifier que les colonnes ont été ajoutées, exécutez cette requête dans Supabase SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'epargne_transactions' 
AND column_name IN ('is_blocked', 'blocked_for_pret_id', 'blocked_for_group_pret_id')
ORDER BY column_name;
```

Vous devriez voir les 3 colonnes listées.

---

## 🆘 En cas de problème

Si vous rencontrez une erreur lors de l'exécution de la migration :

1. **Erreur "table does not exist"** : La table `epargne_transactions` n'existe pas encore. Créez-la d'abord avec la structure de base.

2. **Erreur "column already exists"** : C'est normal ! La migration vérifie l'existence avant d'ajouter, donc certaines colonnes peuvent déjà exister.

3. **Erreur de permissions** : Assurez-vous d'être connecté avec un compte ayant les droits d'administration sur Supabase.

---

## 📝 Contenu de la Migration

Le fichier `supabase/migration_add_epargne_blocked.sql` contient :
- Création de la table si elle n'existe pas
- Ajout des 3 colonnes de blocage avec vérifications
- Création des index pour améliorer les performances
- Commentaires sur les colonnes

La migration est **idempotente** : vous pouvez l'exécuter plusieurs fois sans problème.

