# Script de déploiement sur Vercel
# Usage: .\deploy-vercel.ps1

Write-Host "🚀 Déploiement sur Vercel - Projet Lakay" -ForegroundColor Cyan
Write-Host ""

# Vérifier si Vercel CLI est installé
Write-Host "📦 Vérification de Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "⚠️  Vercel CLI n'est pas installé." -ForegroundColor Yellow
    Write-Host "Installation de Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'installation de Vercel CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Vercel CLI installé avec succès" -ForegroundColor Green
} else {
    Write-Host "✅ Vercel CLI est installé" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔨 Vérification du build local..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Le build a échoué. Corrigez les erreurs avant de déployer." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build réussi" -ForegroundColor Green

Write-Host ""
Write-Host "📋 Variables d'environnement requises:" -ForegroundColor Yellow
Write-Host "  - NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor White
Write-Host "  - NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor White
Write-Host "  - SUPABASE_SERVICE_ROLE_KEY (Production + Preview uniquement)" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Assurez-vous que ces variables sont configurées dans Vercel Dashboard" -ForegroundColor Yellow
Write-Host "   Settings → Environment Variables" -ForegroundColor Gray
Write-Host ""

$response = Read-Host "Voulez-vous continuer avec le déploiement? (O/N)"
if ($response -ne "O" -and $response -ne "o") {
    Write-Host "Déploiement annulé." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔐 Connexion à Vercel..." -ForegroundColor Yellow
vercel login
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la connexion à Vercel" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Déploiement..." -ForegroundColor Yellow
Write-Host "Choisissez 'Y' pour lier à un projet existant ou 'N' pour créer un nouveau projet" -ForegroundColor Gray
vercel

Write-Host ""
Write-Host "✅ Déploiement terminé!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "1. Vérifiez les variables d'environnement dans Vercel Dashboard" -ForegroundColor White
Write-Host "2. Testez l'application sur l'URL fournie" -ForegroundColor White
Write-Host "3. Pour déployer en production: vercel --prod" -ForegroundColor White
Write-Host ""

