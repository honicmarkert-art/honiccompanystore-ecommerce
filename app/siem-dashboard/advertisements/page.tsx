"use client"


// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Trash2, Plus, Upload, Image as ImageIcon, Video } from "lucide-react"
import Image from "next/image"

interface Advertisement {
  id: number
  title: string
  description?: string
  media_url: string
  media_type: 'image' | 'video'
  link_url?: string
  is_active: boolean
  display_order: number
  placement: string
  created_at: string
}

export default function AdvertisementsPage() {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [editingAdId, setEditingAdId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    link_url: "",
    display_order: 1,
    placement: "products",
  })
  const [rotationTime, setRotationTime] = useState(10)
  const { toast } = useToast()

  // Fetch advertisements
  useEffect(() => {
    fetchAdvertisements()
    fetchRotationTime()
  }, [])

  const fetchAdvertisements = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/advertisements')
      if (response.ok) {
        const data = await response.json()
        setAdvertisements(data.advertisements || [])
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load advertisements",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRotationTime = async () => {
    try {
      const response = await fetch('/api/admin/settings/ad-rotation')
      if (response.ok) {
        const data = await response.json()
        setRotationTime(data.rotationTime || 10)
      }
    } catch (error) {
    }
  }

  const saveRotationTime = async () => {
    try {
      const response = await fetch('/api/admin/settings/ad-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotationTime })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Rotation time updated to ${rotationTime} seconds`
        })
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save rotation time",
        variant: "destructive"
      })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    
    if (![...validImageTypes, ...validVideoTypes].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM, MOV)",
        variant: "destructive"
      })
      return
    }

    // Validate video duration (max 30 seconds)
    if (validVideoTypes.includes(file.type)) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        if (video.duration > 30) {
          toast({
            title: "Video too long",
            description: "Videos must be 30 seconds or less",
            variant: "destructive"
          })
          return
        }
      }
      video.src = URL.createObjectURL(file)
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 50MB",
        variant: "destructive"
      })
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleEdit = (ad: Advertisement) => {
    setEditingAdId(ad.id)
    setFormData({
      title: ad.title,
      description: ad.description || "",
      link_url: ad.link_url || "",
      display_order: ad.display_order,
      placement: ad.placement || "products"
    })
    setPreviewUrl(ad.media_url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingAdId(null)
    setSelectedFile(null)
    setPreviewUrl(null)
    setFormData({
      title: "",
      description: "",
      link_url: "",
      display_order: 1,
      placement: "products"
    })
  }

  const handleUpdate = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the advertisement",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)
    try {
      const updateData: any = {
        id: editingAdId,
        title: formData.title,
        description: formData.description,
        link_url: formData.link_url,
        display_order: formData.display_order,
        placement: formData.placement
      }

      const response = await fetch('/api/admin/advertisements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Advertisement updated successfully"
        })
        handleCancelEdit()
        fetchAdvertisements()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Update failed')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update advertisement",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile && !editingAdId) {
      toast({
        title: "No file selected",
        description: "Please select an image or video to upload",
        variant: "destructive"
      })
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the advertisement",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)
    try {
      const formDataToSend = new FormData()
      if (selectedFile) {
        formDataToSend.append('file', selectedFile)
      }
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('link_url', formData.link_url)
      formDataToSend.append('display_order', formData.display_order.toString())
      formDataToSend.append('placement', formData.placement)

      const response = await fetch('/api/admin/advertisements', {
        method: 'POST',
        body: formDataToSend
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Advertisement uploaded successfully"
        })
        
        // Reset form
        handleCancelEdit()
        
        // Refresh list
        fetchAdvertisements()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload advertisement",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this advertisement?')) return

    try {
      const response = await fetch(`/api/admin/advertisements?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Advertisement deleted successfully"
        })
        fetchAdvertisements()
      } else {
        throw new Error('Delete failed')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete advertisement",
        variant: "destructive"
      })
    }
  }

  const toggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/advertisements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Advertisement ${!currentStatus ? 'activated' : 'deactivated'}`
        })
        fetchAdvertisements()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update advertisement",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Advertisement Management</h1>

      {/* Rotation Time Setting */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Advertisement Rotation Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="rotation-time">Rotation Time (seconds)</Label>
            <Input
              id="rotation-time"
              type="number"
              value={rotationTime}
              onChange={(e) => setRotationTime(parseInt(e.target.value) || 10)}
              className="mt-2"
              min="3"
              max="60"
              placeholder="10"
            />
            <p className="text-xs text-gray-500 mt-1">
              How long each ad displays before switching to the next (3-60 seconds)
            </p>
          </div>
          <Button onClick={saveRotationTime}>
            Save Rotation Time
          </Button>
        </CardContent>
      </Card>

      {/* Upload Form - Compact Layout */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>
            {editingAdId ? 'Edit Advertisement' : 'Upload New Advertisement'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="file">Media File (Image or Video up to 30s)</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Advertisement title"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="link_url">Link URL</Label>
                  <Input
                    id="link_url"
                    value={formData.link_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 1 }))}
                    className="mt-1"
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="placement">Placement</Label>
                  <select
                    id="placement"
                    value={formData.placement}
                    onChange={(e) => setFormData(prev => ({ ...prev, placement: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="products">Products Page</option>
                    <option value="features">Features Section (Landing Page)</option>
                    <option value="hero">Hero Section</option>
                    <option value="sidebar">Sidebar</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={editingAdId ? handleUpdate : handleUpload} 
                  disabled={isUploading || (!selectedFile && !editingAdId)}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? (editingAdId ? 'Updating...' : 'Uploading...') : (editingAdId ? 'Update Advertisement' : 'Upload Advertisement')}
                </Button>
                {editingAdId && (
                  <Button 
                    onClick={handleCancelEdit} 
                    variant="outline"
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Right Column - Preview */}
            <div>
              <Label>Preview</Label>
              {previewUrl ? (
                <div className="mt-1 border rounded-lg p-4 bg-gray-50">
                  {selectedFile?.type.startsWith('image/') ? (
                    <Image 
                      src={previewUrl} 
                      alt="Preview" 
                      width={400}
                      height={200}
                      className="rounded-lg object-cover w-full"
                    />
                  ) : (
                    <video 
                      src={previewUrl} 
                      controls 
                      className="w-full rounded-lg"
                    />
                  )}
                </div>
              ) : (
                <div className="mt-1 border-2 border-dashed rounded-lg p-8 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <p className="text-sm">No file selected</p>
                  <p className="text-xs mt-1">Preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advertisements List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Advertisements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-gray-500">Loading...</p>
          ) : advertisements.length === 0 ? (
            <p className="text-center text-gray-500">No advertisements yet</p>
          ) : (
            <div className="space-y-4">
              {advertisements.map((ad) => (
                <div key={ad.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {ad.media_type === 'image' ? (
                      <Image 
                        src={ad.media_url} 
                        alt={ad.title}
                        width={150}
                        height={100}
                        className="rounded object-cover"
                      />
                    ) : (
                      <video 
                        src={ad.media_url} 
                        className="w-40 rounded"
                        controls
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{ad.title}</h3>
                    {ad.description && (
                      <p className="text-sm text-gray-600 mt-1">{ad.description}</p>
                    )}
                    {ad.link_url && (
                      <a 
                        href={ad.link_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-1 block"
                      >
                        {ad.link_url}
                      </a>
                    )}
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs text-gray-500">Order: {ad.display_order}</span>
                      <span className={`text-xs px-2 py-1 rounded ${ad.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {ad.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(ad)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={ad.is_active ? 'outline' : 'default'}
                      onClick={() => toggleActive(ad.id, ad.is_active)}
                    >
                      {ad.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(ad.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

