# 📋 Documentation des Paramètres Système

## Vue d'ensemble

Les paramètres système permettent à l'administrateur de configurer dynamiquement le comportement de l'application **Lakay** sans avoir à modifier le code. Tous les changements effectués dans la page **Paramètres** (`/parametres`) s'appliquent automatiquement à toutes les opérations futures.

---

## 🔧 Paramètres Disponibles

### 1. **Échéancier des Prêts**

Configure le comportement par défaut pour la génération des prêts.

#### Paramètres :
- **Nombre d'échéances** : Nombre de remboursements par défaut pour un nouveau prêt
  - *Valeur par défaut* : 23
  - *Impact* : Ce nombre s'applique automatiquement lors de la création d'un nouveau prêt
  
- **Fréquence (jours)** : Intervalle entre les remboursements
  - *Valeur par défaut* : 1 jour
  - *Impact* : Utilisé dans le calcul des dates de remboursement
  
- **Jours de grâce** : Délai avant qu'un remboursement soit considéré en retard
  - *Valeur par défaut* : 0 jour
  - *Impact* : Affecte le statut "en_retard" des remboursements
  
- **Génération automatique** : Active/désactive la génération automatique de l'échéancier
  - *Valeur par défaut* : Oui
  - *Impact* : Si activé, l'échéancier est créé automatiquement à la création du prêt

#### Pages affectées :
- ✅ **`/prets`** : Création et modification de prêts
- ✅ **Dashboard** : Calculs de statistiques basés sur les échéances

---

### 2. **Taux d'Intérêt**

Configure les taux appliqués pour les calculs financiers.

#### Paramètres :
- **Taux d'intérêt de base (%)** : Taux appliqué sur chaque remboursement
  - *Valeur par défaut* : 15%
  - *Impact* : Utilisé dans le calcul du montant des remboursements
  - *Formule* : `Intérêt = Principal × Taux`
  
- **Taux de pénalité (%)** : Pénalité pour les retards de paiement
  - *Valeur par défaut* : 2%
  - *Impact* : Appliqué aux remboursements en retard (futur développement)
  
- **Commission agents (%)** : Pourcentage du net mensuel reversé aux agents
  - *Valeur par défaut* : 30%
  - *Impact* : Calcul des commissions dans le dashboard et P&L
  - *Formule* : `Commission = (Intérêts collectés - Dépenses) × 30%`

#### Pages affectées :
- ✅ **`/prets`** : Calcul des intérêts lors de la création de prêts
- ✅ **`/dashboard`** : Affichage des commissions agents
- ✅ **`/pnl`** : Calcul du profit & loss avec commission

#### Exemple de calcul :
```
Prêt de 10,000 HTG sur 23 échéances
- Principal par échéance : 10,000 / 23 = 434.78 HTG
- Intérêt par échéance (15%) : 434.78 × 0.15 = 65.22 HTG
- Montant total par échéance : 434.78 + 65.22 = 500 HTG
```

---

### 3. **Barème des Montants**

Définit les limites de montants autorisés pour les prêts et les taux associés.

#### Structure :
Chaque barème contient :
- **Label** : Nom du barème (ex: "Micro", "PME")
- **Montant min** : Montant minimum autorisé
- **Montant max** : Montant maximum autorisé (null = illimité)
- **Taux par défaut** : Taux d'intérêt suggéré pour cette tranche (optionnel)
- **Statut** : Actif/Inactif

#### Exemple de configuration :
```
Barème 1: Micro
- Min: 1,000 HTG
- Max: 50,000 HTG
- Taux: 15%

Barème 2: PME
- Min: 50,001 HTG
- Max: 200,000 HTG
- Taux: 12%

Barème 3: Grande entreprise
- Min: 200,001 HTG
- Max: null (illimité)
- Taux: 10%
```

#### Validation automatique :
Lorsqu'un utilisateur crée un prêt :
1. Le système vérifie que le montant entre dans un barème actif
2. Si le montant est hors limites, un message d'erreur s'affiche
3. Si un taux par défaut est défini, il peut être suggéré

#### Pages affectées :
- ✅ **`/prets`** : Validation en temps réel du montant saisi
- ⚠️ Validation au moment de la soumission du formulaire

#### Comportement sans barème :
Si aucun barème n'est configuré, tous les montants sont acceptés (pas de limite).

---

### 4. **Catégories de Dépenses**

Organise les dépenses des agents en catégories.

#### Structure :
Chaque catégorie contient :
- **Nom** : Nom unique de la catégorie
- **Description** : Description optionnelle
- **Statut** : Actif/Inactif

#### Exemples de catégories :
- Transport
- Communication
- Fournitures de bureau
- Frais administratifs
- Marketing
- Formation
- Divers

#### Pages affectées :
- ✅ **`/expenses`** : Liste déroulante des catégories dans le formulaire
- ✅ **`/dashboard`** : Agrégation des dépenses par catégorie
- ✅ **`/pnl`** : Calcul du net après déduction des dépenses

#### Comportement :
- Seules les catégories **actives** apparaissent dans le formulaire
- L'admin peut désactiver une catégorie sans la supprimer (données historiques préservées)

---

## 🔄 Flux de Données

### Création d'un Prêt

```
1. Admin configure dans /parametres :
   - Taux d'intérêt : 15%
   - Nombre d'échéances : 23
   - Barème : 1,000 HTG - 50,000 HTG

2. Agent/Admin va sur /prets et crée un prêt :
   - Montant : 10,000 HTG ✅ (validé selon barème)
   - Le système charge automatiquement :
     * Taux d'intérêt : 15%
     * Nombre d'échéances par défaut : 23

3. Calcul automatique :
   - Principal par échéance : 10,000 / 23 = 434.78 HTG
   - Intérêt par échéance : 434.78 × 0.15 = 65.22 HTG
   - Total par échéance : 500 HTG

4. Génération de l'échéancier :
   - 23 remboursements créés automatiquement
   - Dates calculées selon la fréquence (journalier/mensuel)
   - Weekends exclus pour les paiements journaliers
```

### Calcul des Commissions

```
1. Admin configure dans /parametres :
   - Commission agents : 30%

2. Système calcule chaque mois :
   - Intérêts collectés : 50,000 HTG
   - Dépenses du mois : 10,000 HTG
   - Net : 50,000 - 10,000 = 40,000 HTG
   - Commission (30%) : 40,000 × 0.30 = 12,000 HTG

3. Affichage dans :
   - /dashboard : Badge "Commission (30%)" avec montant
   - /pnl : Ligne dédiée aux commissions agents
```

### Création d'une Dépense

```
1. Admin configure dans /parametres :
   - Catégories : Transport, Communication, Fournitures...

2. Agent/Admin va sur /expenses et crée une dépense :
   - Catégorie : Liste déroulante avec catégories actives uniquement
   - Montant : 2,500 HTG
   - Description : "Carburant pour visites clients"

3. Impact automatique :
   - Dépense ajoutée aux totaux du mois
   - Déduite du calcul de commission agents
   - Apparaît dans P&L du mois
```

---

## 📊 Impact sur les Dashboards

### Dashboard Principal (`/dashboard`)

Les paramètres système affectent :

1. **Portefeuille actif**
   - Calcul basé sur les prêts actifs
   - Utilise les échéances configurées

2. **Intérêt brut**
   - Badge "Commission (30%)" basé sur le paramètre de commission
   - Montant calculé avec le taux configuré

3. **Remboursements**
   - Nombre d'échéances basé sur le paramètre système
   - Dates calculées selon la fréquence configurée

4. **Commission agents**
   - Pourcentage appliqué selon le paramètre
   - Calcul : (Intérêts - Dépenses) × Taux de commission

### P&L (`/pnl`)

1. **Intérêts collectés**
   - Basés sur le taux d'intérêt configuré

2. **Dépenses**
   - Filtrées par catégories actives
   - Agrégées par catégorie

3. **Commission agents**
   - Pourcentage appliqué selon le paramètre
   - Ligne dédiée dans le tableau P&L

4. **Résultat net**
   - `= Intérêts - Dépenses - Commission`

---

## 🛠️ Fonctions Utilitaires

Le fichier `lib/systemSettings.ts` expose plusieurs fonctions pour accéder aux paramètres :

### `getScheduleSettings()`
```typescript
const settings = await getScheduleSettings()
// Retourne:
// {
//   totalInstallments: 23,
//   frequencyDays: 1,
//   graceDays: 0,
//   autoGenerate: true
// }
```

### `getInterestRates()`
```typescript
const rates = await getInterestRates()
// Retourne:
// {
//   baseInterestRate: 0.15,  // 15%
//   penaltyRate: 0.02,       // 2%
//   commissionRate: 0.30     // 30%
// }
```

### `getLoanAmountBrackets()`
```typescript
const brackets = await getLoanAmountBrackets()
// Retourne un tableau de barèmes actifs
// [{
//   id: 1,
//   label: "Micro",
//   min_amount: 1000,
//   max_amount: 50000,
//   default_interest_rate: 0.15
// }, ...]
```

### `validateLoanAmount(amount)`
```typescript
const result = await validateLoanAmount(10000)
// Retourne:
// {
//   valid: true,
//   message: null,
//   suggestedRate: 0.15
// }
// OU
// {
//   valid: false,
//   message: "Le montant doit être entre 1,000 HTG et 50,000 HTG",
//   suggestedRate: null
// }
```

### `getExpenseCategories()`
```typescript
const categories = await getExpenseCategories()
// Retourne un tableau de catégories actives
// [{
//   id: 1,
//   name: "Transport",
//   description: "Frais de déplacement",
//   is_active: true
// }, ...]
```

### `calculateInterest(principal, customRate?)`
```typescript
const interest = await calculateInterest(10000)
// Utilise le taux système : 10000 × 0.15 = 1500 HTG

// OU avec un taux personnalisé
const interest = await calculateInterest(10000, 0.12)
// 10000 × 0.12 = 1200 HTG
```

---

## ⚙️ Base de Données

### Tables concernées :

#### `system_settings`
```sql
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Clés utilisées :**
- `schedule` : Paramètres d'échéancier
- `interest_rates` : Taux d'intérêt et commissions

#### `loan_amount_brackets`
```sql
CREATE TABLE loan_amount_brackets (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255),
  min_amount DECIMAL(10, 2) NOT NULL,
  max_amount DECIMAL(10, 2),
  default_interest_rate DECIMAL(5, 4),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `expense_categories`
```sql
CREATE TABLE expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Politiques RLS (Row Level Security)

Toutes les tables de paramètres sont protégées par RLS et accessibles uniquement par les **admins** :

```sql
-- system_settings
CREATE POLICY admin_manage_system_settings ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE public.user_profiles.id = auth.uid() 
      AND public.user_profiles.role = 'admin'
    )
  );

-- loan_amount_brackets
CREATE POLICY admin_manage_loan_amount_brackets ON loan_amount_brackets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE public.user_profiles.id = auth.uid() 
      AND public.user_profiles.role = 'admin'
    )
  );

-- expense_categories
CREATE POLICY admin_manage_expense_categories ON expense_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE public.user_profiles.id = auth.uid() 
      AND public.user_profiles.role = 'admin'
    )
  );
```

---

## ✅ Checklist d'Intégration

### ✅ Prêts (`/prets`)
- [x] Taux d'intérêt chargé depuis les paramètres système
- [x] Nombre d'échéances par défaut depuis les paramètres
- [x] Validation du montant selon les barèmes
- [x] Message d'erreur en temps réel si montant invalide
- [x] Calcul automatique avec le taux configuré

### ✅ Dépenses (`/expenses`)
- [x] Catégories chargées depuis les paramètres système
- [x] Seules les catégories actives affichées
- [x] Filtrage par catégorie disponible

### ✅ Dashboard (`/dashboard`)
- [x] Commission calculée avec le taux configuré
- [x] Affichage du pourcentage de commission
- [x] Intérêts calculés avec le taux configuré

### ✅ P&L (`/pnl`)
- [x] Commission agents avec le taux configuré
- [x] Dépenses agrégées par catégorie
- [x] Résultat net après déduction de la commission

### ✅ Paramètres (`/parametres`)
- [x] Interface de gestion pour l'admin
- [x] Badges indiquant les valeurs actuelles
- [x] Bouton d'actualisation
- [x] Indicateurs visuels de données dynamiques
- [x] Compteurs pour barèmes et catégories

---

## 🔐 Sécurité

1. **Accès restreint** : Seuls les admins peuvent modifier les paramètres système
2. **RLS activé** : Row Level Security sur toutes les tables de paramètres
3. **Validation côté serveur** : Les paramètres sont validés avant enregistrement
4. **Historique** : `updated_by` et `updated_at` pour tracer les modifications

---

## 🚀 Avantages de cette Architecture

1. **Flexibilité** : L'admin peut ajuster les paramètres sans redéploiement
2. **Cohérence** : Un seul endroit pour gérer tous les paramètres
3. **Traçabilité** : Historique des modifications
4. **Performance** : Les paramètres sont chargés au besoin (pas de sur-chargement)
5. **Évolutivité** : Facile d'ajouter de nouveaux paramètres

---

## 📝 Notes Importantes

1. **Prêts existants** : Les changements de paramètres n'affectent **pas** les prêts déjà créés
2. **Nouveaux prêts uniquement** : Les nouveaux paramètres s'appliquent aux prêts créés après la modification
3. **Catégories désactivées** : Les dépenses existantes avec des catégories désactivées restent visibles
4. **Barèmes vides** : Si aucun barème n'est configuré, tous les montants sont acceptés
5. **Valeurs par défaut** : Si un paramètre n'est pas configuré, les valeurs par défaut (hardcodées) sont utilisées

---

## 🎯 Cas d'Usage

### Scénario 1 : Changement de taux d'intérêt
```
Situation : L'admin veut passer de 15% à 12%

1. Admin va sur /parametres
2. Modifie "Taux d'intérêt de base" : 15% → 12%
3. Clique sur "Enregistrer"
4. Tous les nouveaux prêts créés utiliseront 12%
5. Les prêts existants restent à 15%
```

### Scénario 2 : Ajout d'une nouvelle catégorie
```
Situation : L'entreprise veut suivre les "Frais de formation"

1. Admin va sur /parametres > Catégories de dépenses
2. Ajoute "Formation" avec description
3. Clique sur "Ajouter"
4. La catégorie apparaît immédiatement dans /expenses
5. Les agents peuvent créer des dépenses de formation
```

### Scénario 3 : Définition de limites de prêt
```
Situation : L'admin veut limiter les prêts entre 5,000 et 100,000 HTG

1. Admin va sur /parametres > Barème des montants
2. Ajoute un barème :
   - Label : "Standard"
   - Min : 5,000 HTG
   - Max : 100,000 HTG
   - Taux : 15%
3. Sur /prets, si un agent saisit 150,000 HTG :
   → Message d'erreur : "Le montant doit être entre 5,000 HTG et 100,000 HTG"
```

---

**Dernière mise à jour** : Novembre 2025
**Version** : 1.0

