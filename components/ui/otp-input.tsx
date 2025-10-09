"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Clock, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

interface OTPInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: string
  countdown?: number | null
  onResend?: () => void
  resendDisabled?: boolean
  className?: string
  autoFocus?: boolean
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error,
  countdown,
  onResend,
  resendDisabled = false,
  className,
  autoFocus = true
}: OTPInputProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length)
  }, [length])

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus()
    }
  }, [autoFocus])

  // Handle value changes
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value)
    }
  }, [value, length, onComplete])

  const handleInputChange = (index: number, inputValue: string) => {
    if (disabled) return

    // Only allow single digit
    const digit = inputValue.slice(-1)
    if (!/^\d*$/.test(digit)) return

    // Update the value
    const newValue = value.split('')
    newValue[index] = digit
    const newValueString = newValue.join('')
    onChange(newValueString)

    // Move to next input if digit entered
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Backspace') {
      if (value[index]) {
        // Clear current input
        const newValue = value.split('')
        newValue[index] = ''
        onChange(newValue.join(''))
      } else if (index > 0) {
        // Move to previous input
        inputRefs.current[index - 1]?.focus()
        setFocusedIndex(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
      setFocusedIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return

    e.preventDefault()
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '')
    const digits = pastedData.slice(0, length).split('')
    
    // Fill the inputs with pasted data
    const newValue = Array(length).fill('')
    digits.forEach((digit, index) => {
      if (index < length) {
        newValue[index] = digit
      }
    })
    
    onChange(newValue.join(''))
    
    // Focus the next empty input or the last input
    const nextIndex = Math.min(digits.length, length - 1)
    inputRefs.current[nextIndex]?.focus()
    setFocusedIndex(nextIndex)
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* OTP Input Fields */}
      <div className="flex justify-center space-x-2">
        {Array.from({ length }, (_, index) => (
          <div key={index} className="relative">
            <Input
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={value[index] || ''}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={() => setFocusedIndex(index)}
              disabled={disabled}
              className={cn(
                "w-12 h-12 text-center text-lg font-semibold border-2 transition-all duration-200",
                "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300",
                focusedIndex === index && !error && "border-blue-500 ring-2 ring-blue-500/20",
                disabled && "bg-gray-100 cursor-not-allowed"
              )}
            />
            {/* Success/Error indicators */}
            {value[index] && !error && (
              <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-green-500" />
            )}
            {error && value[index] && (
              <XCircle className="absolute -top-1 -right-1 w-4 h-4 text-red-500" />
            )}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Resend Section */}
      {onResend && (
        <div className="flex items-center justify-center space-x-2">
          {countdown !== null && countdown > 0 ? (
            <>
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Resend in {formatCountdown(countdown)}
              </span>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              disabled={resendDisabled}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Resend OTP</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
} 
 
 
 
 
 
 
 
 