/**
 * Script pour créer un utilisateur admin
 * 
 * IMPORTANT: Ce script nécessite la clé service_role de Supabase
 * Ne l'exécutez JAMAIS côté client, seulement côté serveur ou en local
 * 
 * Usage:
 * 1. Créez un fichier .env.local avec:
 *    SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
 * 
 * 2. Exécutez: node scripts/setup-admin.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes!')
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis')
  process.exit(1)
}

// Client avec service_role (bypass RLS)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  const adminEmail = 'admin@lakay.com'
  const adminPassword = 'Admin123!'

  try {
    console.log('🔐 Création de l\'utilisateur admin...')
    
    // Créer l'utilisateur dans Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Auto-confirmer l'email
    })

    if (authError) {
      // Si l'utilisateur existe déjà, récupérer son ID
      if (authError.message.includes('already registered')) {
        console.log('⚠️  L\'utilisateur existe déjà dans Auth, récupération de l\'ID...')
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
        const user = existingUser.users.find(u => u.email === adminEmail)
        
        if (user) {
          await createUserProfile(user.id, adminEmail)
          return
        }
      }
      throw authError
    }

    if (!authData.user) {
      throw new Error('Utilisateur non créé')
    }

    console.log('✅ Utilisateur créé dans Auth:', authData.user.id)

    // Créer le profil utilisateur
    await createUserProfile(authData.user.id, adminEmail)

    console.log('\n✅ Utilisateur admin créé avec succès!')
    console.log('\n📋 Informations de connexion:')
    console.log('   Email:', adminEmail)
    console.log('   Password:', adminPassword)
    console.log('\n🔗 Connectez-vous sur: http://localhost:3000/login')

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

async function createUserProfile(userId, email) {
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .upsert({
      id: userId,
      email: email,
      role: 'admin',
      nom: 'Administrateur',
      prenom: 'Système',
    }, {
      onConflict: 'id'
    })

  if (error) {
    throw error
  }

  console.log('✅ Profil utilisateur créé dans user_profiles')
}

createAdminUser()

