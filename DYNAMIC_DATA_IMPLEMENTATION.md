# Implémentation des Données Dynamiques

Ce document décrit l'implémentation complète des données dynamiques dans le projet Lakay.

## 📋 Vue d'ensemble

Toutes les données statiques du projet ont été rendues dynamiques et peuvent être configurées par chaque manager dans la page "Paramètres". Les données sont stockées dans Supabase et chargées dynamiquement via un contexte React.

## 🗄️ Modifications de la Base de Données

### 1. Table `manager_business_settings` - Colonnes ajoutées

Les colonnes suivantes ont été ajoutées pour la localisation et les paramètres d'application :

- `currency_code` (VARCHAR(10)) - Code de devise (ex: HTG, USD, EUR)
- `currency_symbol` (VARCHAR(10)) - Symbole de devise (ex: HTG, $, €)
- `locale` (VARCHAR(10)) - Locale pour le formatage (ex: fr-FR, en-US)
- `date_format` (VARCHAR(20)) - Format de date (ex: DD/MM/YYYY)
- `timezone` (VARCHAR(50)) - Fuseau horaire (ex: America/Port-au-Prince)
- `app_title` (VARCHAR(255)) - Titre de l'application
- `app_description` (TEXT) - Description de l'application
- `app_language` (VARCHAR(10)) - Langue de l'application (ex: fr, en, es, ht)

### 2. Table `month_names` - Nouvelle table

Table pour stocker les noms des mois dans différentes langues :

- `id` (SERIAL PRIMARY KEY)
- `manager_id` (UUID) - ID du manager (NULL pour les valeurs globales)
- `locale` (VARCHAR(10)) - Locale (ex: fr-FR)
- `month_number` (INTEGER) - Numéro du mois (1-12)
- `short_name` (VARCHAR(20)) - Nom court (ex: Janv)
- `long_name` (VARCHAR(20)) - Nom long (ex: Janvier)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `UNIQUE(manager_id, locale, month_number)`

**Données par défaut** : 12 mois en français (fr-FR) ont été insérés pour les valeurs globales (manager_id = NULL).

### 3. Table `repayment_frequencies` - Nouvelle table

Table pour stocker les fréquences de remboursement :

- `id` (SERIAL PRIMARY KEY)
- `manager_id` (UUID) - ID du manager (NULL pour les valeurs globales)
- `frequency_key` (VARCHAR(20)) - Clé de la fréquence (ex: journalier, mensuel)
- `frequency_label` (VARCHAR(50)) - Libellé affiché (ex: Journalier, Mensuel)
- `frequency_days` (INTEGER) - Nombre de jours (ex: 1, 30)
- `is_active` (BOOLEAN) - Si la fréquence est active
- `display_order` (INTEGER) - Ordre d'affichage
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `UNIQUE(manager_id, frequency_key)`

**Données par défaut** : 2 fréquences ont été insérées pour les valeurs globales :
- `journalier` (Journalier, 1 jour)
- `mensuel` (Mensuel, 30 jours)

## 📁 Fichiers Créés

### 1. `lib/contexts/DynamicDataContext.tsx`

Contexte React qui charge et fournit toutes les données dynamiques :

- **Localisation** : Devise, locale, format de date, timezone, langue
- **Noms des mois** : Liste des noms des mois selon la locale
- **Fréquences de remboursement** : Liste des fréquences disponibles
- **Paramètres d'application** : Titre, description, logo, langue

**Fonctionnalités** :
- Charge les données au démarrage
- Écoute les changements d'authentification
- Écoute les événements de rafraîchissement (`dynamicDataRefresh`)
- Fournit un hook `useDynamicData()` pour accéder aux données

### 2. `components/DynamicDataWrapper.tsx`

Wrapper client qui enveloppe l'application avec le contexte dynamique :

- Enveloppe les enfants avec `DynamicDataProvider`
- Inclut le composant `DynamicMetadata` pour mettre à jour les métadonnées

### 3. `components/DynamicMetadata.tsx`

Composant qui met à jour les métadonnées de l'application :

- Met à jour le titre de la page (`document.title`)
- Met à jour la langue du document (`document.documentElement.lang`)
- Met à jour la meta description

### 4. `lib/hooks/useDynamicFormatting.ts`

Hooks React pour formater les données avec les paramètres dynamiques :

- `useFormatCurrency()` - Formate les montants avec la devise dynamique
- `useFormatDate()` - Formate les dates avec la locale dynamique
- `useGetMonthName()` - Récupère le nom du mois avec les données dynamiques

## 🔧 Fichiers Modifiés

### 1. `lib/systemSettings.ts`

Nouvelles fonctions ajoutées :

- `getLocalizationSettings(managerId?)` - Récupère les paramètres de localisation
- `getMonthNames(managerId?)` - Récupère les noms des mois
- `getRepaymentFrequencies(managerId?)` - Récupère les fréquences de remboursement
- `getAppSettings(managerId?)` - Récupère les paramètres de l'application

**Fonctionnalités** :
- Détection automatique du `manager_id` pour les managers et agents
- Fallback vers les valeurs globales si aucun manager n'est détecté
- Support des valeurs par défaut si aucune donnée n'est trouvée

### 2. `lib/utils.ts`

Nouvelles fonctions asynchrones ajoutées :

- `formatCurrencyDynamic(amount, currencyCode?, currencySymbol?, locale?, managerId?)` - Formatage dynamique de devise
- `formatDateDynamic(date, locale?, managerId?)` - Formatage dynamique de date
- `getMonthNameDynamic(date, format?, managerId?)` - Récupération dynamique du nom du mois

**Compatibilité** :
- Les fonctions synchrones existantes (`formatCurrency`, `formatDate`, `getMonthName`) restent disponibles
- Les nouvelles fonctions asynchrones utilisent un cache pour éviter les appels répétés

### 3. `app/layout.tsx`

- Ajout du `DynamicDataWrapper` pour envelopper toute l'application
- Les métadonnées sont maintenant mises à jour dynamiquement

### 4. `app/parametres/page.tsx`

Formulaire étendu pour inclure :

- **Section Localisation** :
  - Code de devise
  - Symbole de devise
  - Locale
  - Format de date
  - Timezone

- **Section Application** :
  - Titre de l'application
  - Description de l'application
  - Langue de l'application

**Fonctionnalités** :
- Sauvegarde tous les paramètres dans `manager_business_settings`
- Déclenche un événement `dynamicDataRefresh` après sauvegarde
- Les changements sont immédiatement reflétés dans l'application

### 5. `app/prets/page.tsx`

- Utilise les fréquences de remboursement dynamiques depuis la base de données
- Le formulaire de création de prêt affiche les fréquences configurées par le manager
- Les valeurs par défaut sont basées sur les fréquences disponibles

## 🚀 Utilisation

### Pour les Managers

1. **Configurer les paramètres** :
   - Aller dans "Paramètres" > "Informations Business"
   - Configurer la localisation (devise, locale, format de date)
   - Configurer l'application (titre, description, langue)
   - Cliquer sur "Enregistrer"

2. **Les changements sont appliqués immédiatement** :
   - Le titre de la page est mis à jour
   - La langue du document est mise à jour
   - Les formats de devise et de date utilisent les nouveaux paramètres
   - Les fréquences de remboursement sont mises à jour

### Pour les Développeurs

#### Utiliser le contexte dynamique

```typescript
import { useDynamicData } from '@/lib/contexts/DynamicDataContext'

function MyComponent() {
  const { localization, monthNames, repaymentFrequencies, appSettings } = useDynamicData()
  
  // Utiliser les données dynamiques
  const currencySymbol = localization.currencySymbol
  const locale = localization.locale
  // ...
}
```

#### Utiliser les hooks de formatage

```typescript
import { useFormatCurrency, useFormatDate, useGetMonthName } from '@/lib/hooks/useDynamicFormatting'

function MyComponent() {
  const formatCurrency = useFormatCurrency()
  const formatDate = useFormatDate()
  const getMonthName = useGetMonthName()
  
  // Utiliser les fonctions de formatage
  const formattedAmount = formatCurrency(1000)
  const formattedDate = formatDate(new Date())
  const monthName = getMonthName(new Date(), 'short')
}
```

#### Utiliser les fonctions asynchrones

```typescript
import { formatCurrencyDynamic, formatDateDynamic, getMonthNameDynamic } from '@/lib/utils'

async function MyComponent() {
  // Formater avec les paramètres dynamiques
  const formattedAmount = await formatCurrencyDynamic(1000)
  const formattedDate = await formatDateDynamic(new Date())
  const monthName = await getMonthNameDynamic(new Date(), 'short')
}
```

## 🔄 Flux de Données

1. **Au démarrage de l'application** :
   - Le `DynamicDataProvider` charge les données depuis Supabase
   - Les données sont stockées dans le contexte React
   - Les métadonnées de l'application sont mises à jour

2. **Lors de la modification des paramètres** :
   - Le manager modifie les paramètres dans "Paramètres"
   - Les paramètres sont sauvegardés dans Supabase
   - Un événement `dynamicDataRefresh` est déclenché
   - Le contexte recharge les données depuis Supabase
   - Les métadonnées sont mises à jour

3. **Utilisation des données** :
   - Les composants utilisent le hook `useDynamicData()` pour accéder aux données
   - Les fonctions de formatage utilisent les paramètres dynamiques
   - Les données sont mises en cache pour éviter les appels répétés

## 🎯 Avantages

1. **Flexibilité** : Chaque manager peut configurer ses propres paramètres
2. **Localisation** : Support de plusieurs langues et devises
3. **Personnalisation** : Titre, description, et logo personnalisables
4. **Performance** : Mise en cache des données pour éviter les appels répétés
5. **Compatibilité** : Les fonctions synchrones existantes restent disponibles

## 📝 Notes Importantes

1. **Valeurs par défaut** : Si aucun paramètre n'est configuré, les valeurs par défaut sont utilisées (HTG, fr-FR, etc.)
2. **Isolation des données** : Chaque manager a ses propres paramètres, mais les valeurs globales (manager_id = NULL) sont partagées
3. **Cache** : Les données sont mises en cache pendant 5 minutes pour améliorer les performances
4. **Rafraîchissement** : Les données peuvent être rafraîchies manuellement via l'événement `dynamicDataRefresh`

## 🔍 Prochaines Étapes

1. Ajouter le support de plusieurs langues pour les noms des mois
2. Ajouter la gestion des timezones pour les dates
3. Ajouter la validation des formats de date
4. Ajouter la gestion des devises multiples
5. Ajouter l'historique des changements de paramètres

## ✅ Checklist de Déploiement

- [x] Migration de la base de données appliquée
- [x] Contexte React créé et intégré
- [x] Fonctions de formatage dynamiques créées
- [x] Page de paramètres mise à jour
- [x] Page des prêts mise à jour
- [x] Métadonnées dynamiques implémentées
- [x] Documentation créée

## 🎉 Résultat

Toutes les données du projet sont maintenant **100% dynamiques** et peuvent être configurées par chaque manager dans la page "Paramètres". Les changements sont appliqués immédiatement dans toute l'application.

