# Gestion des Utilisateurs

## Permissions

### Admin
- ✅ Peut créer des utilisateurs **Manager** et **Agent de crédit**
- ✅ Voit tous les utilisateurs (managers et agents)

### Manager
- ✅ Peut créer des utilisateurs **Agent de crédit**
- ✅ Voit seulement les agents qu'il a créés

### Agent
- ❌ Ne peut pas créer d'utilisateurs

## Configuration Requise

Pour créer des utilisateurs, vous devez avoir la clé `SUPABASE_SERVICE_ROLE_KEY` dans votre fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

⚠️ **Important** : La clé `service_role` ne doit JAMAIS être exposée côté client. Elle est utilisée uniquement dans la route API `/api/users/create`.

## Utilisation

1. Connectez-vous en tant qu'Admin ou Manager
2. Allez sur `/utilisateurs` depuis le dashboard
3. Cliquez sur "Créer un utilisateur"
4. Remplissez le formulaire :
   - **Email** : L'adresse email de l'utilisateur
   - **Mot de passe** : Un mot de passe temporaire (l'utilisateur pourra le changer)
   - **Rôle** : 
     - Admin peut choisir entre "Manager" et "Agent de crédit"
     - Manager peut seulement choisir "Agent de crédit"
   - **Agent de crédit** : Si le rôle est "Agent", sélectionner l'agent de crédit associé
   - **Nom** et **Prénom** : Informations de l'utilisateur

5. Cliquez sur "Créer l'utilisateur"

L'utilisateur sera créé dans Supabase Auth et son profil sera ajouté dans `user_profiles`.

## Récupération de la Clé Service Role

1. Allez sur votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **Settings** > **API**
3. Copiez la **service_role** key (⚠️ Ne la partagez JAMAIS publiquement)
4. Ajoutez-la dans `.env.local`

## Sécurité

- Les utilisateurs créés sont automatiquement confirmés (pas besoin de vérifier l'email)
- Les mots de passe doivent avoir au moins 6 caractères
- Les emails doivent être uniques
- Les agents doivent être associés à un agent de crédit existant

