# Création des Utilisateurs

Pour créer des utilisateurs dans Supabase, vous devez :

## 1. Via l'interface Supabase

1. Aller dans Authentication > Users
2. Cliquer sur "Add User" > "Create new user"
3. Entrer l'email et un mot de passe temporaire
4. L'utilisateur devra changer son mot de passe à la première connexion

## 2. Créer le profil utilisateur

Après avoir créé l'utilisateur dans Auth, exécutez cette requête SQL dans l'éditeur SQL de Supabase :

```sql
-- Pour un Admin
INSERT INTO user_profiles (id, email, role, nom, prenom)
VALUES (
  'UUID_DE_L_UTILISATEUR_AUTH',  -- Remplacer par l'ID de l'utilisateur créé dans Auth
  'admin@example.com',
  'admin',
  'Admin',
  'Système'
);

-- Pour un Manager
INSERT INTO user_profiles (id, email, role, nom, prenom)
VALUES (
  'UUID_DE_L_UTILISATEUR_AUTH',
  'manager@example.com',
  'manager',
  'Manager',
  'Nom'
);

-- Pour un Agent (nécessite un agent_id existant)
INSERT INTO user_profiles (id, email, role, agent_id, nom, prenom)
VALUES (
  'UUID_DE_L_UTILISATEUR_AUTH',
  'agent@example.com',
  'agent',
  '00',  -- ID de l'agent existant
  'Agent',
  'Nom'
);
```

## 3. Récupérer l'UUID de l'utilisateur

Pour obtenir l'UUID d'un utilisateur créé dans Auth :
- Allez dans Authentication > Users
- Cliquez sur l'utilisateur
- Copiez l'UUID affiché

## Permissions par Rôle

- **Admin** : Accès complet à tout
- **Manager** : Peut créer des agents de crédit
- **Agent** : Peut créer des membres, des prêts et enregistrer des remboursements (seulement pour son agent_id)

