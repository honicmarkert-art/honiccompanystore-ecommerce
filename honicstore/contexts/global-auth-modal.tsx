"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { AuthModal } from '@/components/auth-modal'
import { useAuth } from '@/contexts/auth-context'

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
  const { isAuthenticated, user } = useAuth()

  // Restore persisted state to avoid disappearing on re-renders/refreshes
  // But only if user is not authenticated and not on callback page (unless supplier flow)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Don't open modal if we're on the auth callback page
    if (window.location.pathname === '/auth/callback') {
      setIsOpen(false)
      try {
        sessionStorage.removeItem('auth-modal-open')
        sessionStorage.removeItem('auth-modal-tab')
      } catch {}
      return
    }
    
    // Check if this is a supplier flow
    const isSupplierFlow = redirectUrl?.startsWith('/supplier') || 
                           (typeof window !== 'undefined' && sessionStorage.getItem('supplier_registration') === 'true')
    
    // For supplier flows, allow modal to open even if authenticated (to switch accounts)
    if (isAuthenticated && user && !isSupplierFlow) {
      // Clear persisted state if user is authenticated (and not supplier flow)
      try {
        sessionStorage.removeItem('auth-modal-open')
        sessionStorage.removeItem('auth-modal-tab')
      } catch {}
      return
    }
    
    try {
      const persisted = sessionStorage.getItem('auth-modal-open')
      const tab = sessionStorage.getItem('auth-modal-tab') as 'login' | 'register' | null
      if (persisted === 'true') {
        setIsOpen(true)
        // Only restore tab if it's valid, otherwise default to login
        if (tab === 'login' || tab === 'register') {
          setDefaultTab(tab)
        } else {
          setDefaultTab('login') // Default to login if invalid tab
        }
      }
    } catch {}
  }, [isAuthenticated, user, redirectUrl])

  const openAuthModal = (tab: 'login' | 'register' = 'login', redirectUrl?: string) => {
    // Allow opening modal for supplier flows even if already authenticated
    // This allows users to switch accounts or log in with a different supplier account
    const isSupplierFlow = redirectUrl?.startsWith('/supplier') || 
                           (typeof window !== 'undefined' && sessionStorage.getItem('supplier_registration') === 'true')
    
    // Don't open modal if user is already authenticated (unless it's a supplier flow)
    if (isAuthenticated && user && !isSupplierFlow) {
      console.log('User is already authenticated, skipping auth modal')
      return
    }
    
    setDefaultTab(tab)
    setRedirectUrl(redirectUrl)
    setIsOpen(true)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('auth-modal-open', 'true')
        sessionStorage.setItem('auth-modal-tab', tab)
        // Set supplier registration flag if it's a supplier flow
        if (isSupplierFlow) {
          sessionStorage.setItem('supplier_registration', 'true')
        }
      } catch {}
    }
  }
  
  // Close modal automatically if user becomes authenticated (unless it's a supplier flow)
  useEffect(() => {
    const isSupplierFlow = redirectUrl?.startsWith('/supplier') || 
                           (typeof window !== 'undefined' && sessionStorage.getItem('supplier_registration') === 'true')
    
    // Don't auto-close for supplier flows - allow user to switch accounts
    if (isAuthenticated && user && isOpen && !isSupplierFlow) {
      console.log('User authenticated, closing auth modal')
      setIsOpen(false)
      setRedirectUrl(undefined)
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('auth-modal-open')
          sessionStorage.removeItem('auth-modal-tab')
        } catch {}
      }
    }
  }, [isAuthenticated, user, isOpen, redirectUrl])

  const closeAuthModal = () => {
    setIsOpen(false)
    setRedirectUrl(undefined)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('auth-modal-open')
        sessionStorage.removeItem('auth-modal-tab')
      } catch {}
    }
  }

  return (
    <GlobalAuthModalContext.Provider value={{ openAuthModal, closeAuthModal, isOpen }}>
      {children}
      {/* Listen for global event to open modal without tight coupling */}
      <EventBridge onOpen={(tab, url) => openAuthModal(tab, url)} />
      <ClickInterceptor onOpen={(tab) => openAuthModal(tab)} />
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

// Lightweight bridge to listen for a DOM event and open the modal
function EventBridge({ onOpen }: { onOpen: (tab: 'login' | 'register', url?: string) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const tab = detail.tab === 'register' ? 'register' : 'login'
      const redirectUrl = detail.redirectUrl as string | undefined
      onOpen(tab, redirectUrl)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('open-auth-modal', handler as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('open-auth-modal', handler as EventListener)
      }
    }
  }, [onOpen])
  return null
}

// Global click interceptor to open modal when clicking auth links anywhere
function ClickInterceptor({ onOpen }: { onOpen: (tab: 'login' | 'register') => void }) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      // Respect modifier keys (let browser open in new tab/window)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (!target) return

      // Walk up to find an anchor
      let el: HTMLElement | null = target
      while (el && el !== document.body) {
        if (el instanceof HTMLAnchorElement && el.href) {
          try {
            const url = new URL(el.href)
            const path = url.pathname
            if (path === '/auth/login' || path === '/auth/register') {
              e.preventDefault()
              onOpen(path.endsWith('register') ? 'register' : 'login')
              return
            }
          } catch {}
        }
        el = el.parentElement
      }
    }

    if (typeof window !== 'undefined') {
      document.addEventListener('click', handler, { capture: true })
    }
    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('click', handler, { capture: true } as any)
      }
    }
  }, [onOpen])
  return null
}

