"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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

  // Restore persisted state to avoid disappearing on re-renders/refreshes
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const persisted = sessionStorage.getItem('auth-modal-open')
      const tab = sessionStorage.getItem('auth-modal-tab') as 'login' | 'register' | null
      if (persisted === 'true') {
        setIsOpen(true)
        if (tab === 'login' || tab === 'register') setDefaultTab(tab)
      }
    } catch {}
  }, [])

  const openAuthModal = (tab: 'login' | 'register' = 'login', redirectUrl?: string) => {
    setDefaultTab(tab)
    setRedirectUrl(redirectUrl)
    setIsOpen(true)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('auth-modal-open', 'true')
        sessionStorage.setItem('auth-modal-tab', tab)
      } catch {}
    }
  }

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

