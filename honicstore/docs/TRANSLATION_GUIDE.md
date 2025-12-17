# Translation Guide

This project uses a custom translation system that supports English (en) and Swahili (sw).

## Quick Start

### Using Translations in Components

**Option 1: Using the hook (Recommended)**
```tsx
import { useTranslation } from '@/hooks/use-translation'

function MyComponent() {
  const t = useTranslation()
  
  return (
    <div>
      <h1>{t('dashboard')}</h1>
      <p>{t('welcomeBack')}, User!</p>
    </div>
  )
}
```

**Option 2: Using the context (Current method)**
```tsx
import { useLanguage } from '@/contexts/language-context'
import { t } from '@/lib/translations'

function MyComponent() {
  const { language } = useLanguage()
  const translate = t(language)
  
  return (
    <div>
      <h1>{translate('dashboard')}</h1>
    </div>
  )
}
```

### Server-Side Translations

```tsx
import { getServerTranslation } from '@/hooks/use-translation'

export async function MyServerComponent() {
  const t = getServerTranslation('en') // or get from request/params
  return <h1>{t('dashboard')}</h1>
}
```

## Available Translation Keys

All translation keys are defined in `lib/translations.ts`. Common keys include:

- Navigation: `dashboard`, `products`, `orders`, `analytics`, `marketing`, `featured`, `company`, `support`
- Actions: `save`, `update`, `cancel`, `delete`, `edit`, `add`, `refresh`, `download`, `upload`
- Status: `loading`, `error`, `success`, `paid`, `failed`, `pending`, `cancelled`
- Dashboard: `welcomeBack`, `completePayment`, `paymentSuccessful`, `paymentFailed`
- Account: `deleteAccount`, `permanentlyDeleteAccount`, `warningActionCannotBeUndone`
- Invoices: `invoicesBilling`, `totalInvoices`, `totalPaid`, `totalFailed`, `failedInvoices`

## Adding New Translations

1. Open `lib/translations.ts`
2. Add the key to both `en` and `sw` objects:
```typescript
en: {
  // ... existing keys
  myNewKey: 'My English Text',
},
sw: {
  // ... existing keys
  myNewKey: 'Maandishi Yangu ya Kiswahili',
}
```

3. Use it in your component:
```tsx
const t = useTranslation()
<p>{t('myNewKey')}</p>
```

## Migration to next-intl (Future)

We have `next-intl` installed for future migration. To migrate:

1. Set up `next-intl` configuration
2. Convert translation files to JSON format
3. Update components to use `useTranslations()` from `next-intl`
4. Configure middleware for locale routing

See: https://next-intl-docs.vercel.app/

## Best Practices

1. **Always use translation keys** - Never hardcode text strings
2. **Provide fallbacks** - Use the fallback parameter: `t('key', 'Fallback text')`
3. **Keep keys descriptive** - Use clear, descriptive keys like `completePayment` not `cp`
4. **Group related keys** - Use comments to group related translations
5. **Test both languages** - Always test your UI in both English and Swahili

## Common Issues

**Translation not showing?**
- Check if the key exists in `lib/translations.ts`
- Verify you're using the correct language context
- Check browser console for missing key warnings

**Key returns as-is?**
- The key might not exist - add it to translations.ts
- Check spelling of the key
- Ensure both `en` and `sw` versions are added

