# Next-Intl Migration Guide

The application has been migrated to use `next-intl` for all translations instead of the manual translation system.

## Setup Complete

✅ **Configuration Files Created:**
- `i18n/request.ts` - Next-intl request configuration
- `lib/i18n-config.ts` - Locale configuration
- `messages/en.json` - English translations
- `messages/sw.json` - Swahili translations
- `components/next-intl-provider.tsx` - Client provider wrapper
- `hooks/use-intl-translation.ts` - Translation hooks

✅ **Updated Files:**
- `app/layout.tsx` - Added NextIntlProvider
- `app/supplier/layout.tsx` - Migrated to use next-intl
- `middleware.ts` - Integrated next-intl middleware

## How to Use

### In Client Components

```tsx
'use client'

import { useIntlTranslation, useIntlTranslationNamespace } from '@/hooks/use-intl-translation'

function MyComponent() {
  // For root-level translations
  const t = useIntlTranslation()
  const welcome = t('dashboard.welcomeBack')
  
  // For namespace-specific translations (recommended)
  const tNav = useIntlTranslationNamespace('navigation')
  const tCommon = useIntlTranslationNamespace('common')
  
  return (
    <div>
      <h1>{tNav('dashboard')}</h1>
      <button>{tCommon('save')}</button>
    </div>
  )
}
```

### Translation Namespaces

Translations are organized into namespaces:

- `navigation` - Navigation items (dashboard, products, orders, etc.)
- `layout` - Layout-specific (supplier, accountActive, currency, etc.)
- `common` - Common actions (save, cancel, delete, etc.)
- `dashboard` - Dashboard messages
- `account` - Account settings
- `company` - Company information
- `invoices` - Invoices & billing
- `plans` - Plan selection
- `terms` - Terms and conditions

### Adding New Translations

1. **Add to JSON files:**
   - Add the key to `messages/en.json`
   - Add the translation to `messages/sw.json`

2. **Use in components:**
   ```tsx
   const t = useIntlTranslationNamespace('yourNamespace')
   <p>{t('yourKey')}</p>
   ```

## Migration Status

✅ **Completed:**
- Supplier layout (`app/supplier/layout.tsx`)
- Translation infrastructure
- Middleware integration

🔄 **To Migrate:**
- All other supplier pages
- Customer-facing pages
- Admin pages
- API error messages (if needed)

## Benefits

1. **Type Safety** - TypeScript support for translation keys
2. **Better Organization** - Namespaced translations
3. **Server Components** - Can use translations in server components
4. **Formatting** - Built-in date, number, and message formatting
5. **Pluralization** - Built-in plural support
6. **Industry Standard** - Widely used library with great documentation

## Next Steps

To migrate other pages:

1. Replace `import { t } from '@/lib/translations'` with `import { useIntlTranslation } from '@/hooks/use-intl-translation'`
2. Replace `const translate = t(language)` with `const t = useIntlTranslation()` or use namespaces
3. Update translation keys to use dot notation (e.g., `navigation.dashboard` instead of `dashboard`)
4. Test in both English and Swahili

## Documentation

- [Next-Intl Docs](https://next-intl-docs.vercel.app/)
- [Translation Guide](./TRANSLATION_GUIDE.md)

