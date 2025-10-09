import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function usePreviousPage() {
  const pathname = usePathname()
  const previousPathRef = useRef<string>('')
  
  useEffect(() => {
    // Store the current pathname as previous before it changes
    if (pathname !== previousPathRef.current) {
      previousPathRef.current = pathname
    }
  }, [pathname])
  
  return previousPathRef.current
} 
 
 
 
 
 
 
 
 