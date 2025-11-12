# 🚀 Guide de Déploiement sur Netlify

## Étapes Rapides

### 1. Préparer votre Projet Supabase

Avant de déployer, assurez-vous que votre base de données Supabase est configurée :

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet (ou utilisez un existant)
3. Dans l'éditeur SQL, exécutez le fichier `supabase/schema.sql`
4. Notez vos clés API (Settings > API) :
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon/public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **service_role key** (SUPABASE_SERVICE_ROLE_KEY)

### 2. Déployer sur Netlify

#### Option A : Via l'Interface Web (Plus Simple)

1. **Connectez-vous à Netlify**
   - Allez sur [app.netlify.com](https://app.netlify.com)
   - Créez un compte ou connectez-vous

2. **Importez votre projet**
   - Cliquez sur "Add new site" > "Import an existing project"
   - Connectez votre compte GitHub/GitLab/Bitbucket
   - Sélectionnez le repository `lakay-1`

3. **Configuration automatique**
   Netlify détecte automatiquement Next.js grâce au fichier `netlify.toml` :
   - Build command : `npm run build` ✅
   - Publish directory : `.next` ✅
   - Node version : `20` ✅

4. **Ajoutez les variables d'environnement**
   - Cliquez sur "Add environment variables"
   - Ajoutez ces 3 variables :
   
   | Nom | Valeur |
   |-----|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Votre URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Votre clé anon |
   | `SUPABASE_SERVICE_ROLE_KEY` | Votre clé service_role |

5. **Déployez !**
   - Cliquez sur "Deploy site"
   - Attendez 2-5 minutes
   - Votre site est en ligne ! 🎉

#### Option B : Via Netlify CLI

```bash
# 1. Installer Netlify CLI
npm install -g netlify-cli

# 2. Se connecter
netlify login

# 3. Initialiser le site
netlify init

# 4. Configurer les variables d'environnement
netlify env:set NEXT_PUBLIC_SUPABASE_URL "votre_url_supabase"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "votre_cle_anon"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "votre_cle_service_role"

# 5. Déployer
netlify deploy --prod
```

### 3. Créer le Premier Utilisateur Admin

Une fois déployé, vous devez créer votre premier utilisateur admin directement dans Supabase :

1. Allez sur Supabase > Authentication > Users
2. Cliquez sur "Add user" > "Create new user"
3. Entrez email et mot de passe
4. Allez dans Table Editor > `user_profiles`
5. Créez un nouveau record :
   - `id` : L'UUID de l'utilisateur créé
   - `email` : Le même email
   - `role` : `admin`
   - `nom` : Votre nom
   - `prenom` : Votre prénom

Vous pouvez maintenant vous connecter sur votre site Netlify avec cet email/mot de passe !

## 🔄 Déploiements Automatiques

Une fois configuré, Netlify déploiera automatiquement à chaque push sur votre branche principale :

- **Push sur `main`** → Déploiement automatique en production
- **Pull Request** → Aperçu de déploiement automatique
- **Branch Preview** → URL unique pour chaque branche

## ⚙️ Configuration Avancée

### Domaine Personnalisé

1. Dans Netlify : "Domain management" > "Add custom domain"
2. Suivez les instructions pour configurer les DNS
3. Netlify génère automatiquement un certificat SSL gratuit

### Notifications de Build

1. "Site settings" > "Build & deploy" > "Deploy notifications"
2. Configurez des notifications par email ou Slack

### Variables d'Environnement par Contexte

Vous pouvez avoir des variables différentes pour production/preview :

```bash
# Production
netlify env:set KEY "value" --context production

# Preview (branches)
netlify env:set KEY "value" --context deploy-preview
```

## 🐛 Dépannage

### Build échoue : "Module not found"
```bash
# Nettoyez et réinstallez localement
rm -rf node_modules package-lock.json
npm install
npm run build
```

Si ça fonctionne localement, redéployez sur Netlify.

### Erreur : "Supabase is not defined"
- Vérifiez que les variables d'environnement sont bien définies dans Netlify
- Redéployez après avoir ajouté les variables

### Page blanche après déploiement
- Ouvrez la console du navigateur (F12)
- Vérifiez les erreurs JavaScript
- Vérifiez les logs de fonction dans Netlify

### Erreur 404 sur les routes
Le fichier `netlify.toml` contient déjà les redirects nécessaires. Si vous avez toujours des 404 :
- Vérifiez que `netlify.toml` est bien à la racine
- Vérifiez que la configuration `output: 'standalone'` est dans `next.config.ts`

## 📊 Monitoring

### Voir les logs de build
- Netlify Dashboard > "Deploys" > Cliquez sur un déploiement
- Consultez les logs complets

### Logs d'exécution
- "Functions" > Sélectionnez une fonction
- Voir les logs en temps réel

### Analytics
- Activez Netlify Analytics pour voir le trafic (payant)
- Ou intégrez Google Analytics gratuitement

## 🔐 Sécurité

### Variables d'Environnement
✅ **JAMAIS** commit `.env.local` dans Git
✅ Utilisez toujours les variables d'environnement Netlify
✅ Changez vos clés si elles sont exposées

### RLS Supabase
✅ Assurez-vous que Row Level Security est activé sur toutes les tables
✅ Testez les permissions avec différents rôles
✅ Ne donnez jamais la `service_role` key au client

## 📞 Support

- **Documentation Netlify** : [docs.netlify.com](https://docs.netlify.com)
- **Documentation Next.js** : [nextjs.org/docs](https://nextjs.org/docs)
- **Documentation Supabase** : [supabase.com/docs](https://supabase.com/docs)

---

## ✅ Checklist de Déploiement

- [ ] Base de données Supabase créée et configurée
- [ ] Script `schema.sql` exécuté dans Supabase
- [ ] Clés API Supabase récupérées
- [ ] Code pushé sur GitHub/GitLab/Bitbucket
- [ ] Projet importé dans Netlify
- [ ] Variables d'environnement configurées
- [ ] Premier déploiement réussi
- [ ] Premier utilisateur admin créé
- [ ] Test de connexion OK
- [ ] Test des fonctionnalités principales

**Votre application est maintenant en ligne ! 🎉**

