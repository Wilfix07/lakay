# Instructions pour appliquer la migration

## Migration: Ajout du support pour bloquer les montants d'épargne comme garantie

### Problème
L'erreur `Could not find the 'blocked_for_group_pret_id' column` indique que les colonnes nécessaires pour le blocage des garanties n'existent pas dans la table `epargne_transactions`.

### Solution Automatique (Recommandé)

**Option 1: Via l'interface (le plus simple)**
1. Quand l'erreur apparaît dans la page Épargne, cliquez sur le bouton **"🔧 Exécuter la migration automatiquement"**
2. La migration s'exécutera automatiquement si la fonction RPC existe

**Option 2: Créer la fonction RPC d'abord (pour migration automatique)**
1. Allez dans Supabase Dashboard → SQL Editor
2. Exécutez le fichier `supabase/migration_add_epargne_blocked_function.sql`
3. Cela créera une fonction RPC qui peut être appelée automatiquement
4. Ensuite, utilisez le bouton dans l'interface pour exécuter la migration

### Solution Manuelle

Si la migration automatique ne fonctionne pas :

1. **Ouvrez Supabase Dashboard**
   - Allez sur votre projet Supabase
   - Cliquez sur "SQL Editor"

2. **Exécutez la migration**
   - Copiez le contenu du fichier `supabase/migration_add_epargne_blocked.sql`
   - Collez-le dans l'éditeur SQL
   - Cliquez sur "Run" pour exécuter

### Vérification
Après l'exécution, vérifiez que les colonnes existent :

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'epargne_transactions' 
AND column_name IN ('is_blocked', 'blocked_for_pret_id', 'blocked_for_group_pret_id');
```

Vous devriez voir les 3 colonnes :
- `is_blocked` (boolean)
- `blocked_for_pret_id` (varchar)
- `blocked_for_group_pret_id` (varchar)

### Alternative: Via Supabase CLI
Si vous utilisez Supabase CLI localement :

```bash
supabase db reset
# ou
supabase migration up
```

### Via Script Node.js
Vous pouvez aussi exécuter le script de migration :

```bash
npx tsx scripts/run-migration-epargne.ts
```

(Assurez-vous d'avoir les variables d'environnement configurées)

