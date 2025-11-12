# 🚀 Guide Complet de Déploiement Netlify - Lakay

## Vue d'ensemble

Ce guide vous explique comment déployer le projet Lakay sur Netlify en quelques étapes simples. Toutes les variables d'environnement publiques sont déjà configurées dans le fichier `env.production.example` qui sera automatiquement utilisé par Netlify.

---

## ✅ Prérequis

- [x] Compte GitHub avec le repository Lakay
- [x] Compte Netlify (gratuit) : https://app.netlify.com/signup
- [x] Accès au Dashboard Supabase

---

## 🚀 Étape 1 : Préparer le Repository GitHub

### 1.1 Vérifier les Fichiers de Configuration

Le repository contient déjà :
- ✅ `netlify.toml` - Configuration Netlify
- ✅ `.nvmrc` - Version Node.js (v20)
- ✅ `public/_redirects` - Redirections SPA
- ✅ `env.production.example` - Variables d'environnement publiques
- ✅ `next.config.ts` - Configuration Next.js avec `output: 'standalone'`

### 1.2 Committer et Pusher

```bash
# Vérifier le statut
git status

# Ajouter les fichiers
git add .

# Committer
git commit -m "Configuration complète pour déploiement Netlify"

# Pusher vers GitHub
git push origin main
```

⚠️ **IMPORTANT** : Le fichier `env.production.example` SERA committé (c'est voulu et sécurisé car il ne contient que des clés publiques).

---

## 🌐 Étape 2 : Connecter à Netlify

### 2.1 Créer un Nouveau Site

1. Allez sur https://app.netlify.com
2. Cliquez sur **"Add new site"** → **"Import an existing project"**
3. Choisissez **"Deploy with GitHub"**
4. Autorisez Netlify à accéder à vos repositories
5. Sélectionnez le repository **"lakay"** (ou votre nom de repo)

### 2.2 Configuration du Build

Netlify devrait détecter automatiquement :
- **Build command** : `npm run build`
- **Publish directory** : `.next`
- **Node version** : 20 (depuis `.nvmrc`)

Si ce n'est pas le cas, configurez manuellement :

```yaml
Build command: npm run build
Publish directory: .next
Functions directory: (laisser vide)
```

⚠️ **NE PAS** cliquer sur "Deploy" encore ! Nous devons d'abord ajouter la Service Role Key.

---

## 🔐 Étape 3 : Configurer les Variables d'Environnement

### 3.1 Récupérer la Service Role Key

1. Ouvrez votre Dashboard Supabase :
   ```
   https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api
   ```

2. Dans la section **"Project API keys"** :
   - Trouvez la ligne **`service_role`** (type: secret)
   - Cliquez sur **"Reveal"** ou l'icône 👁️
   - **Copiez** la valeur complète (commence par `eyJ...`)

### 3.2 Ajouter dans Netlify

1. Dans Netlify, avant de déployer, cliquez sur **"Show advanced"** ou allez dans :
   ```
   Site settings > Environment variables
   ```

2. Cliquez sur **"Add a variable"** ou **"New variable"**

3. Ajoutez la variable :
   ```
   Key: SUPABASE_SERVICE_ROLE_KEY
   Value: [Collez la valeur copiée depuis Supabase]
   Scopes: All scopes (Production, Deploy Previews, Branch Deploys)
   ```

4. Cliquez sur **"Save"**

### 3.3 Variables Déjà Configurées (Automatiques)

Ces variables sont automatiquement chargées depuis `env.production.example` :
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Vous n'avez **rien à faire** pour ces deux variables ! 🎉

---

## 🚀 Étape 4 : Déployer

### 4.1 Premier Déploiement

1. Cliquez sur **"Deploy [site-name]"**
2. Attendez que le build se termine (5-10 minutes)
3. Une fois terminé, vous verrez : ✅ **"Published"**

### 4.2 Accéder au Site

Netlify génère automatiquement une URL :
```
https://[random-name].netlify.app
```

Exemple : `https://lakay-abc123.netlify.app`

---

## 🎨 Étape 5 : Configuration du Domaine (Optionnel)

### 5.1 Domaine Custom

Si vous avez un domaine personnalisé :

1. Allez dans **"Domain settings"**
2. Cliquez sur **"Add custom domain"**
3. Entrez votre domaine : `lakay.com` ou `app.lakay.com`
4. Suivez les instructions pour configurer les DNS

### 5.2 HTTPS

Netlify active automatiquement HTTPS avec Let's Encrypt (gratuit).

---

## ✅ Étape 6 : Vérification Post-Déploiement

### 6.1 Checklist de Vérification

- [ ] Le site se charge sans erreur
- [ ] La page de login s'affiche correctement
- [ ] Les couleurs de marque (mauve #AB7997 et vert #1A5914) sont appliquées
- [ ] La connexion Supabase fonctionne (testez le login)
- [ ] Les photos de membres s'affichent (si configuré)
- [ ] Tous les dashboards sont accessibles

### 6.2 Tester la Connexion

1. Allez sur votre site Netlify
2. Accédez à `/login`
3. Connectez-vous avec vos identifiants Supabase
4. Vérifiez que le dashboard charge correctement

### 6.3 Logs de Build

Si le déploiement échoue :

1. Allez dans **"Deploys"** sur Netlify
2. Cliquez sur le déploiement échoué
3. Consultez les logs pour identifier l'erreur
4. Corrigez et redéployez

---

## 🔄 Étape 7 : Déploiements Automatiques

### 7.1 Configuration (Déjà Active)

Netlify déploie automatiquement à chaque push sur `main` :

```bash
git add .
git commit -m "Nouvelle fonctionnalité"
git push origin main
```

→ Netlify détecte le push et redéploie automatiquement ! 🎉

### 7.2 Deploy Previews

Pour les branches de développement :

```bash
git checkout -b feature/nouvelle-fonctionnalite
# ... modifications ...
git push origin feature/nouvelle-fonctionnalite
```

Netlify créera automatiquement une **preview URL** pour tester avant de merger.

---

## 🔧 Configuration Avancée

### Variables d'Environnement par Contexte

Netlify permet de définir des variables par environnement :

```
Production (main branch):
  SUPABASE_SERVICE_ROLE_KEY=prod_key_here

Deploy Previews (PR):
  SUPABASE_SERVICE_ROLE_KEY=dev_key_here
```

Pour configurer :
1. Allez dans **"Environment variables"**
2. Sélectionnez le **"Scope"** approprié
3. Ajoutez la variable

### Build Hooks

Pour déclencher un déploiement depuis une URL :

1. Allez dans **"Site settings"** → **"Build & deploy"** → **"Build hooks"**
2. Créez un nouveau hook : **"Rebuild from Supabase"**
3. Utilisez l'URL générée dans vos webhooks Supabase

---

## 🐛 Dépannage

### Erreur : "Configuration serveur manquante"

**Cause** : `SUPABASE_SERVICE_ROLE_KEY` manquante

**Solution** :
1. Vérifiez dans **"Environment variables"**
2. Ajoutez la variable si manquante
3. Redéployez : **"Deploys"** → **"Trigger deploy"** → **"Deploy site"**

### Erreur : "Build failed"

**Cause** : Erreur de compilation TypeScript

**Solution** :
1. Vérifiez les logs de build
2. Corrigez les erreurs localement : `npm run build`
3. Committez et poussez les corrections

### Erreur : "Site not found" (404)

**Cause** : Configuration des redirections

**Solution** :
1. Vérifiez que `public/_redirects` existe
2. Contenu attendu :
   ```
   /*    /index.html   200
   ```
3. Redéployez

### Variables d'Environnement Non Détectées

**Cause** : `env.production.example` non lu

**Solution** :
1. Renommez `env.production.example` en `.env.production`
2. Ou ajoutez manuellement les variables dans Netlify UI
3. Redéployez

---

## 📊 Récapitulatif des Fichiers

| Fichier | Rôle | Committé dans Git ? |
|---------|------|---------------------|
| `netlify.toml` | Config Netlify | ✅ Oui |
| `.nvmrc` | Version Node.js | ✅ Oui |
| `public/_redirects` | Redirections SPA | ✅ Oui |
| `env.production.example` | Variables publiques | ✅ Oui (sécurisé) |
| `next.config.ts` | Config Next.js | ✅ Oui |
| `.env.local` | Variables locales | ❌ Non (.gitignore) |
| `.env` | Variables production | ❌ Non (.gitignore) |

---

## 🔐 Sécurité

### Variables Publiques (Safe dans Git)
✅ Ces variables PEUVENT être dans `env.production.example` :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Variables Privées (Netlify UI uniquement)
⚠️ Ces variables NE DOIVENT JAMAIS être dans Git :
- `SUPABASE_SERVICE_ROLE_KEY` ← Ajoutée manuellement dans Netlify

### Row Level Security (RLS)

Assurez-vous que RLS est activé sur toutes les tables Supabase :

```sql
-- Vérifier RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Activer RLS si nécessaire
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

---

## 📈 Optimisations Post-Déploiement

### 1. Activer les Analytics

Dans Netlify :
1. **"Site settings"** → **"Analytics"**
2. Activez **"Netlify Analytics"** (payant mais utile)
3. Ou intégrez Google Analytics gratuitement

### 2. Configurer les Notifications

1. **"Site settings"** → **"Build & deploy"** → **"Deploy notifications"**
2. Ajoutez notifications email/Slack pour :
   - Build réussi
   - Build échoué
   - Deploy live

### 3. Optimiser les Images

Netlify Image CDN (optionnel) :
```tsx
// Dans next.config.ts
images: {
  loader: 'custom',
  loaderFile: './netlify-image-loader.js'
}
```

### 4. Edge Functions (Avancé)

Pour des fonctions serverless Netlify :
```
/netlify/functions/
  ├── hello.ts
  └── api.ts
```

---

## 📚 Ressources

### Documentation Officielle
- **Netlify Docs** : https://docs.netlify.com/
- **Next.js on Netlify** : https://docs.netlify.com/frameworks/next-js/
- **Supabase + Netlify** : https://supabase.com/docs/guides/hosting/netlify

### Support
- **Netlify Community** : https://answers.netlify.com/
- **Netlify Status** : https://www.netlifystatus.com/

### Monitoring
- **Netlify Dashboard** : https://app.netlify.com/
- **Deploy Logs** : Dans chaque déploiement
- **Function Logs** : Si vous utilisez des Netlify Functions

---

## ✅ Checklist Finale

Avant de considérer le déploiement comme complet :

- [ ] Site déployé avec succès sur Netlify
- [ ] URL personnalisée configurée (optionnel)
- [ ] HTTPS activé automatiquement
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ajoutée dans Netlify UI
- [ ] Variables d'environnement publiques chargées depuis `env.production.example`
- [ ] Login Supabase fonctionne sur le site de production
- [ ] Tous les dashboards accessibles et fonctionnels
- [ ] Photos de membres s'affichent correctement
- [ ] Couleurs de marque appliquées (mauve + vert)
- [ ] RLS activé sur toutes les tables Supabase
- [ ] Déploiements automatiques configurés (push to main)
- [ ] Notifications de déploiement configurées (optionnel)
- [ ] Analytics configuré (optionnel)

---

## 🎉 Félicitations !

Votre projet Lakay est maintenant déployé sur Netlify ! 🚀

**URL de production** : `https://[votre-site].netlify.app`

**Prochaines étapes** :
1. Testez toutes les fonctionnalités en production
2. Configurez un domaine personnalisé
3. Invitez votre équipe à tester
4. Commencez à utiliser l'application ! 🎊

---

**Besoin d'aide ?** Consultez les logs de déploiement ou la documentation Netlify.

