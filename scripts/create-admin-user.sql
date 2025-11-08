-- Script pour créer un utilisateur admin
-- IMPORTANT: Exécutez d'abord les étapes 1 et 2 dans le dashboard Supabase
-- Puis exécutez cette requête SQL dans l'éditeur SQL

-- ÉTAPE 1: Créer l'utilisateur dans Supabase Auth
-- Allez dans Authentication > Users > Add User > Create new user
-- Email: admin@lakay.com
-- Password: Admin123!
-- Auto Confirm User: OUI (cocher)

-- ÉTAPE 2: Récupérer l'UUID de l'utilisateur créé
-- Allez dans Authentication > Users
-- Cliquez sur l'utilisateur admin@lakay.com
-- Copiez l'UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

-- ÉTAPE 3: Exécutez cette requête SQL en remplaçant 'VOTRE_UUID_ICI' par l'UUID copié
INSERT INTO user_profiles (id, email, role, nom, prenom)
VALUES (
  'VOTRE_UUID_ICI',  -- Remplacez par l'UUID de l'utilisateur créé dans Auth
  'admin@lakay.com',
  'admin',
  'Administrateur',
  'Système'
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = 'admin@lakay.com';

-- Vérification
SELECT * FROM user_profiles WHERE email = 'admin@lakay.com';

