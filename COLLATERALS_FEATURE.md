# 💰 Fonctionnalité de Gestion des Garanties (Collateral)

## 📋 Vue d'ensemble

La fonctionnalité de garanties permet de gérer les dépôts de sécurité que les membres doivent effectuer lors de l'obtention d'un prêt. Par défaut, les membres doivent déposer **10%** du montant du prêt, mais ce taux est **entièrement configurable** par l'administrateur.

---

## ✅ Fonctionnalités Implémentées

### 1. **Base de Données**

#### Table `collaterals`
```sql
CREATE TABLE collaterals (
    id SERIAL PRIMARY KEY,
    pret_id VARCHAR(50) NOT NULL REFERENCES prets(pret_id) ON DELETE CASCADE,
    membre_id VARCHAR(4) NOT NULL REFERENCES membres(membre_id) ON DELETE CASCADE,
    montant_requis DECIMAL(12, 2) NOT NULL,
    montant_depose DECIMAL(12, 2) NOT NULL DEFAULT 0,
    montant_restant DECIMAL(12, 2) NOT NULL,
    statut VARCHAR(20) DEFAULT 'partiel',
    date_depot DATE,
    date_remboursement DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pret_id)
);
```

**Champs clés** :
- `montant_requis` : Montant total de garantie requis (ex: 10% de 10,000 HTG = 1,000 HTG)
- `montant_depose` : Montant déjà déposé par le membre
- `montant_restant` : Montant encore à déposer
- `statut` : 'partiel', 'complet', ou 'rembourse'

#### Paramètres Système
```json
{
  "key": "collateral_settings",
  "value": {
    "collateralRate": 10,
    "refundPolicy": "automatic",
    "description": "Taux de garantie en pourcentage du montant du prêt"
  }
}
```

---

### 2. **Page de Gestion des Garanties** (`/collaterals`)

#### Caractéristiques :
- ✅ **Tableau de bord avec statistiques** :
  - Total requis
  - Total déposé
  - Restant à déposer
  - Nombre de garanties complètes/partielles/remboursées

- ✅ **Formulaire d'enregistrement de dépôt** :
  - Sélection du prêt avec garantie partielle
  - Montant à déposer
  - Date du dépôt
  - Notes optionnelles

- ✅ **Tableau des garanties** :
  - Prêt ID
  - Nom du membre
  - Montant requis
  - Montant déposé (avec pourcentage)
  - Montant restant
  - Statut (avec badges colorés)
  - Dates de dépôt/remboursement
  - Action de remboursement

- ✅ **Gestion des remboursements** :
  - Bouton "Rembourser" pour les garanties complètes
  - Enregistrement automatique de la date de remboursement

#### Permissions :
- **Admin** : Accès complet à toutes les garanties
- **Manager** : Accès complet à toutes les garanties (lecture/écriture)
- **Agent** : Accès uniquement aux garanties de ses propres membres

---

### 3. **Page Paramètres - Section Garanties**

L'administrateur peut configurer le système de garanties depuis `/parametres` :

#### Options disponibles :
1. **Taux de garantie (%)** :
   - Valeur par défaut : 10%
   - Min : 0%, Max : 100%
   - Exemple en temps réel : "Pour un prêt de 10,000 HTG, la garantie sera de 1,000 HTG"

2. **Politique de remboursement** :
   - `automatic` : Remboursement automatique à la fin du prêt
   - `manual` : Remboursement manuel par l'admin

3. **Description** : Texte libre pour documenter les règles

#### Interface :
- Formulaire intuitif avec validation
- Messages de succès/erreur
- Actualisation en temps réel
- Badge indiquant la valeur actuelle

---

### 4. **Création Automatique lors des Prêts**

#### Processus :
Lorsqu'un agent crée un nouveau prêt dans `/prets`, le système **crée automatiquement** une garantie :

1. **Calcul automatique** du montant requis basé sur le taux configuré
2. **Création de l'enregistrement** dans la table `collaterals`
3. **Initialisation** :
   - `montant_depose` = 0
   - `montant_restant` = montant_requis
   - `statut` = 'partiel'
4. **Notification** dans le message de succès : "Garantie requise: X HTG"

#### Code :
```typescript
// Créer la garantie (collateral) automatiquement
const montantGarantieRequis = await calculateCollateralAmount(montantPret)
const { error: collateralError } = await supabase
  .from('collaterals')
  .insert([{
    pret_id: newPretId,
    membre_id: formData.membre_id,
    montant_requis: montantGarantieRequis,
    montant_depose: 0,
    montant_restant: montantGarantieRequis,
    statut: 'partiel',
    notes: `Garantie générée automatiquement pour le prêt ${newPretId}`,
  }])
```

---

### 5. **Utilitaires et Fonctions**

#### `lib/systemSettings.ts`

**Nouvelles fonctions** :

```typescript
// Récupère les paramètres de garantie depuis la BD
export async function getCollateralSettings(): Promise<{
  collateralRate: number
  refundPolicy: string
  description: string
}>

// Calcule le montant de garantie requis pour un prêt
export async function calculateCollateralAmount(
  loanAmount: number, 
  customRate?: number
): Promise<number>
```

#### Exemple d'utilisation :
```typescript
// Calcul avec le taux configuré (ex: 10%)
const garantie = await calculateCollateralAmount(5000)
// Résultat : 500 HTG

// Calcul avec un taux personnalisé
const garantie = await calculateCollateralAmount(5000, 15)
// Résultat : 750 HTG
```

---

### 6. **Navigation - Sidebar**

Nouvelle entrée ajoutée au menu :
- **Titre** : Garanties
- **Icon** : Wallet (💳)
- **Route** : `/collaterals`
- **Rôles autorisés** : Admin, Manager, Agent

---

## 🎨 Interface Utilisateur

### Codes Couleur pour les Statuts

| Statut | Badge | Couleur | Description |
|--------|-------|---------|-------------|
| Partiel | 🟡 Partiel | Amber | Garantie incomplète |
| Complet | ✅ Complet | Vert | Garantie entièrement déposée |
| Remboursé | 🔵 Remboursé | Bleu | Garantie remboursée au membre |

### Cartes Résumé

1. **Total requis** (Bleu) 💼
   - Montant total de toutes les garanties requises
   - Nombre total de garanties

2. **Total déposé** (Vert) ✅
   - Montant total déjà déposé
   - Nombre de garanties complètes + remboursées

3. **Restant à déposer** (Amber) ⚠️
   - Montant total encore à déposer
   - Nombre de garanties partielles

4. **Actions** (Violet) ⏱️
   - Bouton "Enregistrer dépôt"
   - Désactivé si aucune garantie partielle

---

## 🔄 Workflow Complet

### Scénario : Création d'un prêt de 10,000 HTG

1. **Agent crée le prêt** :
   ```
   Montant : 10,000 HTG
   Taux de garantie configuré : 10%
   ```

2. **Système crée automatiquement** :
   ```
   Garantie ID : 1
   Prêt ID : CL-001-Janv
   Montant requis : 1,000 HTG
   Montant déposé : 0 HTG
   Montant restant : 1,000 HTG
   Statut : Partiel
   ```

3. **Agent collecte 500 HTG** :
   ```
   Montant déposé : 500 HTG (50%)
   Montant restant : 500 HTG
   Statut : Partiel
   ```

4. **Agent collecte les 500 HTG restants** :
   ```
   Montant déposé : 1,000 HTG (100%)
   Montant restant : 0 HTG
   Statut : Complet
   Date de dépôt : Aujourd'hui
   ```

5. **Membre termine de rembourser le prêt** :
   ```
   Admin clique sur "Rembourser"
   Statut : Remboursé
   Date de remboursement : Aujourd'hui
   ```

---

## 🔐 Sécurité et Permissions

### Row Level Security (RLS)

**Politique Admin/Manager** :
```sql
CREATE POLICY admin_manager_full_access_collaterals ON collaterals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE public.user_profiles.id = auth.uid()
            AND public.user_profiles.role IN ('admin', 'manager')
        )
    )
```

**Politique Agent** :
```sql
CREATE POLICY agent_own_collaterals ON collaterals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            JOIN public.membres ON public.membres.agent_id = public.user_profiles.agent_id
            WHERE public.user_profiles.id = auth.uid()
            AND public.user_profiles.role = 'agent'
            AND collaterals.membre_id = public.membres.membre_id
        )
    )
```

---

## 📊 Statistiques et Rapports

La page affiche en temps réel :
- **Taux de collecte** : (Montant déposé / Montant requis) × 100
- **Progression** : Pourcentage pour chaque garantie
- **Résumés par statut** : Partiel, Complet, Remboursé
- **Filtrage** : Par prêt, membre, ou statut

---

## 🧪 Validation et Contraintes

### Validation Côté Client
- ✅ Montant déposé > 0
- ✅ Taux de garantie entre 0% et 100%
- ✅ Prêt sélectionné valide
- ✅ Date de dépôt valide

### Validation Côté Serveur
- ✅ Unicité : 1 garantie par prêt
- ✅ Intégrité référentielle : Prêt et membre doivent exister
- ✅ RLS : Permissions basées sur le rôle
- ✅ Calcul automatique du montant restant

---

## 📁 Fichiers Modifiés/Créés

### Nouveaux Fichiers
1. **`app/collaterals/page.tsx`** (650+ lignes)
   - Page complète de gestion des garanties
   - Formulaire, tableau, statistiques

2. **`COLLATERALS_FEATURE.md`** (ce fichier)
   - Documentation complète de la fonctionnalité

### Fichiers Modifiés
1. **`supabase/schema.sql`**
   - Ajout de la table `collaterals`
   - Index et RLS

2. **`lib/supabase.ts`**
   - Interface TypeScript `Collateral`

3. **`lib/systemSettings.ts`**
   - `getCollateralSettings()`
   - `calculateCollateralAmount()`

4. **`app/parametres/page.tsx`**
   - Section de configuration des garanties
   - État et fonctions de gestion

5. **`components/Sidebar.tsx`**
   - Entrée "Garanties" avec icône Wallet

6. **`app/prets/page.tsx`**
   - Création automatique de garantie lors d'un nouveau prêt
   - Import de `calculateCollateralAmount`

---

## 🚀 Utilisation

### Pour l'Administrateur

1. **Configurer le taux** :
   - Aller dans `/parametres`
   - Section "Garanties (Collateral)"
   - Modifier le taux (ex: 10% → 15%)
   - Cliquer sur "Enregistrer"

2. **Visualiser toutes les garanties** :
   - Aller dans `/collaterals`
   - Voir le tableau de bord complet

3. **Rembourser une garantie** :
   - Trouver la garantie avec statut "Complet"
   - Cliquer sur "Rembourser"

### Pour l'Agent

1. **Créer un prêt** :
   - Aller dans `/prets`
   - Remplir le formulaire
   - La garantie est créée automatiquement

2. **Enregistrer un dépôt** :
   - Aller dans `/collaterals`
   - Cliquer sur "Enregistrer dépôt"
   - Sélectionner le prêt
   - Entrer le montant
   - Soumettre

3. **Suivre les garanties** :
   - Voir uniquement les garanties de ses membres
   - Statut en temps réel

---

## 💡 Exemples de Cas d'Usage

### Exemple 1 : Dépôt Partiel Multiple
```
Prêt : 20,000 HTG
Taux : 10%
Garantie requise : 2,000 HTG

Dépôt 1 : 500 HTG (25%)
Dépôt 2 : 800 HTG (40% cumulé → 65%)
Dépôt 3 : 700 HTG (35% → 100% ✅ Complet)
```

### Exemple 2 : Changement de Taux
```
Ancien taux : 10%
Nouveau taux (admin modifie) : 12%

Prêt existant : Garde 10% (non rétroactif)
Nouveau prêt : Utilise 12%
```

### Exemple 3 : Remboursement Automatique
```
Politique : automatic
Membre termine le prêt

Système vérifie :
- Prêt = Terminé ?
- Garantie = Complète ?

→ Statut passe automatiquement à "Remboursé"
```

---

## ✅ Checklist de Fonctionnement

### Migration & Base de Données
- [x] Table `collaterals` créée
- [x] Index sur `pret_id`, `membre_id`, `statut`
- [x] RLS activée avec politiques admin/agent
- [x] Paramètre système `collateral_settings` inséré

### Backend & API
- [x] Types TypeScript `Collateral` définis
- [x] Fonctions utilitaires dans `systemSettings.ts`
- [x] Calcul automatique du montant de garantie
- [x] Validation des taux (0-100%)

### Frontend
- [x] Page `/collaterals` complète
- [x] Section dans `/parametres`
- [x] Entrée dans la Sidebar
- [x] Création automatique depuis `/prets`
- [x] Badges et couleurs pour les statuts
- [x] Formulaires avec validation

### Tests
- [x] Build TypeScript réussi (0 erreurs)
- [x] Route `/collaterals` générée
- [x] Toutes les pages compilent correctement

---

## 🎉 Résumé

La fonctionnalité de garanties est **entièrement opérationnelle** et prête à l'emploi !

**Points forts** :
- ✅ Configuration flexible par l'admin
- ✅ Création automatique lors des prêts
- ✅ Interface intuitive et visuellement claire
- ✅ Sécurité avec RLS
- ✅ Workflow complet de la création au remboursement
- ✅ Statistiques en temps réel
- ✅ Build réussi sans erreur

**Prêt pour la production ! 🚀**

