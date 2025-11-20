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

    // Si c'est un manager, il ne peut créer que des agents ou des chefs de zone
    if (currentUserProfile.role === 'manager' && role !== 'agent' && role !== 'chef_zone') {
      return NextResponse.json(
        { error: 'Les managers ne peuvent créer que des agents ou des chefs de zone' },
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

    if (!['manager', 'agent', 'chef_zone'].includes(role)) {
      return NextResponse.json(
        { error: 'Rôle invalide. Seuls manager, agent et chef_zone sont autorisés.' },
        { status: 400 }
      )
    }

    // Si c'est un manager créant un agent ou un chef de zone avec agent_id, vérifier que l'agent appartient au manager
    if (currentUserProfile.role === 'manager' && agent_id && (role === 'agent' || role === 'chef_zone')) {
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

    // Vérifier d'abord si l'utilisateur existe déjà dans Auth
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingAuthUser?.users?.find(u => u.email === email)
    
    let userId: string
    let authData: any

    if (userExists) {
      // L'utilisateur existe déjà dans Auth
      console.log('Utilisateur Auth existant trouvé:', userExists.id)
      userId = userExists.id
      
      // Vérifier si le profil existe déjà
      const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, role')
        .eq('id', userId)
        .single()

      if (existingProfile) {
        return NextResponse.json(
          { error: 'Cet utilisateur existe déjà dans le système' },
          { status: 400 }
        )
      }

      // L'utilisateur Auth existe mais pas le profil, on va créer le profil
      authData = { user: userExists }
    } else {
      // Créer l'utilisateur dans Supabase Auth
      console.log('Tentative de création d\'utilisateur Auth:', { email, role })
      const createResult = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirmer l'email
      })

      if (createResult.error) {
        console.error('Erreur lors de la création de l\'utilisateur Auth:', {
          message: createResult.error.message,
          code: createResult.error.code,
          name: createResult.error.name
        })
        
        // Si l'utilisateur existe déjà
        if (createResult.error.message.includes('already registered') || createResult.error.message.includes('User already registered')) {
          return NextResponse.json(
            { error: 'Cet email est déjà utilisé' },
            { status: 400 }
          )
        }
        
        // Si l'erreur est "User not allowed", c'est probablement un problème de permissions avec l'API Auth
        if (createResult.error.message.includes('not allowed') || createResult.error.message.includes('User not allowed')) {
          console.error('Erreur 403 - Vérification de la configuration:', {
            hasServiceRoleKey: !!supabaseServiceRoleKey,
            serviceRoleKeyLength: supabaseServiceRoleKey?.length,
            supabaseUrl: supabaseUrl
          })
          return NextResponse.json(
            { 
              error: 'Permission refusée par l\'API Auth. Vérifiez que la clé service_role est correctement configurée dans .env.local et redémarrez le serveur.',
              details: process.env.NODE_ENV === 'development' ? createResult.error.message : undefined
            },
            { status: 403 }
          )
        }
        
        return NextResponse.json(
          { error: createResult.error.message || 'Erreur lors de la création de l\'utilisateur' },
          { status: 400 }
        )
      }

      if (!createResult.data?.user) {
        return NextResponse.json(
          { error: 'Erreur lors de la création de l\'utilisateur' },
          { status: 500 }
        )
      }

      authData = createResult.data
      userId = authData.user.id
    }

    // Créer ou mettre à jour le profil utilisateur avec UPSERT pour éviter les doublons
    const profileData: any = {
      id: userId,
      email,
      role,
      nom,
      prenom,
    }

    // Pour les agents, agent_id est requis
    // Pour les chefs de zone, agent_id est optionnel (peut être attaché plus tard)
    if ((role === 'agent' || role === 'chef_zone') && agent_id) {
      profileData.agent_id = agent_id
    }

    // Utiliser UPSERT au lieu de INSERT pour gérer les cas où le profil existe déjà
    const { error: upsertProfileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

    if (upsertProfileError) {
      console.error('Erreur lors de la création/mise à jour du profil:', {
        error: upsertProfileError,
        profileData,
        userId
      })
      
      // Si le profil échoue et que l'utilisateur Auth vient d'être créé, le supprimer
      if (!userExists) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch (deleteError) {
          console.error('Erreur lors de la suppression de l\'utilisateur Auth après échec du profil:', deleteError)
        }
      }
      
      // Vérifier si c'est une erreur de clé dupliquée
      if (upsertProfileError.code === '23505' || upsertProfileError.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Cet utilisateur existe déjà dans le système. Veuillez utiliser un autre email.' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: `Erreur lors de la création du profil: ${upsertProfileError.message}` },
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

