# Lakay - Système de Gestion de Microcrédits

Application web moderne pour la gestion de prêts et remboursements de microcrédits.

## 🚀 Technologies

- **Next.js 16** - Framework React avec App Router
- **TypeScript** - Typage statique
- **Supabase** - Base de données PostgreSQL et authentification
- **Tailwind CSS** - Framework CSS
- **Shadcn/ui** - Composants UI
- **Recharts** - Graphiques et visualisations

## 📋 Prérequis

- Node.js 20 ou supérieur
- npm ou yarn
- Compte Supabase

## 🔧 Installation

1. **Cloner le projet**
```bash
git clone <votre-repo>
cd lakay-1
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**

Créez un fichier `.env.local` à la racine du projet :

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_supabase
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
```

Vous pouvez obtenir ces clés depuis votre dashboard Supabase (Settings > API).

4. **Lancer le serveur de développement**
```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 📦 Déploiement

### 🚀 Déploiement sur Vercel (Recommandé)

L'application est configurée pour être déployée sur Vercel. Consultez le guide complet dans [DEPLOIEMENT_VERCEL.md](./DEPLOIEMENT_VERCEL.md).

**Déploiement rapide :**

1. **Connecter votre repository à Vercel**
   - Allez sur [vercel.com](https://vercel.com)
   - Importez votre repository Git
   - Vercel détectera automatiquement Next.js

2. **Configurer les variables d'environnement**
   - Dans Vercel Dashboard → Settings → Environment Variables
   - Ajoutez :
     ```
     NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
     NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_supabase
     SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
     ```
   - ⚠️ Pour `SUPABASE_SERVICE_ROLE_KEY` : ajoutez uniquement à Production et Preview (pas Development)

3. **Déployer**
   - Vercel déploiera automatiquement à chaque push sur la branche principale
   - Les branches créent automatiquement des preview deployments

**Configuration Vercel CLI :**
```bash
# Installer Vercel CLI
npm install -g vercel

# Se connecter
vercel login

# Déployer
vercel

# Configurer les variables d'environnement
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Déployer en production
vercel --prod
```

### 📦 Déploiement sur Netlify

### Option 1 : Déploiement via l'interface Netlify (Recommandé)

1. **Préparer votre projet**
   - Assurez-vous que votre code est sur GitHub, GitLab ou Bitbucket
   - Vérifiez que `netlify.toml` est présent à la racine

2. **Connexion à Netlify**
   - Allez sur [netlify.com](https://netlify.com)
   - Connectez-vous ou créez un compte
   - Cliquez sur "Add new site" > "Import an existing project"

3. **Configuration du build**
   - Sélectionnez votre repository
   - Netlify détectera automatiquement Next.js
   - Build command : `npm run build`
   - Publish directory : `.next`

4. **Variables d'environnement**
   - Allez dans "Site settings" > "Environment variables"
   - Ajoutez les variables suivantes :
     ```
     NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
     NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_supabase
     SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
     ```

5. **Déployer**
   - Cliquez sur "Deploy site"
   - Attendez que le build se termine (2-5 minutes)
   - Votre site sera accessible via l'URL Netlify

### Option 2 : Déploiement via Netlify CLI

1. **Installer Netlify CLI**
```bash
npm install -g netlify-cli
```

2. **Se connecter à Netlify**
```bash
netlify login
```

3. **Initialiser le site**
```bash
netlify init
```

4. **Configurer les variables d'environnement**
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "votre_url"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "votre_cle"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "votre_cle_service"
```

5. **Déployer**
```bash
netlify deploy --prod
```

## 🔑 Configuration Supabase

Après avoir créé votre projet Supabase, exécutez le script SQL `supabase/schema.sql` dans l'éditeur SQL de Supabase pour créer toutes les tables et politiques nécessaires.

### Tables principales :
- `user_profiles` - Profils utilisateurs (admin, manager, agent)
- `agents` - Agents de crédit
- `membres` - Membres/clients
- `prets` - Prêts
- `remboursements` - Remboursements
- `agent_expenses` - Dépenses des agents
- `system_settings` - Paramètres système
- `loan_amount_brackets` - Barèmes de montants
- `expense_categories` - Catégories de dépenses

## 👥 Rôles et Permissions

### Admin
- Accès complet à toutes les fonctionnalités
- Gestion des utilisateurs
- Configuration système
- Gestion des paramètres (échéancier, taux, barèmes)

### Manager
- Visualisation de toutes les données
- Modification des prêts et remboursements
- Pas d'accès aux paramètres système

### Agent
- Visualisation et gestion de ses propres données
- Enregistrement des remboursements
- Gestion de ses membres

## 📱 Fonctionnalités

### Gestion des Prêts
- Création de prêts avec fréquence journalière ou mensuelle
- Calcul automatique des échéanciers
- Suivi du capital restant
- Historique complet par membre

### Gestion des Remboursements
- Enregistrement des paiements
- Support des paiements partiels
- Priorisation automatique : intérêt puis principal
- Identification des retards

### Tableaux de Bord
- Dashboard global avec KPIs
- Portefeuille actif
- Taux d'impayés
- Remboursements du jour
- Commission agents (30% du net)
- Performance par agent

### Profit & Loss
- Calcul mensuel automatique
- Intérêts collectés vs dépenses
- Commission agents
- Profit net

### Paramètres (Admin uniquement)
- Échéancier : nombre d'échéances, fréquence
- Taux d'intérêt et commissions
- Barème des montants de prêts
- Catégories de dépenses

## 🛠️ Scripts disponibles

```bash
# Développement
npm run dev

# Build de production
npm run build

# Démarrage en production
npm run start
```

## 📄 Structure du Projet

```
lakay-1/
├── app/                    # Pages Next.js (App Router)
│   ├── dashboard/         # Dashboard principal
│   ├── prets/            # Gestion des prêts
│   ├── remboursements/   # Gestion des remboursements
│   ├── membres/          # Gestion des membres
│   ├── utilisateurs/     # Gestion des utilisateurs
│   ├── parametres/       # Paramètres système
│   ├── expenses/         # Gestion des dépenses
│   ├── impayes/          # Page des impayés
│   └── pnl/              # Profit & Loss
├── components/            # Composants React réutilisables
│   ├── ui/               # Composants UI (Shadcn)
│   ├── DashboardLayout.tsx
│   ├── Sidebar.tsx
│   └── ProtectedRoute.tsx
├── lib/                   # Utilitaires et configuration
│   ├── supabase.ts       # Client Supabase + types
│   ├── auth.ts           # Gestion authentification
│   ├── permissions.ts    # Contrôle d'accès
│   └── utils.ts          # Fonctions utilitaires
├── supabase/
│   └── schema.sql        # Schéma de base de données
├── public/               # Assets statiques
├── vercel.json           # Configuration Vercel
├── netlify.toml          # Configuration Netlify
└── next.config.ts        # Configuration Next.js
```

## 🐛 Dépannage

### Erreur : "Variables d'environnement manquantes"
- Vérifiez que `.env.local` existe et contient les bonnes clés (développement local)
- Sur Vercel : vérifiez les variables d'environnement dans Settings → Environment Variables
- Sur Netlify : vérifiez les variables d'environnement dans les settings
- ⚠️ Assurez-vous que `SUPABASE_SERVICE_ROLE_KEY` est configurée uniquement côté serveur (pas de préfixe `NEXT_PUBLIC_`)

### Erreur de build
- Vérifiez que Node.js 20 est bien configuré
- Assurez-vous que toutes les dépendances sont dans `package.json`
- Vérifiez les logs de build pour identifier l'erreur
- Sur Vercel : vérifiez que `next.config.ts` ne contient pas `output: 'standalone'` (Vercel gère automatiquement)

### Erreur de connexion Supabase
- Vérifiez que l'URL et les clés sont correctes
- Assurez-vous que les politiques RLS sont bien configurées
- Vérifiez que le schéma SQL a été exécuté

## 📞 Support

Pour toute question ou problème, contactez l'équipe de développement.

## 📝 License

Propriétaire - Tous droits réservés
