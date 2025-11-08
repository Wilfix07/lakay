# Guide : Créer un Utilisateur Admin

## Méthode 1 : Via le Dashboard Supabase (Recommandé)

### Étape 1 : Créer l'utilisateur dans Auth

1. Connectez-vous à votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **Authentication** > **Users**
3. Cliquez sur **Add User** > **Create new user**
4. Remplissez le formulaire :
   - **Email** : `admin@lakay.com`
   - **Password** : `Admin123!`
   - **Auto Confirm User** : ✅ Cocher cette case
5. Cliquez sur **Create User**

### Étape 2 : Récupérer l'UUID de l'utilisateur

1. Dans la liste des utilisateurs, trouvez `admin@lakay.com`
2. Cliquez sur l'utilisateur
3. Copiez l'**UUID** (format : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Étape 3 : Créer le profil utilisateur

1. Allez dans **SQL Editor** dans Supabase
2. Exécutez cette requête en remplaçant `VOTRE_UUID_ICI` par l'UUID copié :

```sql
INSERT INTO user_profiles (id, email, role, nom, prenom)
VALUES (
  'VOTRE_UUID_ICI',  -- Remplacez par l'UUID de l'utilisateur
  'admin@lakay.com',
  'admin',
  'Administrateur',
  'Système'
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = 'admin@lakay.com';
```

### Étape 4 : Vérification

Exécutez cette requête pour vérifier :

```sql
SELECT * FROM user_profiles WHERE email = 'admin@lakay.com';
```

Vous devriez voir l'utilisateur avec `role = 'admin'`.

## Méthode 2 : Via l'API Supabase (Programmatique)

Si vous préférez créer l'utilisateur programmatiquement, utilisez l'API Supabase Admin.

## Connexion

Une fois l'utilisateur créé :

1. Allez sur `http://localhost:3000/login`
2. Connectez-vous avec :
   - **Email** : `admin@lakay.com`
   - **Password** : `Admin123!`
3. Vous serez redirigé vers le dashboard admin

## Sécurité

⚠️ **Important** : Changez le mot de passe après la première connexion en production !

Pour changer le mot de passe :
1. Connectez-vous
2. Allez dans les paramètres de profil (à implémenter)
3. Ou utilisez la fonctionnalité "Forgot Password" de Supabase Auth

