# 📸 Guide des Photos de Membres - Lakay

## Vue d'ensemble

Le système de photos de profil permet d'identifier visuellement les membres lors des opérations de remboursement et de consulter leur historique. Vous pouvez soit **télécharger une photo** existante, soit **prendre une photo** directement avec la caméra de votre appareil.

---

## 🎯 Fonctionnalités

### Où Apparaissent les Photos ?

Les photos de membres sont affichées dans **3 endroits stratégiques** :

#### **1. Page Membres (`/membres`)**
- ✅ **Formulaire d'ajout** : Uploader ou capturer une photo lors de la création d'un membre
- ✅ **Historique des prêts** : Photo affichée dans l'en-tête de l'historique quand vous cliquez sur un membre

#### **2. Formulaire de Remboursement (`/remboursements`)**
- ✅ **En-tête du formulaire** : Photo du membre s'affiche automatiquement quand vous sélectionnez un prêt
- ✅ **Aide visuelle** : Confirme visuellement l'identité du membre avant de valider un paiement

#### **3. Historique des Prêts (dans la page Membres)**
- ✅ **Photo de profil** : Affichée à côté du nom et des informations du membre
- ✅ **Identification rapide** : Facilite l'identification lors de la consultation de l'historique

---

## 📱 Comment Ajouter une Photo

### Méthode 1 : Télécharger une Photo Existante

1. Allez sur la page **Membres** (`/membres`)
2. Cliquez sur **"Nouveau Membre"**
3. Remplissez les informations du membre
4. Dans la section **"Photo du membre (optionnel)"** :
   - Cliquez sur le bouton **"Télécharger"**
   - Sélectionnez une photo depuis votre appareil
   - La photo sera immédiatement prévisualisée
5. Cliquez sur **"Créer le membre"**

#### Contraintes
- ✅ Format accepté : JPG, PNG, GIF, WEBP
- ✅ Taille maximale : 5 MB
- ✅ Recommandation : Photo carrée pour meilleur affichage

### Méthode 2 : Prendre une Photo avec la Caméra

1. Allez sur la page **Membres** (`/membres`)
2. Cliquez sur **"Nouveau Membre"**
3. Remplissez les informations du membre
4. Dans la section **"Photo du membre (optionnel)"** :
   - Cliquez sur le bouton **"Prendre une photo"**
   - Autorisez l'accès à la caméra si demandé
   - Ajustez le cadrage
   - Cliquez sur **"Capturer"**
   - La photo sera immédiatement prévisualisée
5. Cliquez sur **"Créer le membre"**

#### Notes sur l'Accès à la Caméra
- ⚠️ Le navigateur demandera la permission d'accéder à la caméra
- ⚠️ Sur mobile, vous pouvez choisir caméra avant/arrière
- ⚠️ Si la permission est refusée, utilisez le bouton "Télécharger"

---

## 🖼️ Affichage des Photos

### Format d'Affichage

Les photos sont affichées en **cercle** avec une bordure de couleur de marque :

```
┌─────────────────────────┐
│    ╭────────────╮        │
│   ╱              ╲       │
│  │   Photo du    │      │
│  │    Membre     │      │
│   ╲              ╱       │
│    ╰────────────╯        │
│  Bordure mauve (#AB7997) │
└─────────────────────────┘
```

### Tailles d'Affichage

- **Formulaire Membres** : 128×128 pixels (8rem)
- **Formulaire Remboursement** : 64×64 pixels (4rem)
- **Historique des Prêts** : 80×80 pixels (5rem)

### Icône par Défaut

Si un membre n'a pas de photo, une icône utilisateur par défaut s'affiche :

```
┌─────────────────────────┐
│    ╭────────────╮        │
│   ╱              ╲       │
│  │      👤       │      │
│  │   (Icône)     │      │
│   ╲              ╱       │
│    ╰────────────╯        │
└─────────────────────────┘
```

---

## 🔄 Modifier ou Supprimer une Photo

### Supprimer une Photo

1. Ouvrez le formulaire d'ajout de membre (ou d'édition si disponible)
2. Cliquez sur le bouton **"X"** en haut à droite de la photo
3. La photo est supprimée et l'icône par défaut s'affiche

### Remplacer une Photo

1. Supprimez la photo existante (bouton "X")
2. Ajoutez une nouvelle photo (télécharger ou capturer)

---

## 💾 Stockage des Photos

### Supabase Storage (Recommandé)

Si le bucket `member-photos` est configuré dans Supabase Storage :
- ✅ Photos stockées dans le cloud
- ✅ URLs publiques générées automatiquement
- ✅ Gestion optimale des ressources
- ✅ CDN intégré pour chargement rapide

### Fallback Base64 (Si Storage indisponible)

Si Supabase Storage n'est pas disponible :
- ⚠️ Photos stockées en Base64 dans la base de données
- ⚠️ Moins performant pour les grandes images
- ✅ Fonctionne sans configuration supplémentaire

---

## 🛠️ Configuration Supabase Storage (Optionnel)

Pour activer le stockage optimal dans Supabase :

### 1. Créer le Bucket

```sql
-- Dans Supabase Dashboard > Storage
-- Créer un nouveau bucket nommé "member-photos"
-- Type: Public
```

### 2. Configurer les Politiques RLS

```sql
-- Autoriser l'upload pour les utilisateurs authentifiés
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'member-photos');

-- Autoriser la lecture publique
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'member-photos');

-- Autoriser la suppression pour les utilisateurs authentifiés
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'member-photos');
```

### 3. Vérification

Une fois configuré, les nouvelles photos seront automatiquement uploadées vers Supabase Storage au lieu d'être stockées en Base64.

---

## 🎨 Personnalisation

### Modifier la Bordure de la Photo

Les photos ont une bordure de couleur mauve (couleur de marque). Pour modifier :

```tsx
// Dans components/PhotoUpload.tsx, app/membres/page.tsx, app/remboursements/page.tsx
// Changez la classe:
className="border-4 border-primary/20"

// Pour une autre couleur:
className="border-4 border-secondary/20"  // Vert
className="border-4 border-accent/20"     // Mauve clair
```

### Modifier la Taille de la Photo

```tsx
// Dans le composant concerné
// Changez les classes w-* et h-*

// Plus petit (48×48)
className="w-12 h-12 rounded-full"

// Plus grand (128×128)
className="w-32 h-32 rounded-full"
```

---

## 📊 Structure des Données

### Base de Données

#### Table `membres`
```sql
ALTER TABLE membres ADD COLUMN photo_url TEXT;
```

- **`photo_url`** : URL de la photo (Supabase Storage) ou données Base64
- **Type** : `TEXT`
- **Nullable** : `true` (optionnel)

### Interface TypeScript

```typescript
export interface Membre {
  id: number
  membre_id: string
  agent_id: string
  nom: string
  prenom: string
  telephone?: string
  adresse?: string
  photo_url?: string | null  // ← Nouveau champ
  created_at: string
  updated_at: string
}
```

---

## 🔍 Exemples d'Utilisation

### Exemple 1 : Affichage dans un Composant

```tsx
import { User } from 'lucide-react'

function MemberCard({ membre }: { membre: Membre }) {
  return (
    <div className="flex items-center gap-3">
      {membre.photo_url ? (
        <img
          src={membre.photo_url}
          alt={`${membre.prenom} ${membre.nom}`}
          className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-primary/20">
          <User className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="font-medium">{membre.prenom} {membre.nom}</p>
        <p className="text-sm text-muted-foreground">{membre.membre_id}</p>
      </div>
    </div>
  )
}
```

### Exemple 2 : Composant PhotoUpload

```tsx
import { PhotoUpload } from '@/components/PhotoUpload'

function MemberForm() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  return (
    <form>
      {/* ... autres champs ... */}
      
      <div>
        <label>Photo du membre</label>
        <PhotoUpload
          currentPhotoUrl={photoUrl}
          onPhotoChange={setPhotoUrl}
          memberId="0001" // ID du membre (optionnel)
        />
      </div>
      
      {/* ... bouton submit ... */}
    </form>
  )
}
```

---

## 🚨 Gestion des Erreurs

### Erreurs Courantes

#### **"Impossible d'accéder à la caméra"**
- **Cause** : Permission refusée ou caméra non disponible
- **Solution** : Utilisez le bouton "Télécharger" pour uploader une photo existante

#### **"L'image ne doit pas dépasser 5 MB"**
- **Cause** : Fichier trop volumineux
- **Solution** : Réduisez la taille de l'image avant de l'uploader

#### **"Veuillez sélectionner une image valide"**
- **Cause** : Format de fichier non supporté
- **Solution** : Utilisez JPG, PNG, GIF ou WEBP

#### **"Erreur lors de l'upload de la photo"**
- **Cause** : Problème de connexion ou erreur Supabase
- **Solution** : La photo sera automatiquement stockée en Base64 (fallback)

---

## 📈 Avantages de la Fonctionnalité

### Pour les Agents de Crédit

1. ✅ **Identification visuelle rapide** des membres
2. ✅ **Évite les erreurs** lors des remboursements
3. ✅ **Professionnalisme** accru dans la gestion
4. ✅ **Confiance** renforcée avec les membres

### Pour les Administrateurs

1. ✅ **Base de données complète** avec photos
2. ✅ **Suivi visuel** des membres
3. ✅ **Rapports** plus informatifs
4. ✅ **Archive** photographique automatique

---

## 🎯 Bonnes Pratiques

### Qualité des Photos

- ✅ Utilisez un fond neutre et bien éclairé
- ✅ Cadrez le visage du membre (portrait)
- ✅ Évitez les photos floues ou trop sombres
- ✅ Privilégiez un format carré

### Sécurité et Confidentialité

- ✅ Demandez toujours le consentement du membre
- ✅ Informez le membre de l'utilisation de sa photo
- ✅ Ne partagez pas les photos en dehors du système
- ✅ Respectez la confidentialité des données personnelles

### Performance

- ✅ Compressez les photos avant l'upload (max 1 MB recommandé)
- ✅ Utilisez Supabase Storage pour de meilleures performances
- ✅ Évitez les très grandes images (>5 MB)

---

## 🔧 Dépannage

### La Photo ne S'Affiche Pas

1. Vérifiez que `photo_url` contient une valeur dans la base de données
2. Si c'est une URL Supabase, vérifiez que le bucket est public
3. Si c'est du Base64, vérifiez que la chaîne commence par `data:image/`

### La Caméra ne Fonctionne Pas

1. Vérifiez les permissions du navigateur (Paramètres > Confidentialité)
2. Essayez un autre navigateur (Chrome/Firefox recommandés)
3. Sur mobile, vérifiez les permissions de l'application
4. Utilisez HTTPS (requis pour accès caméra)

### Upload Lent

1. Réduisez la taille de l'image
2. Vérifiez votre connexion Internet
3. Configurez Supabase Storage pour un upload plus rapide

---

## 📚 Ressources

### Composants Créés

- **`components/PhotoUpload.tsx`** : Composant principal pour upload/capture
- **`app/membres/page.tsx`** : Intégration dans le formulaire membres
- **`app/remboursements/page.tsx`** : Affichage dans le formulaire de remboursement

### Migration Appliquée

```sql
-- Migration: add_membre_photo_url
ALTER TABLE membres ADD COLUMN IF NOT EXISTS photo_url TEXT;
```

### TypeScript Types

```typescript
// lib/supabase.ts
export interface Membre {
  // ... autres champs
  photo_url?: string | null
}
```

---

## ✅ Résumé

**La fonctionnalité de photos de membres est maintenant entièrement intégrée ! 📸**

- ✅ Upload ou capture de photo dans le formulaire membres
- ✅ Affichage dans le formulaire de remboursement
- ✅ Affichage dans l'historique des prêts
- ✅ Stockage optimisé (Supabase Storage ou Base64)
- ✅ Interface responsive et intuitive
- ✅ Gestion des erreurs complète
- ✅ Icons par défaut pour membres sans photo

**Vos agents peuvent maintenant identifier visuellement les membres lors de chaque opération ! 🎉**

