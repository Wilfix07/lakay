# Système de Rôles et Permissions

## Rôles Disponibles

### 1. Admin
**Permissions complètes :**
- ✅ Créer des agents de crédit
- ✅ Créer des membres
- ✅ Créer des prêts
- ✅ Enregistrer des remboursements
- ✅ Voir toutes les données (tous les agents, membres, prêts, remboursements)

### 2. Manager
**Permissions :**
- ✅ Créer des agents de crédit
- ✅ Voir toutes les données (tous les agents, membres, prêts, remboursements)
- ❌ Ne peut pas créer de membres
- ❌ Ne peut pas créer de prêts
- ❌ Ne peut pas enregistrer de remboursements

### 3. Agent
**Permissions :**
- ✅ Créer des membres (seulement pour son propre agent_id)
- ✅ Créer des prêts (seulement pour ses propres membres)
- ✅ Enregistrer des remboursements (seulement pour ses propres prêts)
- ✅ Voir seulement ses propres données (membres, prêts, remboursements de son agent_id)
- ❌ Ne peut pas créer d'agents

## Workflow

1. **Admin** ou **Manager** crée les agents de crédit dans `/agents`
2. **Agent** se connecte et voit seulement ses données dans le dashboard
3. **Agent** crée des membres dans `/membres` (agent_id automatiquement assigné)
4. **Agent** crée des prêts dans `/prets` pour ses membres
5. **Agent** enregistre les remboursements dans `/remboursements`

## Création d'Utilisateurs

Voir `scripts/create-users.md` pour les instructions détaillées.

## Protection des Routes

Toutes les pages sont protégées par le composant `ProtectedRoute` qui vérifie :
- L'authentification de l'utilisateur
- Les permissions selon le rôle
- Redirige vers `/login` si non authentifié
- Redirige vers `/dashboard` si permissions insuffisantes

## Filtrage des Données

- **Admin** et **Manager** : Voient toutes les données
- **Agent** : Voit seulement les données liées à son `agent_id`

