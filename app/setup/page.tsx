'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [adminEmail] = useState('admin@lakay.com')
  const [adminPassword] = useState('Admin123!')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    checkExistingAdmin()
  }, [])

  async function checkExistingAdmin() {
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('role', 'admin')
      .limit(1)

    if (admins && admins.length > 0) {
      router.push('/login')
    }
  }

  async function checkUserExists() {
    if (!userId.trim()) {
      setError('Veuillez entrer l\'UUID de l\'utilisateur')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Vérifier si l'utilisateur existe dans Auth (via le profil)
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (existingProfile) {
        setError('Cet utilisateur a déjà un profil. Essayez de vous connecter.')
        setLoading(false)
        return
      }

      // Créer le profil
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: adminEmail,
          role: 'admin',
          nom: 'Administrateur',
          prenom: 'Système',
        })

      if (insertError) {
        // Si l'erreur est due à une contrainte de clé étrangère, l'utilisateur n'existe pas dans Auth
        if (insertError.code === '23503') {
          setError('❌ L\'UUID fourni ne correspond à aucun utilisateur dans Supabase Auth. Assurez-vous d\'avoir créé l\'utilisateur dans Authentication > Users d\'abord.')
        } else {
          setError('Erreur: ' + insertError.message)
        }
      } else {
        setSuccess(true)
        setError('')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err: any) {
      setError('Erreur: ' + (err.message || 'Une erreur est survenue'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configuration Initiale
          </h1>
          <p className="text-gray-600">Créer le compte administrateur</p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-6">
            ✅ Profil admin créé avec succès ! Redirection vers la page de connexion...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-6">
          <p className="font-semibold mb-2">📋 Instructions :</p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Allez sur le dashboard Supabase (lien ci-dessous)</li>
            <li>Cliquez sur <strong>"Add User"</strong> &gt; <strong>"Create new user"</strong></li>
            <li>Email : <code className="bg-white px-2 py-1 rounded">{adminEmail}</code></li>
            <li>Password : <code className="bg-white px-2 py-1 rounded">{adminPassword}</code></li>
            <li>✅ Cochez <strong>"Auto Confirm User"</strong></li>
            <li>Cliquez sur <strong>"Create User"</strong></li>
            <li>Copiez l'<strong>UUID</strong> de l'utilisateur créé</li>
            <li>Collez l'UUID ci-dessous et cliquez sur "Créer le profil"</li>
          </ol>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3">Créer le profil admin</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                UUID de l'utilisateur (depuis Supabase Auth)
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
            <button
              onClick={checkUserExists}
              disabled={loading || !userId.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Création...' : 'Créer le profil admin'}
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Requête SQL à exécuter :</h3>
          <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm">
{`-- Remplacez VOTRE_UUID par l'UUID copié depuis Auth > Users
INSERT INTO user_profiles (id, email, role, nom, prenom)
VALUES (
  'VOTRE_UUID',  -- UUID de l'utilisateur créé dans Auth
  '${adminEmail}',
  'admin',
  'Administrateur',
  'Système'
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin';`}
          </pre>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Informations de connexion :</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Email :</strong> <code className="bg-white px-2 py-1 rounded">{adminEmail}</code></p>
            <p><strong>Password :</strong> <code className="bg-white px-2 py-1 rounded">{adminPassword}</code></p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.push('/login')}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Aller à la connexion
          </button>
          <a
            href="https://supabase.com/dashboard/project/nrufoxocjciiadhndfwo/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
          >
            Ouvrir Supabase Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

