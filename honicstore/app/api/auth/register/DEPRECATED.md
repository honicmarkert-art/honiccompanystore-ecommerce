# ⚠️ DEPRECATED: Legacy Register API

## Status: DEPRECATED - DO NOT USE

This API endpoint (`/api/auth/register`) is **deprecated** and uses an insecure local user store.

## Security Issues

1. **Uses Local User Store**: Stores users in memory (`lib/users.ts`)
2. **Insecure Password Storage**: Not production-ready
3. **No Database Persistence**: Data lost on server restart
4. **No Proper Hashing**: Uses basic hashing, not industry-standard

## Migration

**Use instead**: `/api/auth/supabase-register`

The new API:
- ✅ Uses Supabase (secure, production-ready)
- ✅ Proper password hashing
- ✅ Database persistence
- ✅ Email verification
- ✅ Rate limiting
- ✅ Input validation
- ✅ Security logging

## Action Required

This file should be **deleted** or the endpoint should return a deprecation error redirecting to the new API.

## Current Usage

- ❌ `hooks/use-auth.ts` - Still references this endpoint (needs update)
- ✅ `contexts/auth-context.tsx` - Uses `/api/auth/supabase-register` (correct)
