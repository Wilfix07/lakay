# Guide de Configuration

## Étape 1 : Créer un projet Supabase

1. Aller sur [https://supabase.com](https://supabase.com)
2. Créer un compte ou se connecter
3. Créer un nouveau projet
4. Noter l'URL du projet et la clé anonyme (anon key)

## Étape 2 : Configurer les variables d'environnement

1. Créer un fichier `.env.local` à la racine du projet
2. Ajouter les variables suivantes :

```
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
```

## Étape 3 : Créer les tables dans Supabase

1. Aller dans l'éditeur SQL de Supabase
2. Copier le contenu du fichier `supabase/schema.sql`
3. Exécuter le script SQL
4. Vérifier que les tables sont créées :
   - agents
   - membres
   - prets
   - remboursements

## Étape 4 : Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur http://localhost:3000

## Utilisation

1. **Créer un agent** : Aller sur `/agents` et créer votre premier agent
2. **Créer un membre** : Aller sur `/membres` et créer un membre pour l'agent
3. **Créer un prêt** : Aller sur `/prets` et créer un prêt pour le membre
4. **Enregistrer les remboursements** : Aller sur `/remboursements` et marquer les paiements

