import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour Vercel
  // Vercel gère automatiquement le déploiement Next.js, pas besoin de 'standalone'
  // Les variables NEXT_PUBLIC_* sont automatiquement exposées au client
  // SUPABASE_SERVICE_ROLE_KEY est uniquement disponible côté serveur (API routes)
  typescript: {
    ignoreBuildErrors: false,
  },
  // Note: eslint configuration moved to eslint.config.js (Next.js 16)
  // Optimisations pour la production
  poweredByHeader: false,
  compress: true,
  // Compatibilité avec Next.js 16
  reactStrictMode: true,
  // Note: Le warning Turbopack peut être ignoré - il n'affecte pas la fonctionnalité
};

export default nextConfig;
