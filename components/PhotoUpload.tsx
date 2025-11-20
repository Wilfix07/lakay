'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, Upload, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PhotoUploadProps {
  currentPhotoUrl?: string | null
  onPhotoChange: (photoUrl: string | null) => void
  memberId?: string
}

export function PhotoUpload({ currentPhotoUrl, onPhotoChange, memberId }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment') // Caméra arrière par défaut pour photos de membres

  // Nettoyer le stream lors du démontage du composant
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [stream])

  const startCamera = async () => {
    try {
      setError(null)
      
      // Détecter si on est sur mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      
      // Sur mobile, utiliser la caméra arrière par défaut pour prendre des photos de membres
      // Sur desktop, essayer d'abord la caméra arrière, sinon utiliser la caméra avant
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      // Essayer d'accéder à la caméra
      let mediaStream: MediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err: any) {
        // Si la caméra arrière n'est pas disponible, essayer la caméra avant
        if (facingMode === 'environment') {
          console.warn('Caméra arrière non disponible, utilisation de la caméra avant')
          const fallbackConstraints: MediaStreamConstraints = {
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }
          mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints)
          setFacingMode('user')
        } else {
          throw err
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
      setStream(mediaStream)
      setCameraActive(true)
    } catch (err: any) {
      console.error('Erreur d\'accès à la caméra:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permission d\'accès à la caméra refusée. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Aucune caméra trouvée sur cet appareil.')
      } else {
        setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.')
      }
    }
  }

  const switchCamera = async () => {
    if (!stream) return
    
    // Arrêter le stream actuel
    stopCamera()
    
    // Basculer entre caméra avant et arrière
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacingMode)
    
    // Redémarrer avec la nouvelle caméra
    setTimeout(() => {
      startCamera()
    }, 100)
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)
    canvas.toBlob(async (blob) => {
      if (blob) {
        await handleFileUpload(blob)
        stopCamera()
      }
    }, 'image/jpeg', 0.9)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner une image valide')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('L\'image ne doit pas dépasser 5 MB')
        return
      }
      handleFileUpload(file)
    }
  }

  const handleFileUpload = async (file: Blob) => {
    try {
      setUploading(true)
      setError(null)

      // Générer un nom de fichier unique
      const fileExt = file instanceof File ? file.name.split('.').pop() : 'jpg'
      const fileName = `${memberId || Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `members/${fileName}`

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        // Si le bucket n'existe pas, on stocke localement en base64
        console.warn('Storage upload failed, using base64:', uploadError)
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result as string
          setPreview(base64String)
          onPhotoChange(base64String)
        }
        reader.readAsDataURL(file)
        setUploading(false)
        return
      }

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('member-photos')
        .getPublicUrl(filePath)

      const photoUrl = urlData.publicUrl
      setPreview(photoUrl)
      onPhotoChange(photoUrl)
    } catch (err) {
      console.error('Erreur lors de l\'upload:', err)
      setError('Erreur lors de l\'upload de la photo')
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async () => {
    if (currentPhotoUrl && currentPhotoUrl.startsWith('http')) {
      try {
        // Extraire le chemin du fichier depuis l'URL
        const urlParts = currentPhotoUrl.split('/member-photos/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1].split('?')[0]
          await supabase.storage.from('member-photos').remove([`members/${filePath}`])
        }
      } catch (err) {
        console.error('Erreur lors de la suppression:', err)
      }
    }
    setPreview(null)
    onPhotoChange(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        {/* Prévisualisation de la photo */}
        <div className="relative">
          {preview ? (
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20">
              <img
                src={preview}
                alt="Photo du membre"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                disabled={uploading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
              <User className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Vidéo de la caméra */}
        {cameraActive && (
          <div className="relative w-full max-w-md mx-auto">
            <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} // Miroir pour caméra avant
              />
              {/* Indicateur de caméra active */}
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {facingMode === 'environment' ? '📷 Arrière' : '📱 Avant'}
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex gap-2 justify-center">
                <Button 
                  type="button" 
                  onClick={capturePhoto} 
                  disabled={uploading}
                  size="lg"
                  className="flex-1 max-w-xs"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capturer
                </Button>
              </div>
              <div className="flex gap-2 justify-center">
                {/* Bouton pour basculer entre caméras (seulement sur mobile) */}
                {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={switchCamera}
                    disabled={uploading}
                    size="sm"
                  >
                    {facingMode === 'environment' ? '📱 Avant' : '📷 Arrière'}
                  </Button>
                )}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={stopCamera}
                  disabled={uploading}
                  size="sm"
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        {!cameraActive && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCamera}
              disabled={uploading}
            >
              <Camera className="w-4 h-4 mr-2" />
              Prendre une photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Télécharger
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading && (
          <p className="text-sm text-muted-foreground">Upload en cours...</p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}

