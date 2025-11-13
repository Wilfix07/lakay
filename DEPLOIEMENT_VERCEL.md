# Guide de Déploiement sur Vercel

Ce guide vous explique comment déployer l'application Lakay sur Vercel et configurer correctement les variables d'environnement.

## 📋 Prérequis

- Un compte Vercel ([inscription gratuite](https://vercel.com/signup))
- Un projet Supabase avec les clés d'API
- Git repository (GitHub, GitLab, ou Bitbucket)

## 🚀 Déploiement sur Vercel

### Méthode 1 : Via l'interface Vercel (Recommandé)

1. **Connecter votre repository**
   - Allez sur [vercel.com](https://vercel.com)
   - Cliquez sur "Add New Project"
   - Importez votre repository Git

2. **Configurer le projet**
   - Framework Preset: **Next.js** (détecté automatiquement)
   - Root Directory: `.` (racine du projet)
   - Build Command: `npm run build` (par défaut)
   - Output Directory: `.next` (géré automatiquement par Next.js)
   - Install Command: `npm install` (par défaut)

3. **Configurer les variables d'environnement**
   
   Avant de déployer, configurez les variables d'environnement suivantes dans Vercel :
   
   **Variables Publiques (Client-side) :**
   - `NEXT_PUBLIC_SUPABASE_URL` : URL de votre projet Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Clé publique (anon) de Supabase
   
   **Variables Privées (Server-side uniquement) :**
   - `SUPABASE_SERVICE_ROLE_KEY` : Clé service_role de Supabase (⚠️ SECRÈTE)

   **Comment ajouter les variables :**
   1. Dans la page de configuration du projet Vercel
   2. Allez dans "Environment Variables"
   3. Ajoutez chaque variable :
      - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
      - **Value**: `https://your-project.supabase.co`
      - **Environment**: Sélectionnez `Production`, `Preview`, et `Development`
      - Cliquez sur "Add"
   
   4. Répétez pour les autres variables :
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      - `SUPABASE_SERVICE_ROLE_KEY` (⚠️ uniquement pour Production et Preview)

4. **Déployer**
   - Cliquez sur "Deploy"
   - Vercel va construire et déployer votre application
   - Une URL sera générée (ex: `https://lakay.vercel.app`)

### Méthode 2 : Via Vercel CLI

1. **Installer Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Se connecter à Vercel**
   ```bash
   vercel login
   ```

3. **Déployer**
   ```bash
   vercel
   ```

4. **Configurer les variables d'environnement**
   ```bash
   # Variables publiques
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   
   # Variable privée (service role)
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```

5. **Déployer en production**
   ```bash
   vercel --prod
   ```

## 🔑 Variables d'Environnement

### Variables Requises

| Variable | Type | Description | Où la trouver |
|----------|------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL du projet Supabase | [Dashboard Supabase](https://supabase.com/dashboard/project/_/settings/api) → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Clé publique (anon) | [Dashboard Supabase](https://supabase.com/dashboard/project/_/settings/api) → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Private | Clé service_role (⚠️ SECRÈTE) | [Dashboard Supabase](https://supabase.com/dashboard/project/_/settings/api) → service_role secret |

### Configuration dans Vercel

1. **Allez dans votre projet Vercel**
2. **Settings → Environment Variables**
3. **Ajoutez chaque variable :**

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Sélectionnez les environnements :**
   - ✅ **Production** : Pour les déploiements en production
   - ✅ **Preview** : Pour les previews de branches
   - ⚠️ **Development** : Optionnel (pour `vercel dev`)

5. **Important pour `SUPABASE_SERVICE_ROLE_KEY` :**
   - ❌ Ne l'ajoutez PAS à Development (sécurité)
   - ✅ Ajoutez-la uniquement à Production et Preview
   - 🔒 Cette clé bypass les RLS (Row Level Security) de Supabase

## 📝 Fichiers de Configuration

### `vercel.json`

Le fichier `vercel.json` configure automatiquement Vercel pour Next.js. Il définit :
- Le framework (Next.js)
- Les commandes de build
- La région de déploiement
- Les variables d'environnement (références)

### `next.config.ts`

Le fichier `next.config.ts` est configuré pour Vercel :
- Pas de `output: 'standalone'` (Vercel gère automatiquement)
- Les variables `NEXT_PUBLIC_*` sont automatiquement exposées au client
- Les variables sans `NEXT_PUBLIC_` sont uniquement disponibles côté serveur

## 🔄 Déploiements Automatiques

Vercel déploie automatiquement :
- **Production** : À chaque push sur la branche principale (main/master)
- **Preview** : À chaque push sur une autre branche ou Pull Request

### Workflow Recommandé

1. **Développement local**
   ```bash
   npm run dev
   ```

2. **Créer une branche**
   ```bash
   git checkout -b feature/nouvelle-fonctionnalite
   ```

3. **Pousser la branche**
   ```bash
   git push origin feature/nouvelle-fonctionnalite
   ```
   - Vercel créera automatiquement un preview deployment

4. **Merge vers main**
   ```bash
   git checkout main
   git merge feature/nouvelle-fonctionnalite
   git push origin main
   ```
   - Vercel déploiera automatiquement en production

## 🔍 Vérification du Déploiement

### 1. Vérifier les Variables d'Environnement

Dans Vercel Dashboard :
- Allez dans **Settings → Environment Variables**
- Vérifiez que toutes les variables sont présentes
- Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est marquée comme **Secret**

### 2. Vérifier les Logs de Build

Dans Vercel Dashboard :
- Allez dans **Deployments**
- Cliquez sur le dernier déploiement
- Vérifiez les **Build Logs** pour les erreurs

### 3. Tester l'Application

1. **Page d'accueil**
   - Visitez `https://votre-app.vercel.app`
   - Vérifiez que la page se charge

2. **Connexion**
   - Essayez de vous connecter
   - Vérifiez que Supabase répond correctement

3. **API Routes**
   - Testez les routes API (ex: `/api/users/create`)
   - Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` fonctionne

## 🐛 Dépannage

### Erreur : "Variables d'environnement manquantes"

**Solution :**
1. Vérifiez que toutes les variables sont ajoutées dans Vercel
2. Vérifiez que les variables sont ajoutées pour l'environnement correct (Production/Preview)
3. Redéployez après avoir ajouté les variables

### Erreur : "Configuration serveur manquante"

**Cause :** `SUPABASE_SERVICE_ROLE_KEY` n'est pas configurée ou n'est pas accessible dans les API routes.

**Solution :**
1. Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est ajoutée dans Vercel
2. Vérifiez qu'elle n'a pas le préfixe `NEXT_PUBLIC_` (elle doit rester privée)
3. Redéployez après avoir corrigé

### Erreur : "Build failed"

**Solution :**
1. Vérifiez les logs de build dans Vercel
2. Vérifiez que `package.json` contient le script `build`
3. Vérifiez que toutes les dépendances sont installées
4. Vérifiez que `next.config.ts` est correctement configuré

### Les variables d'environnement ne sont pas reconnues

**Solution :**
1. Vérifiez que les variables commencent par `NEXT_PUBLIC_` si elles doivent être accessibles côté client
2. Redéployez après avoir modifié les variables
3. Vérifiez que les variables sont ajoutées pour l'environnement correct

## 🔒 Sécurité

### Variables Sensibles

- ⚠️ **NE JAMAIS** commiter `.env.local` ou `.env` dans Git
- ⚠️ **NE JAMAIS** exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
- ✅ Utiliser les **Environment Variables** de Vercel pour les secrets
- ✅ `SUPABASE_SERVICE_ROLE_KEY` doit être marquée comme **Secret** dans Vercel

### Vérification

1. Vérifiez que `.env.local` est dans `.gitignore`
2. Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` n'est pas dans le code source
3. Vérifiez que les variables sont correctement configurées dans Vercel

## 📚 Ressources

- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Next.js sur Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Variables d'environnement Vercel](https://vercel.com/docs/environment-variables)
- [Documentation Supabase](https://supabase.com/docs)

## ✅ Checklist de Déploiement

- [ ] Repository connecté à Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurée dans Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurée dans Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurée dans Vercel (Production + Preview)
- [ ] Variables ajoutées pour les environnements corrects
- [ ] Build réussi dans Vercel
- [ ] Application accessible sur l'URL Vercel
- [ ] Connexion fonctionne
- [ ] API routes fonctionnent
- [ ] Aucune erreur dans les logs

## 🎉 Déploiement Réussi !

Une fois déployé, votre application sera accessible sur :
- **Production** : `https://votre-app.vercel.app`
- **Preview** : `https://votre-app-git-branche.vercel.app`

Tous les futurs commits sur la branche principale seront automatiquement déployés en production !

