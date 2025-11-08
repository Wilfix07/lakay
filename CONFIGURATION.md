# Configuration Supabase

## ✅ Fichier .env.local créé

Le fichier `.env.local` a été créé avec vos clés Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔄 Redémarrage nécessaire

**IMPORTANT** : Après avoir créé ou modifié le fichier `.env.local`, vous devez **redémarrer le serveur de développement** pour que les changements prennent effet.

### Étapes :

1. **Arrêtez le serveur actuel** (si en cours d'exécution)
   - Appuyez sur `Ctrl+C` dans le terminal où le serveur tourne

2. **Redémarrez le serveur**
   ```bash
   npm run dev
   ```

3. **Vérifiez la console du navigateur**
   - Ouvrez les outils de développement (F12)
   - Allez dans l'onglet "Console"
   - Vous ne devriez plus voir d'erreur "Failed to fetch"

## 🔍 Vérification

Si vous voyez encore l'erreur "Failed to fetch" :

1. Vérifiez que le fichier `.env.local` existe à la racine du projet
2. Vérifiez que les variables commencent bien par `NEXT_PUBLIC_`
3. Redémarrez complètement le serveur (arrêt complet puis relance)
4. Videz le cache du navigateur (Ctrl+Shift+R)

## 📝 Note

Le fichier `.env.local` est dans `.gitignore` et ne sera pas commité dans Git, ce qui est correct pour la sécurité.

