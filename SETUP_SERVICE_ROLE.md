# Configuration de SUPABASE_SERVICE_ROLE_KEY

## Pourquoi cette clé est nécessaire ?

La clé `SUPABASE_SERVICE_ROLE_KEY` est requise pour créer des utilisateurs dans Supabase Auth depuis votre application. Cette clé a des privilèges élevés et doit être gardée secrète.

## Comment obtenir la clé

### Étape 1 : Accéder au Dashboard Supabase

1. Allez sur : https://supabase.com/dashboard
2. Connectez-vous à votre compte
3. Sélectionnez votre projet : **nrufoxocjciiadhndfwo**

### Étape 2 : Récupérer la clé service_role

1. Dans le menu de gauche, cliquez sur **Settings** (⚙️)
2. Cliquez sur **API**
3. Faites défiler jusqu'à la section **Project API keys**
4. Trouvez la clé **service_role** (⚠️ Ne confondez pas avec `anon` ou `service_role` - vous cherchez celle qui commence généralement par `eyJ...`)
5. Cliquez sur l'icône 👁️ pour révéler la clé
6. **Copiez la clé complète**

### Étape 3 : Ajouter la clé dans .env.local

1. Ouvrez le fichier `.env.local` à la racine du projet
2. Trouvez la ligne :
   ```
   SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_ici
   ```
3. Remplacez `votre_service_role_key_ici` par la clé que vous avez copiée
4. Sauvegardez le fichier

### Étape 4 : Redémarrer le serveur

**IMPORTANT** : Après avoir modifié `.env.local`, vous devez redémarrer le serveur de développement :

1. Arrêtez le serveur actuel (Ctrl+C dans le terminal)
2. Redémarrez avec : `npm run dev`

## Vérification

Une fois la clé ajoutée et le serveur redémarré, essayez de créer un utilisateur depuis la page `/utilisateurs`. Si tout fonctionne, vous ne devriez plus voir l'erreur.

## Sécurité

⚠️ **IMPORTANT** :
- Ne partagez JAMAIS cette clé publiquement
- Ne la commitez JAMAIS dans Git (elle devrait déjà être dans `.gitignore`)
- Cette clé donne un accès complet à votre base de données
- Utilisez-la uniquement côté serveur (dans les routes API)

## Format du fichier .env.local

Votre fichier `.env.local` devrait ressembler à ceci :

```env
NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (votre vraie clé ici)
```

## Aide supplémentaire

Si vous avez des problèmes :
1. Vérifiez que la clé est bien copiée en entier (elle est très longue)
2. Vérifiez qu'il n'y a pas d'espaces avant ou après la clé
3. Vérifiez que le serveur a bien été redémarré
4. Vérifiez les logs du serveur pour d'autres erreurs

