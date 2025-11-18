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

    // Vérifier l'authentification de l'utilisateur qui fait la requête
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer le profil de l'utilisateur authentifié
    const { data: currentUserProfile, error: currentProfileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, id')
      .eq('id', user.id)
      .single()

    if (currentProfileError || !currentUserProfile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 403 })
    }

    // Vérifier les permissions
    if (currentUserProfile.role !== 'admin' && currentUserProfile.role !== 'manager') {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas autorisé à créer des utilisateurs' },
        { status: 403 }
      )
    }

    // Si c'est un manager, il ne peut créer que des agents
    if (currentUserProfile.role === 'manager' && role !== 'agent') {
      return NextResponse.json(
        { error: 'Les managers ne peuvent créer que des agents' },
        { status: 403 }
      )
    }

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

    // Si c'est un manager créant un agent, vérifier que l'agent appartient au manager
    if (currentUserProfile.role === 'manager' && role === 'agent' && agent_id) {
      const { data: agent, error: agentError } = await supabaseAdmin
        .from('agents')
        .select('agent_id, manager_id')
        .eq('agent_id', agent_id)
        .single()

      if (agentError || !agent) {
        console.error('Erreur lors de la recherche de l\'agent:', agentError)
        return NextResponse.json(
          { error: `Agent non trouvé: ${agentError?.message || 'Agent introuvable'}` },
          { status: 404 }
        )
      }

      // Vérifier que l'agent appartient au manager
      // Note: manager_id est de type text, donc on compare avec currentUserProfile.id converti en string
      const managerIdStr = String(currentUserProfile.id)
      if (agent.manager_id !== managerIdStr) {
        console.error('Manager ID mismatch:', {
          agentManagerId: agent.manager_id,
          currentUserId: currentUserProfile.id,
          managerIdStr: managerIdStr,
          types: {
            agentManagerIdType: typeof agent.manager_id,
            currentUserIdType: typeof currentUserProfile.id
          }
        })
        return NextResponse.json(
          { error: 'Vous n\'êtes pas autorisé à créer un utilisateur pour cet agent' },
          { status: 403 }
        )
      }
    }

    // Créer l'utilisateur dans Supabase Auth
    console.log('Tentative de création d\'utilisateur Auth:', { email, role })
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmer l'email
    })

    if (createUserError) {
      console.error('Erreur lors de la création de l\'utilisateur Auth:', {
        message: createUserError.message,
        status: createUserError.status,
        code: createUserError.code,
        name: createUserError.name
      })
      
      // Si l'utilisateur existe déjà
      if (createUserError.message.includes('already registered') || createUserError.message.includes('User already registered')) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé' },
          { status: 400 }
        )
      }
      
      // Si l'erreur est "User not allowed", c'est probablement un problème de permissions avec l'API Auth
      if (createUserError.message.includes('not allowed') || createUserError.message.includes('User not allowed') || createUserError.status === 403) {
        console.error('Erreur 403 - Vérification de la configuration:', {
          hasServiceRoleKey: !!supabaseServiceRoleKey,
          serviceRoleKeyLength: supabaseServiceRoleKey?.length,
          supabaseUrl: supabaseUrl
        })
        return NextResponse.json(
          { 
            error: 'Permission refusée par l\'API Auth. Vérifiez que la clé service_role est correctement configurée dans .env.local et redémarrez le serveur.',
            details: process.env.NODE_ENV === 'development' ? createUserError.message : undefined
          },
          { status: 403 }
        )
      }
      
      return NextResponse.json(
        { error: createUserError.message || 'Erreur lors de la création de l\'utilisateur' },
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

    const { error: insertProfileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileData)

    if (insertProfileError) {
      // Si le profil échoue, supprimer l'utilisateur Auth créé
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Erreur lors de la création du profil: ${insertProfileError.message}` },
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
    console.error('Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur', details: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    )
  }
}

