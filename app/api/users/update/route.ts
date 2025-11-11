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
      if (!['manager', 'agent'].includes(role)) {
        return NextResponse.json(
          { error: 'Rôle invalide. Seuls manager et agent sont autorisés.' },
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

    if (email !== undefined || password !== undefined) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email,
        password,
        email_confirm: email !== undefined ? true : undefined,
      })

      if (authError) {
        return NextResponse.json(
          { error: `Erreur lors de la mise à jour de l'utilisateur Auth: ${authError.message}` },
          { status: 500 },
        )
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

