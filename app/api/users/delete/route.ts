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

