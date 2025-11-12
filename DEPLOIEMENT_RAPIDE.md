# 🚀 Déploiement Rapide - 5 Minutes

## ✅ Checklist Pré-Déploiement

Avant de commencer, assurez-vous d'avoir :
- [ ] Un compte Supabase avec un projet créé
- [ ] Un compte GitHub/GitLab/Bitbucket
- [ ] Un compte Netlify (gratuit)

## 📝 Étapes Rapides

### 1️⃣ Configuration Supabase (2 min)

```bash
# 1. Allez sur supabase.com > Votre projet > SQL Editor
# 2. Copiez/collez le contenu de supabase/schema.sql
# 3. Cliquez sur "Run"
# 4. Allez dans Settings > API et notez:
#    - Project URL
#    - anon/public key  
#    - service_role key (gardez-la secrète!)
```

### 2️⃣ Push sur Git (30 sec)

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 3️⃣ Déploiement Netlify (2 min)

1. Allez sur https://app.netlify.com
2. Cliquez sur **"Add new site"** > **"Import an existing project"**
3. Sélectionnez votre repository
4. Netlify détecte automatiquement la config ✅
5. Cliquez sur **"Add environment variables"**
6. Ajoutez ces 3 variables :
   ```
   NEXT_PUBLIC_SUPABASE_URL = [votre_url_supabase]
   NEXT_PUBLIC_SUPABASE_ANON_KEY = [votre_cle_anon]
   SUPABASE_SERVICE_ROLE_KEY = [votre_cle_service]
   ```
7. Cliquez sur **"Deploy site"**

### 4️⃣ Créer le Premier Admin (30 sec)

Une fois le déploiement terminé :

1. Allez sur Supabase > Authentication > Users
2. Cliquez sur **"Add user"** > Entrez email/password
3. Copiez l'UUID de l'utilisateur
4. Allez dans **Table Editor** > `user_profiles`
5. Créez un record :
   ```
   id: [uuid_copié]
   email: [votre_email]
   role: admin
   nom: [votre_nom]
   prenom: [votre_prénom]
   ```

### 5️⃣ Connexion ! 🎉

1. Allez sur l'URL Netlify de votre site (ex: `https://votre-site.netlify.app`)
2. Connectez-vous avec l'email/password créé
3. Vous êtes admin ! 👑

---

## 🔧 Commandes Utiles

### Vérifier que tout est prêt
```bash
npm run check-deploy
```

### Build local pour tester
```bash
npm run build
```

### Tester localement
```bash
npm run dev
```

---

## 🆘 Problèmes Courants

### ❌ Build échoue sur Netlify
- Vérifiez que les variables d'environnement sont bien configurées
- Vérifiez que `npm run build` fonctionne localement

### ❌ Page blanche après déploiement
- Ouvrez la console (F12) et regardez les erreurs
- Vérifiez que les URL Supabase sont correctes

### ❌ "Unauthorized" à la connexion
- Vérifiez que vous avez bien créé le profil dans `user_profiles`
- Vérifiez que le role est bien `admin`
- Vérifiez que l'id correspond à l'UUID de l'utilisateur

### ❌ Les données ne s'affichent pas
- Vérifiez que le script SQL a bien été exécuté
- Vérifiez les politiques RLS dans Supabase

---

## 📚 Documentation Complète

Pour plus de détails, consultez :
- **Guide complet** : `DEPLOIEMENT_NETLIFY.md`
- **Documentation projet** : `README.md`

---

## 🎯 Résumé Ultra-Rapide

```bash
# 1. Exécuter schema.sql dans Supabase
# 2. Noter les clés API
# 3. git push
# 4. Netlify > Import > Variables env > Deploy
# 5. Créer user admin dans Supabase
# 6. Se connecter sur le site
# ✅ TERMINÉ !
```

**Temps total : ~5 minutes** ⏱️

