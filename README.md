# Système de Microcrédit - Lakay

Application web pour gérer un système de microcrédit avec remboursements quotidiens.

## Fonctionnalités

- **Gestion des Agents de Crédit** : Créer et gérer les agents avec ID automatique (format: 00, 01, 02...)
- **Gestion des Membres** : Les agents peuvent créer des membres pour leur portefeuille avec ID automatique (format: 0000, 0001, 0002...)
- **Gestion des Prêts** : Créer des prêts avec ID automatique (format: CL-000-Janv, CL-001-Fevr...)
- **Remboursements** : Système de remboursement quotidien (23 remboursements sur 1 mois)
- **Décaissements** : Enregistrer les décaissements des prêts
- **Suivi des Remboursements** : Marquer les remboursements comme payés

## Règles Métier

- Chaque prêt dure 1 mois avec 23 remboursements quotidiens
- Le premier remboursement commence le 2ème jour après le décaissement
- Exemple : Prêt de 5,000 HTG → 23 remboursements de 250 HTG chacun (5000/23 ≈ 217.39 HTG, arrondi à 250 HTG)
- Les IDs sont générés automatiquement par le système

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Configurer Supabase :
   - Créer un projet sur [Supabase](https://supabase.com)
   - Copier `.env.example` vers `.env.local`
   - Remplir les variables d'environnement avec vos clés Supabase

3. Créer la base de données :
   - Exécuter le script SQL dans `supabase/schema.sql` dans l'éditeur SQL de Supabase

4. Lancer l'application :
```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## Structure du Projet

```
lakay/
├── app/                    # Pages Next.js
│   ├── agents/            # Gestion des agents
│   ├── membres/           # Gestion des membres
│   ├── prets/             # Gestion des prêts
│   └── remboursements/    # Gestion des remboursements
├── lib/                   # Utilitaires et configuration
│   ├── supabase.ts        # Client Supabase
│   └── utils.ts           # Fonctions utilitaires
├── supabase/              # Schéma de base de données
│   └── schema.sql         # Script SQL pour créer les tables
└── README.md
```

## Technologies Utilisées

- **Next.js 16** : Framework React avec App Router
- **TypeScript** : Typage statique
- **Tailwind CSS** : Styling
- **Supabase** : Base de données PostgreSQL
- **date-fns** : Manipulation des dates

## Schéma de Base de Données

- **agents** : Informations des agents de crédit
- **membres** : Informations des membres (liés aux agents)
- **prets** : Informations des prêts
- **remboursements** : Détails de chaque remboursement (23 par prêt)

## Notes

- Les IDs sont générés automatiquement dans l'application (pas via les fonctions SQL pour simplifier)
- Le calcul du montant de remboursement est automatique : montant_prêt / 23
- Le système détecte automatiquement les remboursements en retard
