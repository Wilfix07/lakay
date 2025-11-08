import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Vérifier que les variables d'environnement sont disponibles
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Variables d\'environnement manquantes:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceRoleKey
      })
      return NextResponse.json(
        { 
          error: 'Configuration serveur manquante. SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL sont requises dans .env.local' 
        },
        { status: 500 }
      )
    }

    // Client avec service_role (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Corps de la requête invalide' },
        { status: 400 }
      )
    }

    const { email, password, role, nom, prenom, agent_id } = body

    // Validation
    if (!email || !password || !role || !nom || !prenom) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      )
    }

    if (role === 'agent' && !agent_id) {
      return NextResponse.json(
        { error: 'agent_id requis pour les agents' },
        { status: 400 }
      )
    }

    if (!['manager', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'Rôle invalide. Seuls manager et agent sont autorisés.' },
        { status: 400 }
      )
    }

    // Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmer l'email
    })

    if (authError) {
      // Si l'utilisateur existe déjà
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'utilisateur' },
        { status: 500 }
      )
    }

    // Créer le profil utilisateur
    const profileData: any = {
      id: authData.user.id,
      email,
      role,
      nom,
      prenom,
    }

    if (role === 'agent' && agent_id) {
      profileData.agent_id = agent_id
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileData)

    if (profileError) {
      // Si le profil échoue, supprimer l'utilisateur Auth créé
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Erreur lors de la création du profil: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        role,
        nom,
        prenom,
        agent_id: role === 'agent' ? agent_id : null,
      }
    })

  } catch (error: any) {
    console.error('Erreur lors de la création de l\'utilisateur:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

