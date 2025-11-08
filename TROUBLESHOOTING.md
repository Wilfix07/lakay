# Guide de Dépannage

## Erreur: "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"

Cette erreur se produit lorsque la route API retourne du HTML au lieu de JSON. Causes possibles :

### 1. Variable d'environnement manquante

**Problème** : `SUPABASE_SERVICE_ROLE_KEY` n'est pas définie dans `.env.local`

**Solution** :
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings** > **API**
4. Copiez la **service_role** key (⚠️ Ne la partagez JAMAIS publiquement)
5. Ajoutez-la dans votre fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

6. **Redémarrez le serveur de développement** (`npm run dev`)

### 2. Route API non trouvée (404)

**Problème** : La route `/api/users/create` n'existe pas

**Solution** : Vérifiez que le fichier `app/api/users/create/route.ts` existe

### 3. Erreur serveur (500)

**Problème** : Une erreur dans la route API cause une page d'erreur HTML

**Solution** : 
- Vérifiez les logs du serveur dans le terminal
- Vérifiez que toutes les variables d'environnement sont correctement définies
- Vérifiez que le client Supabase peut se connecter

### Vérification rapide

Pour vérifier si la variable est définie, ouvrez la console du navigateur et regardez les erreurs. Le message d'erreur amélioré devrait maintenant indiquer exactement ce qui manque.

## Autres erreurs courantes

### Erreur 500 lors de la création d'utilisateur

- Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est correcte
- Vérifiez que l'email n'est pas déjà utilisé
- Vérifiez que l'agent_id existe si vous créez un agent

### Erreur de permissions RLS

- Vérifiez que les politiques RLS sont correctement configurées
- Vérifiez que l'utilisateur connecté a les bonnes permissions

