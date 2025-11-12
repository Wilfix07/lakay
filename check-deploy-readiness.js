#!/usr/bin/env node

/**
 * Script de vérification avant déploiement
 * Vérifie que toutes les conditions sont réunies pour un déploiement réussi
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Vérification de la préparation au déploiement...\n');

let hasErrors = false;
let hasWarnings = false;

// Vérifier l'existence des fichiers critiques
const criticalFiles = [
  'package.json',
  'next.config.ts',
  'netlify.toml',
  '.nvmrc',
  'supabase/schema.sql',
];

console.log('📁 Vérification des fichiers critiques:');
criticalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  if (exists) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MANQUANT`);
    hasErrors = true;
  }
});

// Vérifier package.json
console.log('\n📦 Vérification de package.json:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts.build) {
    console.log('  ✅ Script build défini');
  } else {
    console.log('  ❌ Script build manquant');
    hasErrors = true;
  }

  if (packageJson.dependencies && packageJson.dependencies['@supabase/supabase-js']) {
    console.log('  ✅ Supabase installé');
  } else {
    console.log('  ❌ Supabase manquant');
    hasErrors = true;
  }

  if (packageJson.dependencies && packageJson.dependencies.next) {
    console.log(`  ✅ Next.js ${packageJson.dependencies.next}`);
  } else {
    console.log('  ❌ Next.js manquant');
    hasErrors = true;
  }
} catch (error) {
  console.log('  ❌ Impossible de lire package.json');
  hasErrors = true;
}

// Vérifier .env.local (pour dev local)
console.log('\n🔑 Vérification des variables d\'environnement locales:');
const envExists = fs.existsSync(path.join(__dirname, '.env.local'));
if (envExists) {
  console.log('  ✅ .env.local existe');
  const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      console.log(`  ✅ ${varName} défini`);
    } else {
      console.log(`  ⚠️  ${varName} manquant`);
      hasWarnings = true;
    }
  });
} else {
  console.log('  ⚠️  .env.local n\'existe pas (nécessaire pour dev local)');
  hasWarnings = true;
}

// Vérifier .gitignore
console.log('\n🚫 Vérification de .gitignore:');
if (fs.existsSync(path.join(__dirname, '.gitignore'))) {
  const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
  if (gitignore.includes('.env')) {
    console.log('  ✅ .env est ignoré par git');
  } else {
    console.log('  ❌ .env devrait être dans .gitignore');
    hasErrors = true;
  }
} else {
  console.log('  ⚠️  .gitignore manquant');
  hasWarnings = true;
}

// Vérifier netlify.toml
console.log('\n⚙️  Vérification de netlify.toml:');
if (fs.existsSync(path.join(__dirname, 'netlify.toml'))) {
  const netlifyConfig = fs.readFileSync(path.join(__dirname, 'netlify.toml'), 'utf8');
  
  if (netlifyConfig.includes('npm run build')) {
    console.log('  ✅ Build command configuré');
  } else {
    console.log('  ⚠️  Build command non standard');
    hasWarnings = true;
  }

  if (netlifyConfig.includes('.next')) {
    console.log('  ✅ Publish directory configuré');
  } else {
    console.log('  ⚠️  Publish directory non standard');
    hasWarnings = true;
  }

  if (netlifyConfig.includes('NODE_VERSION')) {
    console.log('  ✅ Version Node.js spécifiée');
  } else {
    console.log('  ⚠️  Version Node.js non spécifiée');
    hasWarnings = true;
  }
}

// Vérifier next.config.ts
console.log('\n⚡ Vérification de next.config.ts:');
if (fs.existsSync(path.join(__dirname, 'next.config.ts'))) {
  const nextConfig = fs.readFileSync(path.join(__dirname, 'next.config.ts'), 'utf8');
  
  if (nextConfig.includes('output')) {
    console.log('  ✅ Mode output configuré');
  } else {
    console.log('  ⚠️  Mode output non configuré (recommandé pour Netlify)');
    hasWarnings = true;
  }
}

// Résumé
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Des erreurs critiques ont été détectées');
  console.log('   Corrigez-les avant de déployer sur Netlify');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Des avertissements ont été détectés');
  console.log('   Le déploiement devrait fonctionner mais vérifiez les points ci-dessus');
  console.log('\n✅ Vous pouvez déployer sur Netlify (avec précautions)');
} else {
  console.log('✅ Tous les contrôles sont passés !');
  console.log('   Votre projet est prêt pour le déploiement sur Netlify');
}

console.log('\n📋 Prochaines étapes:');
console.log('   1. Committez vos changements: git add . && git commit -m "Ready for deployment"');
console.log('   2. Poussez sur GitHub: git push');
console.log('   3. Connectez votre repo sur Netlify: https://app.netlify.com');
console.log('   4. Configurez les variables d\'environnement dans Netlify');
console.log('   5. Déployez !');
console.log('\n📖 Guide complet: Voir DEPLOIEMENT_NETLIFY.md\n');

