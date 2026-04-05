'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useLanguage } from '@/contexts/language-context'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

export function CheckoutLanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()
  const { themeClasses } = useTheme()

  return (
    <ToggleGroup
      type="single"
      value={language}
      onValueChange={(v) => {
        if (v) setLanguage(v as 'en' | 'sw')
      }}
      className={cn(
        'inline-flex items-center gap-0.5 p-1 rounded-lg border shrink-0',
        themeClasses.cardBorder,
        themeClasses.cardBg,
        className
      )}
    >
      <ToggleGroupItem
        value="en"
        aria-label="English"
        className={cn(
          'px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors',
          language === 'en'
            ? 'bg-yellow-500 text-neutral-950'
            : cn(themeClasses.textNeutralSecondary, 'hover:bg-gray-100 dark:hover:bg-gray-800')
        )}
      >
        EN
      </ToggleGroupItem>
      <ToggleGroupItem
        value="sw"
        aria-label="Swahili"
        className={cn(
          'px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors',
          language === 'sw'
            ? 'bg-yellow-500 text-neutral-950'
            : cn(themeClasses.textNeutralSecondary, 'hover:bg-gray-100 dark:hover:bg-gray-800')
        )}
      >
        SW
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
