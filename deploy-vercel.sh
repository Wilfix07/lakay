#!/bin/bash
# Script de déploiement sur Vercel
# Usage: ./deploy-vercel.sh

echo "🚀 Déploiement sur Vercel - Projet Lakay"
echo ""

# Vérifier si Vercel CLI est installé
echo "📦 Vérification de Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI n'est pas installé."
    echo "Installation de Vercel CLI..."
    npm install -g vercel
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation de Vercel CLI"
        exit 1
    fi
    echo "✅ Vercel CLI installé avec succès"
else
    echo "✅ Vercel CLI est installé"
fi

echo ""
echo "🔨 Vérification du build local..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Le build a échoué. Corrigez les erreurs avant de déployer."
    exit 1
fi
echo "✅ Build réussi"

echo ""
echo "📋 Variables d'environnement requises:"
echo "  - NEXT_PUBLIC_SUPABASE_URL"
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  - SUPABASE_SERVICE_ROLE_KEY (Production + Preview uniquement)"
echo ""
echo "⚠️  Assurez-vous que ces variables sont configurées dans Vercel Dashboard"
echo "   Settings → Environment Variables"
echo ""

read -p "Voulez-vous continuer avec le déploiement? (O/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Déploiement annulé."
    exit 0
fi

echo ""
echo "🔐 Connexion à Vercel..."
vercel login
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la connexion à Vercel"
    exit 1
fi

echo ""
echo "🚀 Déploiement..."
echo "Choisissez 'Y' pour lier à un projet existant ou 'N' pour créer un nouveau projet"
vercel

echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "📝 Prochaines étapes:"
echo "1. Vérifiez les variables d'environnement dans Vercel Dashboard"
echo "2. Testez l'application sur l'URL fournie"
echo "3. Pour déployer en production: vercel --prod"
echo ""

