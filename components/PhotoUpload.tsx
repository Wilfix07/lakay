'use client'

import { useState, useRef } from 'react'
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

  const startCamera = async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
      setStream(mediaStream)
      setCameraActive(true)
    } catch (err) {
      console.error('Erreur d\'accès à la caméra:', err)
      setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
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
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full max-w-md rounded-lg border-2 border-primary"
              autoPlay
              playsInline
              muted
            />
            <div className="flex gap-2 mt-2">
              <Button type="button" onClick={capturePhoto} disabled={uploading}>
                <Camera className="w-4 h-4 mr-2" />
                Capturer
              </Button>
              <Button type="button" variant="outline" onClick={stopCamera}>
                Annuler
              </Button>
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

