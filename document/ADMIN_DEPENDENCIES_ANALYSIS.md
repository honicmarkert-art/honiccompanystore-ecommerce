# Admin Files & APIs Dependencies Analysis

## Executive Summary

**Can you move admin files to a separate project?** 
**Partially Yes, but with important dependencies that need to be handled.**

The admin system (`/siem-dashboard` pages and `/api/admin` routes) has **moderate coupling** with the main application. While most admin functionality is isolated, there are **critical shared dependencies** that would need to be addressed.

---

## 🔴 Critical Dependencies (Must Handle)

### 1. **Admin Settings Database Table** ⚠️ HIGH IMPACT
- **Location**: `admin_settings` table in Supabase
- **Used By**:
  - **Admin**: `/api/admin/settings` (write/update)
  - **Public**: `/api/company/settings` (read-only, no auth required)
- **Impact**: 
  - Public pages read company branding, theme, contact info from this table
  - `CompanyProvider` and `PublicCompanyProvider` both depend on admin settings
  - Used in root `layout.tsx` for all pages
- **Files Affected**:
  - `components/company-provider.tsx` → calls `useAdminSettings()` → `/api/admin/settings`
  - `contexts/public-company-context.tsx` → calls `/api/company/settings`
  - `hooks/use-admin-settings.ts` → calls `/api/admin/settings`
  - `app/api/company/settings/route.ts` → reads from `admin_settings` table

**Solution if separating**: 
- Keep `admin_settings` table accessible to both projects
- OR create a separate `company_settings` table for public use
- OR expose admin settings via API that public project can call

---

### 2. **Shared Database Schema** ⚠️ HIGH IMPACT
- **Shared Tables**: `orders`, `products`, `categories`, `users`, `suppliers`, `cart`, `wishlist`, etc.
- **Impact**: Both admin and public apps need access to the same database
- **Solution**: Both projects would need to connect to the same Supabase instance

---

### 3. **Shared Utility Libraries** ⚠️ MEDIUM IMPACT
- **Location**: `lib/` directory
- **Shared Files**:
  - `lib/supabase.ts` - Database client
  - `lib/supabase-server.ts` - Server-side client
  - `lib/logger.ts` - Logging utility
  - `lib/admin-auth.ts` - Admin authentication (used by admin APIs)
  - `lib/security-server.ts` - Security utilities
- **Impact**: Admin APIs use these utilities
- **Solution**: Copy or share these utilities between projects

---

### 4. **Middleware Protection** ⚠️ LOW IMPACT
- **Location**: `middleware.ts`
- **Function**: Protects `/siem-dashboard` routes
- **Impact**: If moved to separate project, this protection would be in that project's middleware
- **Solution**: Move middleware logic to admin project

---

## ✅ Isolated Components (Safe to Move)

### 1. **Admin Pages** ✅
- **Location**: `app/siem-dashboard/**/*.tsx`
- **Status**: Only used within admin dashboard
- **Dependencies**: 
  - Use admin components (`admin-auth-guard`, `admin-role-guard`)
  - Call `/api/admin/*` endpoints
  - **No public pages import these**

### 2. **Admin API Routes** ✅
- **Location**: `app/api/admin/**/*.ts`
- **Status**: Only called by admin pages
- **Dependencies**:
  - Use `validateAdminAccess()` from `lib/admin-auth.ts`
  - Access shared database tables
  - **No public pages call these directly**

### 3. **Admin Components** ✅
- **Location**: `components/admin-*.tsx`
  - `admin-auth-guard.tsx`
  - `admin-role-guard.tsx`
  - `admin-2fa-guard.tsx`
  - `admin-notification-center.tsx`
- **Status**: Only used in admin pages
- **Dependencies**: Use `useAuth()` hook (shared)

---

## 📊 Dependency Map

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN APPLICATION                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Public Pages (/, /products, /cart, etc.)           │   │
│  │  └─> CompanyProvider                                │   │
│  │      └─> useAdminSettings()                         │   │
│  │          └─> /api/admin/settings ❌                  │   │
│  │                                                      │   │
│  │  └─> PublicCompanyProvider                          │   │
│  │      └─> /api/company/settings ✅                   │   │
│  │          └─> admin_settings table (read)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Admin Pages (/siem-dashboard/*)                     │   │
│  │  └─> AdminAuthGuard, AdminRoleGuard                  │   │
│  │  └─> /api/admin/* endpoints                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Shared Resources                                     │   │
│  │  • lib/supabase.ts                                    │   │
│  │  • lib/logger.ts                                      │   │
│  │  • lib/admin-auth.ts                                  │   │
│  │  • Database tables (orders, products, etc.)          │   │
│  │  • admin_settings table ⚠️                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Migration Strategy (If Separating)

### Option 1: Keep Shared Database & API
1. **Move admin files** to separate Next.js project
2. **Keep shared database** (Supabase) accessible to both
3. **Create API gateway** or keep `/api/company/settings` in main app
4. **Share utilities** via npm package or git submodule

### Option 2: Complete Separation with API Communication
1. **Move admin files** to separate project
2. **Create REST API** in admin project for settings management
3. **Main app calls** admin API for company settings
4. **Separate databases** (requires data sync for shared tables)

### Option 3: Hybrid Approach (Recommended)
1. **Move admin UI** (`/siem-dashboard`) to separate project
2. **Keep admin APIs** (`/api/admin`) in main project (or move to separate API service)
3. **Keep `/api/company/settings`** in main project (reads from shared DB)
4. **Share database** and utilities

---

## 📋 Files That Reference Admin

### Public Files Using Admin Settings:
- ✅ `components/company-provider.tsx` - Uses `useAdminSettings()`
- ✅ `contexts/public-company-context.tsx` - Calls `/api/company/settings`
- ✅ `app/layout.tsx` - Includes `CompanyProvider` and `PublicCompanyProvider`
- ✅ `hooks/use-admin-settings.ts` - Calls `/api/admin/settings`

### Admin-Only Files (Safe to Move):
- ✅ All files in `app/siem-dashboard/`
- ✅ All files in `app/api/admin/`
- ✅ `components/admin-*.tsx` (4 files)
- ✅ `hooks/use-admin-settings.ts` (but used by CompanyProvider!)

---

## ⚠️ Breaking Changes if Moved

1. **CompanyProvider will break** - Currently calls `/api/admin/settings`
   - **Fix**: Change to call `/api/company/settings` or external admin API

2. **PublicCompanyProvider** - Already uses `/api/company/settings` ✅ (safe)

3. **Middleware** - Admin route protection would need to be in admin project

4. **Shared utilities** - Need to be available in both projects

---

## ✅ Recommendation

**For your use case**, I recommend:

1. **Keep admin APIs in main project** (or create separate API service)
2. **Move only admin UI** (`/siem-dashboard` pages) to separate project
3. **Keep `/api/company/settings`** in main project (public read endpoint)
4. **Update CompanyProvider** to use `/api/company/settings` instead of `/api/admin/settings`
5. **Share database** and core utilities

This gives you:
- ✅ Separate admin UI project
- ✅ Shared database access
- ✅ Minimal breaking changes
- ✅ Public app doesn't break

---

## 📝 Action Items (If Separating)

1. [ ] Update `CompanyProvider` to use `/api/company/settings` instead of `useAdminSettings()`
2. [ ] Move `app/siem-dashboard/` to new project
3. [ ] Move `app/api/admin/` to new project (or keep in main)
4. [ ] Move `components/admin-*.tsx` to new project
5. [ ] Update middleware in both projects
6. [ ] Share `lib/` utilities (via package or copy)
7. [ ] Ensure both projects can access Supabase database
8. [ ] Test that public pages still load company settings correctly

---

## Summary

**Answer**: You CAN move admin files to a separate project, but you'll need to:
- Handle the `admin_settings` table dependency (public pages read from it)
- Share database access
- Share utility libraries
- Update `CompanyProvider` to not call admin APIs directly

The **cleanest approach** is to move only the admin UI and keep admin APIs accessible, or create a proper API gateway between the two projects.
