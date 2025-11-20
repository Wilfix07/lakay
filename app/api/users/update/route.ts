import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PUT(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            'Configuration serveur manquante. SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL sont requises dans .env.local',
        },
        { status: 500 },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Vérifier l'authentification de l'utilisateur
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Utiliser la service_role key pour vérifier le token (plus sécurisé)
    // On peut aussi utiliser la clé anon, mais service_role fonctionne aussi
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer le profil de l'utilisateur authentifié
    const { data: currentUserProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentUserProfile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const {
      id,
      email,
      password,
      role,
      nom,
      prenom,
      agent_id,
    }: {
      id?: string
      email?: string
      password?: string
      role?: string
      nom?: string
      prenom?: string
      agent_id?: string | null
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Identifiant utilisateur requis' }, { status: 400 })
    }

    // Vérifier les permissions : seul admin peut modifier tous les utilisateurs
    // Les managers peuvent modifier uniquement leurs agents
    if (currentUserProfile.role !== 'admin') {
      if (currentUserProfile.role === 'manager') {
        // Vérifier que l'utilisateur à modifier est un agent qui appartient au manager
        const { data: targetUserProfile, error: targetError } = await supabaseAdmin
          .from('user_profiles')
          .select('role, agent_id')
          .eq('id', id)
          .single()

        if (targetError || !targetUserProfile) {
          return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
        }

        // Un manager ne peut modifier que les agents et les chefs de zone attachés à ses agents
        if (targetUserProfile.role !== 'agent' && targetUserProfile.role !== 'chef_zone') {
          return NextResponse.json(
            { error: 'Vous n\'êtes pas autorisé à modifier cet utilisateur' },
            { status: 403 },
          )
        }

        // Pour les agents, vérifier qu'ils appartiennent au manager
        if (targetUserProfile.role === 'agent') {
          // Vérifier que l'agent appartient au manager
          if (targetUserProfile.agent_id) {
            const { data: agent, error: agentError } = await supabaseAdmin
              .from('agents')
              .select('manager_id')
              .eq('agent_id', targetUserProfile.agent_id)
              .single()

            if (agentError || !agent) {
              return NextResponse.json(
                { error: 'Agent non trouvé' },
                { status: 404 },
              )
            }

            if (agent.manager_id !== currentUserProfile.id) {
              return NextResponse.json(
                { error: 'Vous n\'êtes pas autorisé à modifier cet agent' },
                { status: 403 },
              )
            }

            // Si le manager change l'agent_id, vérifier que le nouvel agent appartient aussi au manager
            if (agent_id !== undefined && agent_id !== null && agent_id !== targetUserProfile.agent_id) {
              const { data: newAgent, error: newAgentError } = await supabaseAdmin
                .from('agents')
                .select('manager_id')
                .eq('agent_id', agent_id)
                .single()

              if (newAgentError || !newAgent) {
                return NextResponse.json(
                  { error: 'Nouvel agent non trouvé' },
                  { status: 404 },
                )
              }

              if (newAgent.manager_id !== currentUserProfile.id) {
                return NextResponse.json(
                  { error: 'Le nouvel agent ne vous appartient pas' },
                  { status: 403 },
                )
              }
            }
          } else {
            return NextResponse.json(
              { error: 'Agent invalide' },
              { status: 400 },
            )
          }
        }

        // Pour les chefs de zone, vérifier qu'ils sont attachés à un agent du manager
        if (targetUserProfile.role === 'chef_zone') {
          // Si le chef de zone a un agent_id, vérifier qu'il appartient au manager
          if (targetUserProfile.agent_id) {
            const { data: agent, error: agentError } = await supabaseAdmin
              .from('agents')
              .select('manager_id')
              .eq('agent_id', targetUserProfile.agent_id)
              .single()

            if (agentError || !agent) {
              return NextResponse.json(
                { error: 'Agent non trouvé' },
                { status: 404 },
              )
            }

            if (agent.manager_id !== currentUserProfile.id) {
              return NextResponse.json(
                { error: 'Vous n\'êtes pas autorisé à modifier ce chef de zone' },
                { status: 403 },
              )
            }

            // Si le manager change l'agent_id, vérifier que le nouvel agent appartient aussi au manager
            if (agent_id !== undefined && agent_id !== null && agent_id !== targetUserProfile.agent_id) {
              const { data: newAgent, error: newAgentError } = await supabaseAdmin
                .from('agents')
                .select('manager_id')
                .eq('agent_id', agent_id)
                .single()

              if (newAgentError || !newAgent) {
                return NextResponse.json(
                  { error: 'Nouvel agent non trouvé' },
                  { status: 404 },
                )
              }

              if (newAgent.manager_id !== currentUserProfile.id) {
                return NextResponse.json(
                  { error: 'Le nouvel agent ne vous appartient pas' },
                  { status: 403 },
                )
              }
            }
          }
          // Si le chef de zone n'a pas d'agent_id, le manager peut quand même le modifier (pour l'attacher à un agent)
        }
      } else {
        return NextResponse.json(
          { error: 'Vous n\'êtes pas autorisé à modifier des utilisateurs' },
          { status: 403 },
        )
      }
    }

    const profileUpdates: Record<string, any> = {}

    if (email !== undefined) {
      profileUpdates.email = email
    }
    if (nom !== undefined) {
      profileUpdates.nom = nom
    }
    if (prenom !== undefined) {
      profileUpdates.prenom = prenom
    }

    if (role !== undefined) {
      if (!['manager', 'agent', 'chef_zone'].includes(role)) {
        return NextResponse.json(
          { error: 'Rôle invalide. Seuls manager, agent et chef_zone sont autorisés.' },
          { status: 400 },
        )
      }
      profileUpdates.role = role

      if (role === 'agent') {
        if (!agent_id) {
          return NextResponse.json(
            { error: 'agent_id requis pour attribuer le rôle agent' },
            { status: 400 },
          )
        }
        profileUpdates.agent_id = agent_id
      } else if (role === 'chef_zone') {
        // Pour chef_zone, agent_id est optionnel
        profileUpdates.agent_id = agent_id || null
      } else {
        profileUpdates.agent_id = null
      }
    } else if (agent_id !== undefined) {
      profileUpdates.agent_id = agent_id || null
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', id)

      if (profileError) {
        return NextResponse.json(
          { error: `Erreur lors de la mise à jour du profil: ${profileError.message}` },
          { status: 500 },
        )
      }
    }

    // Mettre à jour l'email ou le mot de passe dans Supabase Auth si nécessaire
    if (email !== undefined || password !== undefined) {
      const authUpdate: { email?: string; password?: string; email_confirm?: boolean } = {}
      
      if (email !== undefined) {
        authUpdate.email = email
        authUpdate.email_confirm = true
      }
      
      // Ne mettre à jour le mot de passe que s'il est défini et non vide
      if (password !== undefined && typeof password === 'string' && password.trim() !== '') {
        authUpdate.password = password
      }

      // Ne faire la mise à jour que si on a quelque chose à mettre à jour
      if (Object.keys(authUpdate).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate)

        if (authError) {
          return NextResponse.json(
            { error: `Erreur lors de la mise à jour de l'utilisateur Auth: ${authError.message}` },
            { status: 500 },
          )
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour utilisateur:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 },
    )
  }
}

