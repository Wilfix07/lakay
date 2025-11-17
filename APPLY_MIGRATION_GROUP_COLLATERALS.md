# 🔧 Application de la Migration pour les Garanties de Groupe

## ⚠️ Erreur Rencontrée

L'erreur `Erreur lors de la création des garanties de groupe: {}` se produit car la migration SQL n'a pas encore été appliquée à la base de données.

## 📋 Solution

### Étape 1: Appliquer la Migration SQL

Vous devez exécuter la migration SQL dans votre base de données Supabase :

**Fichier à exécuter :** `supabase/migration_add_group_collaterals.sql`

### Méthode 1: Via Supabase Dashboard (Recommandé)

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**
4. Copiez le contenu du fichier `supabase/migration_add_group_collaterals.sql`
5. Collez-le dans l'éditeur SQL
6. Cliquez sur **Run** ou **Execute**

### Méthode 2: Via Supabase CLI

```bash
# Si vous utilisez Supabase CLI
supabase db push
```

### Méthode 3: Via MCP Supabase

Si vous avez configuré le MCP Supabase, vous pouvez utiliser :

```typescript
// La migration sera appliquée via l'outil MCP
```

## 📝 Contenu de la Migration

La migration effectue les opérations suivantes :

1. **Rend `pret_id` nullable** : Permet d'avoir `pret_id = NULL` pour les prêts de groupe
2. **Ajoute `group_pret_id`** : Nouvelle colonne pour référencer les prêts de groupe
3. **Modifie les contraintes UNIQUE** : Permet plusieurs garanties par prêt de groupe (une par membre)
4. **Crée des index** : Améliore les performances des requêtes

## ✅ Vérification Post-Migration

Après avoir appliqué la migration, vérifiez que :

1. La colonne `group_pret_id` existe dans la table `collaterals`
2. La colonne `pret_id` accepte maintenant les valeurs NULL
3. Les contraintes UNIQUE ont été modifiées correctement

### Requête de Vérification

```sql
-- Vérifier la structure de la table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'collaterals'
ORDER BY ordinal_position;

-- Vérifier les contraintes
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'collaterals';
```

## 🔄 Après la Migration

Une fois la migration appliquée :

1. **Redémarrez l'application** si nécessaire
2. **Testez la création d'un prêt de groupe**
3. **Vérifiez que les garanties sont créées automatiquement** pour chaque membre
4. **Testez les dépôts de garantie** dans la page "Garanties"

## 🐛 Si l'Erreur Persiste

Si l'erreur persiste après avoir appliqué la migration :

1. Vérifiez les logs de la console pour plus de détails
2. Vérifiez que la migration a été appliquée correctement
3. Vérifiez que les permissions RLS permettent l'insertion
4. Contactez l'administrateur de la base de données

## 📚 Documentation

- Migration SQL : `supabase/migration_add_group_collaterals.sql`
- Code source : `app/prets/page.tsx` (lignes 919-969)
- Interface TypeScript : `lib/supabase.ts` (interface Collateral)

