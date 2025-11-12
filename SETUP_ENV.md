# 🔧 Configuration des Variables d'Environnement

## Variables Récupérées depuis Supabase

J'ai récupéré les informations suivantes depuis votre projet Supabase :

### 1. URL du Projet Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
```

### 2. Clé Publique (Anon Key)
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydWZveG9jamNpaWFkaG5kZndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTU0NjYsImV4cCI6MjA3ODEzMTQ2Nn0.1EWCgqwBBAeHSezN0mgbiEWEkem_zgSc5NmeWq1lJw8
```

### 3. Service Role Key (À Récupérer Manuellement)

⚠️ **IMPORTANT** : La `SUPABASE_SERVICE_ROLE_KEY` est une clé sensible et ne peut pas être récupérée automatiquement via le MCP pour des raisons de sécurité.

Vous devez la récupérer manuellement depuis votre Dashboard Supabase :

1. Allez sur : https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api
2. Dans la section **Project API keys**
3. Copiez la valeur de **`service_role` key** (secret)

---

## 📝 Configuration Complète

Mettez à jour votre fichier `.env.local` avec ces valeurs :

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydWZveG9jamNpaWFkaG5kZndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTU0NjYsImV4cCI6MjA3ODEzMTQ2Nn0.1EWCgqwBBAeHSezN0mgbiEWEkem_zgSc5NmeWq1lJw8

# Service Role Key (À RÉCUPÉRER DEPUIS LE DASHBOARD)
# 👉 https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api
SUPABASE_SERVICE_ROLE_KEY=VOTRE_SERVICE_ROLE_KEY_ICI
```

---

## 🚀 Étapes pour Finaliser la Configuration

### 1. Récupérer la Service Role Key

```bash
# Ouvrez cette URL dans votre navigateur :
https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api
```

Dans la section **Project API keys**, vous verrez :
- ✅ `anon` `public` (déjà configurée ci-dessus)
- 🔐 `service_role` `secret` ← **COPIEZ CETTE VALEUR**

### 2. Mettre à Jour .env.local

Ouvrez le fichier `.env.local` à la racine de votre projet et remplacez/ajoutez ces lignes :

```env
NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydWZveG9jamNpaWFkaG5kZndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTU0NjYsImV4cCI6MjA3ODEzMTQ2Nn0.1EWCgqwBBAeHSezN0mgbiEWEkem_zgSc5NmeWq1lJw8
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydWZveG9jamNpaWFkaG5kZndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjU1NTQ2NiwiZXhwIjoyMDc4MTMxNDY2fQ.VOTRE_SECRET_ICI
```

⚠️ **Remplacez `VOTRE_SECRET_ICI` par la vraie valeur de la `service_role` key**

### 3. Redémarrer le Serveur

```bash
# Arrêtez le serveur (Ctrl+C)
# Puis redémarrez :
npm run dev
```

---

## ✅ Vérification

Une fois configuré, l'erreur "Configuration serveur manquante" devrait disparaître.

Pour vérifier que tout fonctionne :

```bash
# Testez le build
npm run build
```

Si tout est correct, vous verrez :
```
✓ Compiled successfully
```

---

## 🔐 Sécurité

### Variables Exposées au Client
Ces variables commencent par `NEXT_PUBLIC_` et sont accessibles côté client :
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Variables Serveur Uniquement
Ces variables ne sont accessibles que côté serveur (API routes) :
- 🔒 `SUPABASE_SERVICE_ROLE_KEY` ← **NE JAMAIS EXPOSER AU CLIENT**

### Fichier .gitignore
Vérifiez que `.env.local` est bien dans `.gitignore` :

```bash
# Vérifiez
cat .gitignore | grep .env.local
```

Si absent, ajoutez :
```
.env.local
```

---

## 📚 Usage dans le Code

### Client-Side (Composants React)
```typescript
import { supabase } from '@/lib/supabase'

// Utilise NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY
const { data, error } = await supabase.from('membres').select('*')
```

### Server-Side (API Routes)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← Service Role Key
)

// Peut bypasser RLS et faire des opérations admin
const { data } = await supabaseAdmin.auth.admin.createUser(...)
```

---

## 🆘 Aide et Support

### La Service Role Key est Exposée ?

Si vous avez accidentellement exposé votre `SUPABASE_SERVICE_ROLE_KEY` :

1. **Révoquez immédiatement** la clé dans le Dashboard Supabase
2. **Générez une nouvelle** Service Role Key
3. **Mettez à jour** `.env.local` avec la nouvelle valeur
4. **Vérifiez** que `.env.local` est dans `.gitignore`

### Erreur "Invalid API Key"

- Vérifiez que vous avez bien copié les clés complètes
- Assurez-vous qu'il n'y a pas d'espaces avant/après
- Redémarrez le serveur après modification

### Erreur Persist

Essayez :
```bash
# Supprimez .next
rm -rf .next

# Nettoyez le cache
npm run build
```

---

## 📋 Checklist Finale

- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurée
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurée
- [ ] `SUPABASE_SERVICE_ROLE_KEY` récupérée et configurée
- [ ] `.env.local` dans `.gitignore`
- [ ] Serveur redémarré
- [ ] Build réussi (`npm run build`)
- [ ] Application fonctionnelle

---

**Une fois ces étapes complétées, votre application sera entièrement configurée ! ✅**

