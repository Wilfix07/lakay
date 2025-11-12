#!/bin/bash

# Script pour générer le fichier .env.local
# Usage: ./setup-env.sh

echo "🔧 Génération du fichier .env.local..."

# Créer le fichier .env.local
cat > .env.local << 'EOF'
# Supabase Configuration
# 🔗 URL du projet Supabase
NEXT_PUBLIC_SUPABASE_URL=https://nrufoxocjciiadhndfwo.supabase.co

# 🔑 Clé publique (anon key) - Safe pour le client
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ydWZveG9jamNpaWFkaG5kZndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTU0NjYsImV4cCI6MjA3ODEzMTQ2Nn0.1EWCgqwBBAeHSezN0mgbiEWEkem_zgSc5NmeWq1lJw8

# 🔐 Service Role Key - REQUIS POUR LES API ROUTES
# ⚠️ IMPORTANT: Récupérez cette clé depuis votre Dashboard Supabase
# 👉 https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api
# Copiez la valeur de "service_role" key et remplacez ci-dessous
SUPABASE_SERVICE_ROLE_KEY=REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY
EOF

echo "✅ Fichier .env.local créé avec succès!"
echo ""
echo "⚠️  ACTION REQUISE:"
echo "1. Ouvrez https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api"
echo "2. Copiez la valeur de 'service_role' key (secret)"
echo "3. Ouvrez .env.local et remplacez 'REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY'"
echo "4. Redémarrez le serveur: npm run dev"
echo ""
echo "📚 Pour plus d'informations, consultez SETUP_ENV.md"

