"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComingSoonModalProps {
  isOpen: boolean
  onClose: () => void
  feature: string
  description?: string
  companyName?: string
}

export function ComingSoonModal({ 
  isOpen, 
  onClose, 
  feature, 
  description,
  companyName = "Our Platform"
}: ComingSoonModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Coming Soon!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Feature in Development</span>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {description || `${feature} will be available in the next update.`}
            </p>
            <p className="text-xs text-muted-foreground">
              We're working hard to bring you the best experience on {companyName}!
            </p>
          </div>
          
          <div className="pt-4">
            <Button 
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easy use throughout the app
export function useComingSoonModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [modalConfig, setModalConfig] = useState({
    feature: '',
    description: '',
    companyName: 'Our Platform'
  })

  const showComingSoon = (feature: string, description?: string, companyName?: string) => {
    setModalConfig({ 
      feature, 
      description: description || `${feature} will be available in the next update.`,
      companyName: companyName || 'Our Platform'
    })
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
  }

  const ComingSoonModalComponent = () => (
    <ComingSoonModal
      isOpen={isOpen}
      onClose={closeModal}
      feature={modalConfig.feature}
      description={modalConfig.description}
      companyName={modalConfig.companyName}
    />
  )

  return {
    showComingSoon,
    closeModal,
    ComingSoonModal: ComingSoonModalComponent
  }
}
















