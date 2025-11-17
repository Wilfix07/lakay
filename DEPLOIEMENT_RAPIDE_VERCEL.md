# 🚀 Déploiement Rapide sur Vercel

## ✅ Prérequis Vérifiés

- ✅ Build local réussi (`npm run build`)
- ✅ Configuration Vercel (`vercel.json`) prête
- ✅ Configuration Next.js (`next.config.ts`) optimisée
- ✅ Toutes les erreurs TypeScript corrigées

## 📋 Variables d'Environnement Requises

Avant de déployer, configurez ces variables dans Vercel Dashboard :

### Variables Publiques (Client-side)
```
NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydWZveG9jamNpaWFkaG5kZndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTU0NjYsImV4cCI6MjA3ODEzMTQ2Nn0.1EWCgqwBBAeHSezN0mgbiEWEkem_zgSc5NmeWq1lJw8
```

### Variable Privée (Server-side uniquement)
```
SUPABASE_SERVICE_ROLE_KEY=<votre_service_role_key>
```
⚠️ **À récupérer depuis** : https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api

## 🚀 Méthode 1 : Via Interface Vercel (Recommandé)

1. **Connecter le repository**
   - Allez sur [vercel.com](https://vercel.com)
   - Cliquez sur "Add New Project"
   - Importez votre repository Git (GitHub/GitLab/Bitbucket)

2. **Configurer les variables d'environnement**
   - Dans la page de configuration du projet
   - Allez dans "Environment Variables"
   - Ajoutez les 3 variables ci-dessus
   - Pour `SUPABASE_SERVICE_ROLE_KEY` : sélectionnez uniquement **Production** et **Preview** (pas Development)

3. **Déployer**
   - Cliquez sur "Deploy"
   - Vercel va construire et déployer automatiquement

## 🚀 Méthode 2 : Via Vercel CLI

### Windows (PowerShell)
```powershell
.\deploy-vercel.ps1
```

### Linux/Mac
```bash
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

### Manuellement
```bash
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Se connecter
vercel login

# 3. Déployer (preview)
vercel

# 4. Configurer les variables d'environnement
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# 5. Déployer en production
vercel --prod
```

## ✅ Vérification Post-Déploiement

Après le déploiement, vérifiez :

- [ ] L'application se charge sur l'URL Vercel
- [ ] La page de connexion fonctionne
- [ ] L'authentification Supabase fonctionne
- [ ] Le dashboard se charge correctement
- [ ] Les API routes fonctionnent (`/api/users/*`)
- [ ] Aucune erreur dans les logs Vercel

## 🔍 Vérifier les Logs

Dans Vercel Dashboard :
- Allez dans **Deployments**
- Cliquez sur le dernier déploiement
- Vérifiez les **Build Logs** et **Function Logs**

## 🐛 Dépannage

### Erreur : "Variables d'environnement manquantes"
→ Vérifiez que toutes les variables sont ajoutées dans Vercel Dashboard → Settings → Environment Variables

### Erreur : "Configuration serveur manquante"
→ Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est configurée et accessible dans les API routes

### Build échoue
→ Vérifiez les logs de build dans Vercel Dashboard

## 📚 Documentation Complète

Pour plus de détails, consultez :
- [DEPLOIEMENT_VERCEL.md](./DEPLOIEMENT_VERCEL.md) - Guide complet
- [VERCEL_DEPLOYMENT_CHECKLIST.md](./VERCEL_DEPLOYMENT_CHECKLIST.md) - Checklist détaillée

## 🎉 Déploiement Réussi !

Une fois déployé, votre application sera accessible sur :
- **Production** : `https://votre-app.vercel.app`
- **Preview** : `https://votre-app-git-branche.vercel.app`

Tous les futurs commits sur la branche principale seront automatiquement déployés en production !

