# Configuration du processus pour les collaterals de groupe

## ✅ Ce qui a été configuré

### 1. Base de données (SQL)

#### Fonctions SQL créées :
- **`update_collateral_amounts()`** : Met à jour automatiquement `montant_restant` et `statut` lors des INSERT/UPDATE sur `collaterals`
- **`check_all_group_collaterals_complete(p_group_pret_id)`** : Vérifie si toutes les garanties d'un prêt de groupe sont complètes
- **`check_group_pret_status_after_collateral()`** : Vérifie et met à jour le statut du prêt de groupe après modification d'un collateral

#### Triggers créés :
- **`trigger_update_collateral_amounts`** : Déclenché avant INSERT/UPDATE sur `collaterals` pour calculer automatiquement les montants
- **`trigger_check_group_pret_status`** : Déclenché après INSERT/UPDATE sur `collaterals` pour vérifier le statut du prêt de groupe

#### Contraintes :
- **`check_pret_or_group_pret`** : S'assure qu'au moins `pret_id` ou `group_pret_id` est présent (mais pas les deux)

#### Index créés :
- `idx_collaterals_group_pret_id` : Pour améliorer les performances des requêtes sur `group_pret_id`
- `idx_collaterals_statut` : Pour améliorer les performances des requêtes sur `statut`

### 2. Frontend

#### Page Collaterals (`app/collaterals/page.tsx`)
- ✅ Affichage des collaterals de groupe avec distinction visuelle (👥)
- ✅ Formulaire de dépôt fonctionnel pour les collaterals de groupe
- ✅ Formulaire de retrait fonctionnel pour les collaterals de groupe
- ✅ Vérification que tous les remboursements sont payés avant retrait
- ✅ Messages adaptés pour les prêts de groupe

#### Page Prêts (`app/prets/page.tsx`)
- ✅ Création automatique d'un collateral pour chaque membre lors de la création d'un prêt de groupe
- ✅ Calcul du montant de garantie requis pour chaque membre basé sur son montant de prêt

### 3. Politiques RLS

Les politiques RLS suivantes ont été créées pour les collaterals de groupe :
- **INSERT** : Agents, managers et admins peuvent créer des collaterals pour les prêts de groupe
- **SELECT** : Agents, managers et admins peuvent voir les collaterals selon leurs permissions
- **UPDATE** : Agents, managers et admins peuvent mettre à jour les collaterals selon leurs permissions

## 🔄 Flux de processus

### Création d'un prêt de groupe avec collaterals

1. **Agent crée un prêt de groupe** (`app/prets/page.tsx`)
   - Sélectionne un groupe de membres
   - Définit le montant total et les montants individuels
   - Le système crée automatiquement :
     - Un enregistrement dans `group_prets`
     - Un collateral pour chaque membre dans `collaterals` avec :
       - `group_pret_id` = ID du prêt de groupe
       - `pret_id` = NULL
       - `membre_id` = ID du membre
       - `montant_requis` = Calculé selon le taux de garantie
       - `montant_depose` = 0
       - `montant_restant` = `montant_requis`
       - `statut` = 'partiel'

### Dépôt de garantie

1. **Agent enregistre un dépôt** (`app/collaterals/page.tsx`)
   - Sélectionne le collateral d'un membre spécifique
   - Entre le montant déposé
   - Le trigger `trigger_update_collateral_amounts` :
     - Calcule automatiquement `montant_restant`
     - Met à jour `statut` à 'complet' si `montant_restant` = 0
     - Enregistre `date_depot` si c'est la première fois que la garantie devient complète
   - Le trigger `trigger_check_group_pret_status` :
     - Vérifie si toutes les garanties du prêt de groupe sont complètes
     - Met à jour `updated_at` du prêt de groupe si toutes les garanties sont complètes

### Approbation du prêt de groupe

1. **Manager approuve le prêt** (`app/approbations/page.tsx` - À IMPLÉMENTER)
   - Vérifie que toutes les garanties sont complètes
   - Approuve le prêt de groupe
   - Active le prêt et crée les remboursements pour chaque membre

### Retrait de garantie

1. **Agent enregistre un retrait** (`app/collaterals/page.tsx`)
   - Vérifie que le prêt de groupe est terminé
   - Vérifie que tous les remboursements du membre sont payés
   - Enregistre le retrait avec `date_remboursement`
   - Met à jour le statut à 'rembourse'

## 📋 À faire

### Page Approbations (`app/approbations/page.tsx`)
- [ ] Ajouter le chargement des prêts de groupe (`group_prets`)
- [ ] Ajouter le chargement des collaterals de groupe
- [ ] Ajouter une fonction pour vérifier si toutes les garanties d'un prêt de groupe sont complètes
- [ ] Ajouter une fonction `handleApproveGroupPret()` pour approuver les prêts de groupe
- [ ] Afficher les prêts de groupe dans le tableau avec distinction visuelle
- [ ] Créer les remboursements de groupe lors de l'approbation

## 🧪 Tests à effectuer

1. **Création d'un prêt de groupe**
   - Vérifier que les collaterals sont créés pour tous les membres
   - Vérifier que les montants requis sont corrects

2. **Dépôt de garantie**
   - Vérifier que `montant_restant` est mis à jour automatiquement
   - Vérifier que `statut` passe à 'complet' quand approprié
   - Vérifier que le trigger vérifie le statut du prêt de groupe

3. **Approbation du prêt de groupe**
   - Vérifier que le manager ne peut approuver que si toutes les garanties sont complètes
   - Vérifier que les remboursements sont créés pour tous les membres

4. **Retrait de garantie**
   - Vérifier que le retrait n'est possible que si le prêt est terminé
   - Vérifier que tous les remboursements du membre sont payés

## 📝 Notes importantes

- Les collaterals de groupe utilisent `group_pret_id` au lieu de `pret_id`
- Chaque membre a son propre collateral avec son propre montant requis
- Le prêt de groupe ne peut être approuvé que si **toutes** les garanties sont complètes
- Les remboursements sont créés individuellement pour chaque membre dans `group_remboursements`
- Le retrait de garantie se fait membre par membre, pas pour tout le groupe en une fois

