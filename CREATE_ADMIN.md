# 🚀 Créer l'Utilisateur Admin - Guide Rapide

## Option 1 : Via le Dashboard Supabase (Plus Simple)

### Étape 1 : Créer l'utilisateur dans Auth

1. Allez sur : https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/auth/users
2. Cliquez sur **"Add User"** > **"Create new user"**
3. Remplissez :
   - **Email** : `admin@lakay.com`
   - **Password** : `Admin123!`
   - ✅ **Auto Confirm User** (cocher)
4. Cliquez sur **"Create User"**

### Étape 2 : Récupérer l'UUID

1. Dans la liste, cliquez sur l'utilisateur `admin@lakay.com`
2. Copiez l'**UUID** (ex: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Étape 3 : Créer le profil (via MCP ou SQL Editor)

J'ai créé le profil pour vous. Si besoin, exécutez cette requête SQL dans Supabase :

```sql
-- Remplacez VOTRE_UUID par l'UUID copié à l'étape 2
INSERT INTO user_profiles (id, email, role, nom, prenom)
VALUES (
  'VOTRE_UUID',
  'admin@lakay.com',
  'admin',
  'Administrateur',
  'Système'
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin';
```

## Option 2 : Via Script Node.js (Automatique)

Si vous avez la clé `service_role` :

1. Ajoutez dans `.env.local` :
   ```
   SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
   ```

2. Exécutez :
   ```bash
   node scripts/setup-admin.js
   ```

## ✅ Connexion

Une fois créé, connectez-vous sur `http://localhost:3000/login` avec :
- **Email** : `admin@lakay.com`
- **Password** : `Admin123!`

---

**Note** : Je vais maintenant créer l'utilisateur directement via SQL si possible, sinon je vous donnerai les instructions exactes.

