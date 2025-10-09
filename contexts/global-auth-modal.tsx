"use client"

import { createContext, useContext, useState, ReactNode } from 'react'
import { AuthModal } from '@/components/auth-modal'

interface GlobalAuthModalContextType {
  openAuthModal: (tab?: 'login' | 'register', redirectUrl?: string) => void
  closeAuthModal: () => void
  isOpen: boolean
}

const GlobalAuthModalContext = createContext<GlobalAuthModalContextType | undefined>(undefined)

export function GlobalAuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultTab, setDefaultTab] = useState<'login' | 'register'>('login')
  const [redirectUrl, setRedirectUrl] = useState<string | undefined>(undefined)

  const openAuthModal = (tab: 'login' | 'register' = 'login', redirectUrl?: string) => {
    setDefaultTab(tab)
    setRedirectUrl(redirectUrl)
    setIsOpen(true)
  }

  const closeAuthModal = () => {
    setIsOpen(false)
    setRedirectUrl(undefined)
  }

  return (
    <GlobalAuthModalContext.Provider value={{ openAuthModal, closeAuthModal, isOpen }}>
      {children}
      <AuthModal 
        isOpen={isOpen} 
        onClose={closeAuthModal} 
        defaultTab={defaultTab}
        redirectUrl={redirectUrl}
      />
    </GlobalAuthModalContext.Provider>
  )
}

export function useGlobalAuthModal() {
  const context = useContext(GlobalAuthModalContext)
  if (context === undefined) {
    throw new Error('useGlobalAuthModal must be used within a GlobalAuthModalProvider')
  }
  return context
}

