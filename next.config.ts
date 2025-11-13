import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration pour Vercel
  // Vercel gère automatiquement le déploiement Next.js, pas besoin de 'standalone'
  // Les variables NEXT_PUBLIC_* sont automatiquement exposées au client
  // SUPABASE_SERVICE_ROLE_KEY est uniquement disponible côté serveur (API routes)
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
