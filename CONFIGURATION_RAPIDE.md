# ⚡ Configuration Rapide - .env.local

## 🎯 Objectif

Configurer le fichier `.env.local` pour que l'application fonctionne en développement local.

---

## ✅ Étape 1 : Fichier .env.local Créé

Le fichier `.env.local` a été créé automatiquement avec ces variables :

```env
✅ NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
⚠️  SUPABASE_SERVICE_ROLE_KEY=REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY
```

---

## 🔐 Étape 2 : Obtenir la Service Role Key

### Option A : Via le Dashboard Supabase (Recommandé)

1. **Ouvrez ce lien direct** :
   ```
   https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api
   ```

2. **Trouvez la section "Project API keys"**

3. **Localisez la ligne `service_role`** (type: secret)
   ```
   ┌─────────────────────────────────────┐
   │ Project API keys                    │
   ├─────────────────────────────────────┤
   │ ✅ anon      public    [Visible]    │
   │ 🔐 service_role secret [Reveal]     │ ← Cliquez ici
   └─────────────────────────────────────┘
   ```

4. **Cliquez sur "Reveal"** ou l'icône 👁️

5. **Copiez** la valeur complète (commence par `eyJ...`)

### Option B : Via le Script PowerShell

Exécutez à nouveau le script et collez votre clé quand demandé :

```powershell
.\configure-env-local.ps1
```

---

## ✏️ Étape 3 : Éditer .env.local

### Méthode Manuelle

1. **Ouvrez le fichier `.env.local`** dans votre éditeur

2. **Trouvez cette ligne** :
   ```env
   SUPABASE_SERVICE_ROLE_KEY=REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY
   ```

3. **Remplacez** `REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY` par la vraie clé copiée

4. **Résultat final** :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **Sauvegardez** le fichier (Ctrl+S)

---

## 🚀 Étape 4 : Lancer l'Application

```bash
# Redémarrez le serveur si déjà lancé
npm run dev
```

Si tout est correct, vous verrez :
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
```

---

## ✅ Vérification

### Test Rapide

1. Ouvrez http://localhost:3000
2. L'application devrait charger sans erreur
3. Essayez de vous connecter sur `/login`

### Si ça ne fonctionne pas

#### Erreur : "Configuration serveur manquante"

**Cause** : La `SUPABASE_SERVICE_ROLE_KEY` n'est pas configurée

**Solution** :
1. Vérifiez que vous avez bien remplacé le placeholder
2. Vérifiez qu'il n'y a pas d'espaces avant/après la clé
3. Vérifiez que la clé commence bien par `eyJ`

#### Erreur : "Invalid API key"

**Cause** : La clé copiée est incorrecte ou incomplète

**Solution** :
1. Retournez sur le Dashboard Supabase
2. Copiez à nouveau la clé complète
3. Remplacez dans `.env.local`
4. Redémarrez le serveur

---

## 📋 Checklist Finale

Avant de continuer, vérifiez :

- [ ] `.env.local` existe à la racine du projet
- [ ] `NEXT_PUBLIC_SUPABASE_URL` est configurée
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` est configurée
- [ ] `SUPABASE_SERVICE_ROLE_KEY` est configurée (commence par `eyJ`)
- [ ] Le serveur démarre sans erreur (`npm run dev`)
- [ ] La page d'accueil charge correctement
- [ ] Le login fonctionne

---

## 🔐 Sécurité

### ✅ Bonnes Pratiques

- ✅ `.env.local` est dans `.gitignore` (ne sera PAS committé)
- ✅ Ne partagez JAMAIS votre `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Cette clé permet de bypass RLS (très sensible)

### ⚠️ Important

Si vous exposez accidentellement votre Service Role Key :

1. **Révoque immédiatement** la clé dans Supabase Dashboard
2. **Génère une nouvelle** Service Role Key
3. **Met à jour** `.env.local` avec la nouvelle valeur
4. **Vérifie** que `.env.local` n'est pas dans Git :
   ```bash
   git status
   # .env.local ne doit PAS apparaître
   ```

---

## 🆘 Besoin d'Aide ?

### Documentation Complète

- **Setup complet** : Voir `SETUP_ENV.md`
- **Déploiement Netlify** : Voir `DEPLOIEMENT_NETLIFY_COMPLET.md`
- **Démarrage** : Voir `START_HERE.md`

### Commandes Utiles

```bash
# Vérifier que .env.local existe
ls .env.local

# Voir le contenu (sans afficher les clés sensibles)
# NE PAS EXÉCUTER en public !
cat .env.local

# Relancer le serveur
npm run dev

# Tester le build
npm run build
```

---

## 🎉 Prêt !

Une fois configuré, votre environnement de développement est prêt !

**Prochaines étapes** :
1. Explorez l'application : http://localhost:3000
2. Testez les fonctionnalités (dashboards, prêts, membres, etc.)
3. Commencez le développement ! 🚀

---

**Configuration terminée avec succès ! 🎊**

