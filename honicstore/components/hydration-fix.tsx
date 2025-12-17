"use client"

import { useEffect } from 'react'

export function HydrationFix() {
  useEffect(() => {
    // List of browser extension attributes that cause hydration mismatches
    const extensionAttributes = [
      'bis_skin_checked',
      'data-bis_skin_checked',
      'data-bis_skin',
      'data-bis',
      'data-adblock',
      'data-adblocker',
      'data-extension',
      'data-browser-extension',
      'data-ublock',
      'data-ghostery',
      'data-adguard',
      'data-privacy-badger'
    ]

    // Remove browser extension attributes that cause hydration mismatches
    const removeExtensionAttributes = () => {
      extensionAttributes.forEach(attr => {
        const elements = document.querySelectorAll(`[${attr}]`)
        elements.forEach(element => {
          element.removeAttribute(attr)
        })
      })
    }

    // Run immediately and on DOM changes
    removeExtensionAttributes()
    
    // Use MutationObserver to catch dynamically added attributes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element
          const attributeName = mutation.attributeName
          
          // Check if the attribute is one of the problematic extension attributes
          if (attributeName && extensionAttributes.includes(attributeName)) {
            target.removeAttribute(attributeName)
          }
        } else if (mutation.type === 'childList') {
          // Also check newly added nodes
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              extensionAttributes.forEach(attr => {
                if (element.hasAttribute(attr)) {
                  element.removeAttribute(attr)
                }
              })
              // Also check child elements
              extensionAttributes.forEach(attr => {
                const childElements = element.querySelectorAll(`[${attr}]`)
                childElements.forEach(child => {
                  child.removeAttribute(attr)
                })
              })
            }
          })
        }
      })
    })

    // Observe the entire document with more comprehensive options
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: extensionAttributes
    })

    // Also run a periodic cleanup to catch any missed attributes
    const cleanupInterval = setInterval(removeExtensionAttributes, 100)

    return () => {
      observer.disconnect()
      clearInterval(cleanupInterval)
    }
  }, [])

  return null
}
