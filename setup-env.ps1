# Script PowerShell pour générer le fichier .env.local
# Usage: .\setup-env.ps1

Write-Host "🔧 Génération du fichier .env.local..." -ForegroundColor Cyan

$envContent = @"
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
"@

# Écrire le contenu dans .env.local
$envContent | Out-File -FilePath ".env.local" -Encoding utf8

Write-Host "✅ Fichier .env.local créé avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  ACTION REQUISE:" -ForegroundColor Yellow
Write-Host "1. Ouvrez https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api"
Write-Host "2. Copiez la valeur de 'service_role' key (secret)"
Write-Host "3. Ouvrez .env.local et remplacez 'REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY'"
Write-Host "4. Redémarrez le serveur: npm run dev"
Write-Host ""
Write-Host "📚 Pour plus d'informations, consultez SETUP_ENV.md" -ForegroundColor Cyan

