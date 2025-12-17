"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"

interface ThemeToggleButtonProps {
  className?: string
  showLabel?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "default" | "lg"
}

export function ThemeToggleButton({ 
  className, 
  showLabel = true,
  variant = "outline",
  size = "sm"
}: ThemeToggleButtonProps) {
  const { backgroundColor, setBackgroundColor } = useTheme()

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        // Toggle between white and dark (black) only
        const newTheme = (backgroundColor === 'white' || backgroundColor === 'gray') ? 'dark' : 'white'
        setBackgroundColor(newTheme)
      }}
      className={cn(
        "flex items-center gap-2",
        "border-gray-300 dark:border-gray-600",
        "hover:bg-gray-50 dark:hover:bg-gray-800",
        className
      )}
      title={(backgroundColor === 'white' || backgroundColor === 'gray') ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      {(backgroundColor === 'white' || backgroundColor === 'gray') ? (
        <>
          <Moon className="w-4 h-4" />
          {showLabel && <span className="hidden sm:inline">Dark</span>}
        </>
      ) : (
        <>
          <Sun className="w-4 h-4" />
          {showLabel && <span className="hidden sm:inline">Light</span>}
        </>
      )}
    </Button>
  )
}

