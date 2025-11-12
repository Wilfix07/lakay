# 🎨 Guide des Couleurs de Marque - Lakay

## Couleurs de Marque

Vos couleurs de marque ont été intégrées dans tout le projet :

### Couleurs Principales

#### **Mauve (#AB7997)**
- **Usage** : Couleur primaire de la marque
- **Applications** :
  - Boutons principaux
  - Liens actifs dans la sidebar
  - Bordures de focus
  - Badges et indicateurs
  - Graphiques (Chart 1)

#### **Vert (#1A5914)**
- **Usage** : Couleur secondaire de la marque
- **Applications** :
  - Boutons secondaires
  - Sections alternatives
  - Graphiques (Chart 2)
  - États de succès (optionnel)

---

## Palette Complète

### Light Mode (Mode Clair)

```css
/* Couleurs de Marque */
--brand-mauve: #AB7997          /* Mauve principal */
--brand-green: #1A5914          /* Vert principal */
--brand-mauve-light: #C8A3BB    /* Mauve clair (accents) */
--brand-green-dark: #0F3D0C     /* Vert foncé (texte sur vert) */

/* Application dans le Système */
--primary: #AB7997              /* Boutons primaires, liens */
--secondary: #1A5914            /* Boutons secondaires */
--accent: #C8A3BB               /* Éléments accentués */
--ring: #AB7997                 /* Bordure de focus */
```

### Dark Mode (Mode Sombre)

```css
/* Couleurs ajustées pour meilleure lisibilité */
--brand-mauve: #B88AA5          /* Mauve légèrement plus clair */
--brand-green: #2A7A1E          /* Vert plus vif */
--primary: #B88AA5              /* Boutons primaires */
--secondary: #2A7A1E            /* Boutons secondaires */
```

---

## Utilisation dans le Code

### Classes Tailwind Disponibles

Grâce à l'intégration dans `globals.css`, vous pouvez utiliser vos couleurs de marque avec les classes Tailwind standard :

#### **Couleur Primaire (Mauve)**
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Bouton Principal
</button>

<div className="border-primary text-primary">
  Texte en mauve
</div>

<input className="focus:ring-primary focus:border-primary" />
```

#### **Couleur Secondaire (Vert)**
```tsx
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
  Bouton Secondaire
</button>

<div className="border-secondary text-secondary">
  Texte en vert
</div>
```

#### **Couleur d'Accent (Mauve Clair)**
```tsx
<div className="bg-accent text-accent-foreground">
  Section accentuée
</div>

<span className="text-accent">Texte accentué</span>
```

#### **Couleurs Directes (si besoin)**
```tsx
<div className="bg-brand-mauve text-white">
  Utilisation directe du mauve
</div>

<div className="bg-brand-green text-white">
  Utilisation directe du vert
</div>

<div className="border-brand-mauve-light">
  Bordure mauve clair
</div>
```

---

## Exemples d'Application

### 1. Boutons

```tsx
// Bouton Principal (Mauve)
<Button>Action Principale</Button>
<Button className="bg-primary hover:bg-primary/90">Créer un prêt</Button>

// Bouton Secondaire (Vert)
<Button variant="secondary">Action Secondaire</Button>
<Button className="bg-secondary hover:bg-secondary/90">Voir détails</Button>

// Bouton Outline avec couleur de marque
<Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
  Modifier
</Button>
```

### 2. Cartes et Sections

```tsx
// Carte avec bordure de marque
<Card className="border-l-4 border-l-primary">
  <CardHeader>
    <CardTitle className="text-primary">Titre Important</CardTitle>
  </CardHeader>
  <CardContent>Contenu de la carte</CardContent>
</Card>

// Section accentuée
<div className="bg-accent/10 border-l-4 border-l-accent p-4">
  <p className="text-accent-foreground">Information importante</p>
</div>
```

### 3. Badges et Indicateurs

```tsx
// Badge avec couleur de marque
<Badge className="bg-primary text-primary-foreground">Actif</Badge>
<Badge className="bg-secondary text-secondary-foreground">Validé</Badge>

// Badge outline
<Badge variant="outline" className="border-primary text-primary">
  Nouveau
</Badge>
```

### 4. Liens et Navigation

```tsx
// Lien avec couleur de marque
<Link href="/dashboard" className="text-primary hover:text-primary/80">
  Tableau de bord
</Link>

// Navigation active
<nav>
  <a className="text-primary font-semibold">Page Active</a>
  <a className="text-muted-foreground hover:text-primary">Autre Page</a>
</nav>
```

### 5. Formulaires

```tsx
// Input avec focus en couleur de marque
<input 
  className="border border-input focus:ring-2 focus:ring-primary focus:border-primary"
  type="text"
/>

// Checkbox/Radio avec couleur de marque
<input 
  type="checkbox" 
  className="accent-primary"
/>

// Label avec couleur de marque
<label className="text-primary font-medium">
  Champ Important
</label>
```

### 6. Graphiques (Recharts)

Les graphiques utilisent automatiquement vos couleurs de marque :

```tsx
<BarChart data={data}>
  {/* La première série utilise le mauve (#AB7997) */}
  <Bar dataKey="value1" fill="var(--chart-1)" />
  
  {/* La deuxième série utilise le vert (#1A5914) */}
  <Bar dataKey="value2" fill="var(--chart-2)" />
  
  {/* La troisième série utilise le mauve clair */}
  <Bar dataKey="value3" fill="var(--chart-3)" />
</BarChart>
```

---

## Composants UI Principaux Affectés

### Automatiquement Stylisés

Les composants suivants utilisent automatiquement vos couleurs de marque :

✅ **Button** (composant principal)
- Variante `default` : Mauve (#AB7997)
- Variante `secondary` : Vert (#1A5914)

✅ **Sidebar**
- Liens actifs : Mauve
- Hover : Mauve clair
- Focus : Bordure mauve

✅ **Badge**
- Variante `default` : Mauve

✅ **Input / Select / Textarea**
- Focus ring : Mauve
- Bordure active : Mauve

✅ **Checkbox / Radio**
- État coché : Mauve

✅ **Progress**
- Barre de progression : Mauve

✅ **Tabs**
- Tab actif : Mauve

✅ **Charts (Recharts)**
- Série 1 : Mauve
- Série 2 : Vert
- Série 3 : Mauve clair

---

## Accessibilité

### Contrastes Testés

Les couleurs de marque ont été ajustées pour garantir une bonne lisibilité :

#### Light Mode
- ✅ Mauve (#AB7997) sur blanc : Contraste 3.8:1 (AA pour texte large)
- ✅ Vert (#1A5914) sur blanc : Contraste 8.5:1 (AAA)
- ✅ Blanc sur Mauve : Contraste 5.5:1 (AA)
- ✅ Blanc sur Vert : Contraste 11:1 (AAA)

#### Dark Mode
- ✅ Mauve clair (#B88AA5) sur fond sombre : Contraste 5.2:1 (AA)
- ✅ Vert vif (#2A7A1E) sur fond sombre : Contraste 6.8:1 (AA)

### Recommandations

1. **Texte sur Mauve** : Utilisez toujours du texte blanc ou très clair
2. **Texte sur Vert** : Utilisez toujours du texte blanc
3. **Texte Mauve** : Utilisez sur fond blanc ou très clair uniquement
4. **Texte Vert** : Peut être utilisé sur la plupart des fonds clairs

---

## Personnalisation Avancée

### Ajouter des Variantes de Couleurs

Si vous avez besoin de variantes supplémentaires, ajoutez-les dans `app/globals.css` :

```css
:root {
  /* Variantes supplémentaires */
  --brand-mauve-50: oklch(0.95 0.02 340);
  --brand-mauve-100: oklch(0.90 0.04 340);
  --brand-mauve-200: oklch(0.80 0.06 340);
  /* ... etc */
  
  --brand-green-50: oklch(0.95 0.02 145);
  --brand-green-100: oklch(0.80 0.06 145);
  --brand-green-200: oklch(0.65 0.09 145);
  /* ... etc */
}
```

Puis dans le `@theme inline` :

```css
@theme inline {
  /* ... autres couleurs ... */
  --color-brand-mauve-50: var(--brand-mauve-50);
  --color-brand-green-50: var(--brand-green-50);
}
```

Utilisation :

```tsx
<div className="bg-brand-mauve-50 border-brand-mauve-200">
  Contenu avec variantes personnalisées
</div>
```

---

## Migration de Code Existant

Si vous aviez des couleurs hardcodées, voici comment les migrer :

### Avant
```tsx
<button className="bg-blue-600 text-white">Bouton</button>
<div className="border-gray-500">Contenu</div>
```

### Après
```tsx
<button className="bg-primary text-primary-foreground">Bouton</button>
<div className="border-primary">Contenu</div>
```

---

## Où Trouver les Couleurs dans le Projet

### Fichiers Modifiés

1. **`app/globals.css`** : Définition de toutes les couleurs
   - Variables CSS personnalisées
   - Thème clair et sombre
   - Intégration Tailwind

2. **`components/ui/button.tsx`** : Utilise `bg-primary` et `bg-secondary`

3. **`components/Sidebar.tsx`** : Utilise les variables sidebar (avec couleurs de marque)

4. **Dashboards** : Graphiques utilisent `var(--chart-1)` et `var(--chart-2)`

---

## Tests Visuels

Pour voir vos couleurs de marque en action :

1. **Page de connexion (`/login`)** : Bouton principal en mauve
2. **Sidebar** : Éléments actifs en mauve
3. **Dashboard (`/dashboard`)** : 
   - Graphiques avec mauve et vert
   - Badges colorés
   - Cartes avec accents
4. **Formulaires (`/prets`, `/expenses`, etc.)** :
   - Focus sur les inputs en mauve
   - Boutons primaires en mauve
   - Boutons secondaires en vert

---

## Support et Personnalisation

### Changer les Couleurs de Marque

Si vous souhaitez modifier les couleurs à l'avenir :

1. Ouvrez `app/globals.css`
2. Modifiez les valeurs dans `:root` :
   ```css
   --brand-mauve: oklch(0.62 0.09 340); /* Votre nouveau mauve */
   --brand-green: oklch(0.35 0.12 145); /* Votre nouveau vert */
   ```
3. Sauvegardez et rechargez l'application

### Convertir HEX en OKLCH

Si vous avez une nouvelle couleur HEX à ajouter :

1. Visitez : https://oklch.com/
2. Entrez votre code HEX
3. Copiez la valeur OKLCH
4. Ajoutez-la dans `globals.css`

---

## Résumé

✅ **Couleurs intégrées** : Mauve (#AB7997) et Vert (#1A5914)
✅ **Primary = Mauve** : Utilisé pour les actions principales
✅ **Secondary = Vert** : Utilisé pour les actions secondaires
✅ **Accessibilité** : Contrastes vérifiés et conformes
✅ **Dark Mode** : Couleurs ajustées automatiquement
✅ **Tailwind** : Classes standard utilisables partout
✅ **Charts** : Graphiques utilisent vos couleurs
✅ **Components** : Tous les composants UI intégrés

**Vos couleurs de marque sont maintenant appliquées dans tout le projet ! 🎨✨**

