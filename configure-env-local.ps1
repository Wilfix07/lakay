# Script pour configurer automatiquement .env.local
# Ce script ajoute la SUPABASE_SERVICE_ROLE_KEY au fichier .env.local

Write-Host "🔧 Configuration automatique de .env.local..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si .env.local existe
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ Fichier .env.local non trouvé." -ForegroundColor Red
    Write-Host "Création depuis env.production.example..." -ForegroundColor Yellow
    Copy-Item "env.production.example" ".env.local"
    Write-Host "✅ Fichier .env.local créé." -ForegroundColor Green
    Write-Host ""
}

# Lire le contenu actuel
$envContent = Get-Content ".env.local" -Raw

# Vérifier si SUPABASE_SERVICE_ROLE_KEY existe déjà avec une vraie valeur
if ($envContent -match "SUPABASE_SERVICE_ROLE_KEY=eyJ") {
    Write-Host "✅ SUPABASE_SERVICE_ROLE_KEY est déjà configurée !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Votre fichier .env.local est prêt à l'emploi." -ForegroundColor Green
    Write-Host "Vous pouvez maintenant lancer : npm run dev" -ForegroundColor Cyan
    exit 0
}

Write-Host "⚠️  La SUPABASE_SERVICE_ROLE_KEY n'est pas encore configurée." -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 Pour obtenir votre Service Role Key :" -ForegroundColor Cyan
Write-Host "   1. Ouvrez : https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/settings/api" -ForegroundColor White
Write-Host "   2. Trouvez la ligne 'service_role' (type: secret)" -ForegroundColor White
Write-Host "   3. Cliquez sur 'Reveal' ou l'icône 👁️" -ForegroundColor White
Write-Host "   4. Copiez la valeur complète (commence par eyJ...)" -ForegroundColor White
Write-Host ""

# Demander à l'utilisateur de coller la clé
$serviceRoleKey = Read-Host "Collez votre SUPABASE_SERVICE_ROLE_KEY ici (ou appuyez sur Entrée pour ignorer)"

if ([string]::IsNullOrWhiteSpace($serviceRoleKey)) {
    Write-Host ""
    Write-Host "⚠️  Configuration manuelle requise." -ForegroundColor Yellow
    Write-Host "Ouvrez .env.local et remplacez 'REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY'" -ForegroundColor Yellow
    Write-Host "par votre vraie Service Role Key." -ForegroundColor Yellow
    exit 0
}

# Valider le format de la clé (doit commencer par eyJ)
if (-not $serviceRoleKey.StartsWith("eyJ")) {
    Write-Host ""
    Write-Host "❌ Format de clé invalide. La clé doit commencer par 'eyJ'" -ForegroundColor Red
    Write-Host "Veuillez vérifier que vous avez copié la clé complète." -ForegroundColor Yellow
    exit 1
}

# Remplacer ou ajouter la SUPABASE_SERVICE_ROLE_KEY
if ($envContent -match "SUPABASE_SERVICE_ROLE_KEY=") {
    # Remplacer la valeur existante
    $envContent = $envContent -replace "SUPABASE_SERVICE_ROLE_KEY=.*", "SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey"
} else {
    # Ajouter à la fin
    $envContent += "`nSUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey`n"
}

# Écrire le fichier mis à jour
$envContent | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "✅ Configuration terminée avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Récapitulatif des variables configurées :" -ForegroundColor Cyan
Write-Host "   ✅ NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Green
Write-Host "   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Green
Write-Host "   ✅ SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Vous pouvez maintenant lancer le serveur :" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Rappel de sécurité :" -ForegroundColor Yellow
Write-Host "   - Le fichier .env.local est dans .gitignore (ne sera pas committé)" -ForegroundColor White
Write-Host "   - Ne partagez JAMAIS votre SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
Write-Host ""

