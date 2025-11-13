import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
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

    const { id }: { id?: string } = body

    if (!id) {
      return NextResponse.json({ error: 'Identifiant utilisateur requis' }, { status: 400 })
    }

    // Vérifier les permissions : seul admin peut supprimer tous les utilisateurs
    // Les managers peuvent supprimer uniquement leurs agents
    if (currentUserProfile.role !== 'admin') {
      if (currentUserProfile.role === 'manager') {
        // Vérifier que l'utilisateur à supprimer est un agent qui appartient au manager
        const { data: targetUserProfile, error: targetError } = await supabaseAdmin
          .from('user_profiles')
          .select('role, agent_id')
          .eq('id', id)
          .single()

        if (targetError || !targetUserProfile) {
          return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
        }

        // Un manager ne peut supprimer que les agents
        if (targetUserProfile.role !== 'agent') {
          return NextResponse.json(
            { error: 'Vous n\'êtes pas autorisé à supprimer cet utilisateur' },
            { status: 403 },
          )
        }

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
              { error: 'Vous n\'êtes pas autorisé à supprimer cet agent' },
              { status: 403 },
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Agent invalide' },
            { status: 400 },
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Vous n\'êtes pas autorisé à supprimer des utilisateurs' },
          { status: 403 },
        )
      }
    }

    // Supprimer le profil (ignore erreurs si aucune ligne)
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', id)

    if (profileError) {
      return NextResponse.json(
        { error: `Erreur lors de la suppression du profil: ${profileError.message}` },
        { status: 500 },
      )
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      return NextResponse.json(
        { error: `Erreur lors de la suppression Auth: ${authError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur lors de la suppression utilisateur:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 },
    )
  }
}

