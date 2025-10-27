# Admin Separation Commands

## 🚀 **Quick Start Commands**

### **Step 1: Create Admin Project**
```bash
# Create new Next.js project for admin
npx create-next-app@latest aliexpress-admin --typescript --tailwind --app

# Navigate to admin project
cd aliexpress-admin

# Install additional dependencies
npm install @supabase/supabase-js lucide-react
npm install -D @types/node

# Initialize git repository
git init
git add .
git commit -m "Initial admin project setup"
```

### **Step 2: Copy Shared Dependencies**
```bash
# Copy shared utilities
cp -r ../aliexpress-clone/lib aliexpress-admin/
cp -r ../aliexpress-clone/components/ui aliexpress-admin/components/
cp -r ../aliexpress-clone/utils aliexpress-admin/
cp -r ../aliexpress-clone/types aliexpress-admin/

# Copy package.json dependencies
cp ../aliexpress-clone/package.json aliexpress-admin/package-admin.json
```

### **Step 3: Move Admin Code**
```bash
# Move admin APIs
cp -r ../aliexpress-clone/app/api/admin aliexpress-admin/app/api/
cp -r ../aliexpress-clone/app/api/users aliexpress-admin/app/api/

# Move admin pages
cp -r ../aliexpress-clone/app/siem-dashboard aliexpress-admin/app/dashboard

# Move admin hooks
cp ../aliexpress-clone/hooks/use-admin-settings.ts aliexpress-admin/hooks/
cp ../aliexpress-clone/hooks/use-users.ts aliexpress-admin/hooks/
cp ../aliexpress-clone/hooks/use-service-images.ts aliexpress-admin/hooks/

# Move admin components
cp ../aliexpress-clone/components/enhanced-admin-guard.tsx aliexpress-admin/components/
cp ../aliexpress-clone/components/admin-*.tsx aliexpress-admin/components/
```

### **Step 4: Clean Main Project**
```bash
# Navigate back to main project
cd ../aliexpress-clone

# Remove admin code from main project
rm -rf app/api/admin
rm -rf app/api/users
rm -rf app/siem-dashboard
rm hooks/use-admin-settings.ts
rm hooks/use-users.ts
rm hooks/use-service-images.ts
rm components/enhanced-admin-guard.tsx
rm components/admin-*.tsx

# Clean up any remaining admin imports
grep -r "admin" . --include="*.ts" --include="*.tsx" | grep -v node_modules
```

## 🔧 **Configuration Commands**

### **Admin Project Configuration**
```bash
# Navigate to admin project
cd aliexpress-admin

# Create admin-specific layout
cat > app/layout.tsx << 'EOF'
import { AdminAuthProvider } from '@/components/admin-auth-provider'
import { EnhancedAdminGuard } from '@/components/enhanced-admin-guard'

export default function AdminLayout({ children }) {
  return (
    <html>
      <body>
        <AdminAuthProvider>
          <EnhancedAdminGuard>
            {children}
          </EnhancedAdminGuard>
        </AdminAuthProvider>
      </body>
    </html>
  )
}
EOF

# Create admin-specific middleware
cat > middleware.ts << 'EOF'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Admin-only middleware
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  
  if (isAdminRoute) {
    // Add admin-specific headers
    const response = NextResponse.next()
    response.headers.set('X-Admin-App', 'true')
    return response
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
EOF
```

### **Main Project Configuration**
```bash
# Navigate to main project
cd ../aliexpress-clone

# Update main project middleware
cat > middleware.ts << 'EOF'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // User app middleware
  const response = NextResponse.next()
  response.headers.set('X-User-App', 'true')
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
EOF
```

## 🗄️ **Database Commands**

### **Database Setup**
```bash
# Create database backup
pg_dump your_database > backup_before_separation.sql

# Verify database connections
psql -h localhost -U your_user -d your_database -c "SELECT 1;"

# Test admin database access
psql -h localhost -U your_user -d your_database -c "SELECT COUNT(*) FROM products;"
```

### **Environment Variables**
```bash
# Main project environment
cat > .env.local << 'EOF'
# Main App Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/aliexpress
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://yourdomain.com
EOF

# Admin project environment
cd aliexpress-admin
cat > .env.local << 'EOF'
# Admin App Configuration
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com
NODE_ENV=production

# Database Configuration (Same as main)
DATABASE_URL=postgresql://user:password@localhost:5432/aliexpress
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://admin.yourdomain.com
EOF
```

## 🌐 **DNS Configuration Commands**

### **DNS Setup**
```bash
# Add DNS records for admin subdomain
# A record: admin.yourdomain.com → your-server-ip
# CNAME record: admin.yourdomain.com → yourdomain.com

# Test DNS resolution
nslookup admin.yourdomain.com
dig admin.yourdomain.com

# Test SSL certificate
openssl s_client -connect admin.yourdomain.com:443 -servername admin.yourdomain.com
```

### **SSL Certificate Setup**
```bash
# Generate SSL certificate for admin subdomain
certbot --nginx -d admin.yourdomain.com

# Verify SSL certificate
curl -I https://admin.yourdomain.com
```

## 🧪 **Testing Commands**

### **Development Testing**
```bash
# Test main application
cd aliexpress-clone
npm run dev
# Test at http://localhost:3000

# Test admin application
cd aliexpress-admin
npm run dev
# Test at http://localhost:3001
```

### **Build Testing**
```bash
# Build main application
cd aliexpress-clone
npm run build
npm run start

# Build admin application
cd aliexpress-admin
npm run build
npm run start
```

### **API Testing**
```bash
# Test main app APIs
curl -X GET http://localhost:3000/api/products
curl -X GET http://localhost:3000/api/cart

# Test admin app APIs
curl -X GET http://localhost:3001/api/admin/settings
curl -X GET http://localhost:3001/api/users
```

## 🚀 **Deployment Commands**

### **Production Deployment**
```bash
# Deploy main application
cd aliexpress-clone
npm run build
npm run start

# Deploy admin application
cd aliexpress-admin
npm run build
npm run start
```

### **Docker Deployment**
```bash
# Create Dockerfile for main app
cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
EOF

# Create Dockerfile for admin app
cd aliexpress-admin
cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
EOF
```

## 🔍 **Verification Commands**

### **Code Verification**
```bash
# Check for remaining admin code in main project
cd aliexpress-clone
grep -r "admin" . --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "use-admin" . --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "siem-dashboard" . --include="*.ts" --include="*.tsx" | grep -v node_modules

# Check for user code in admin project
cd aliexpress-admin
grep -r "use-cart" . --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "products" . --include="*.ts" --include="*.tsx" | grep -v node_modules
```

### **Functionality Verification**
```bash
# Test main app functionality
curl -X GET https://yourdomain.com/api/products
curl -X GET https://yourdomain.com/api/cart

# Test admin app functionality
curl -X GET https://admin.yourdomain.com/api/admin/settings
curl -X GET https://admin.yourdomain.com/api/users
```

## 🧹 **Cleanup Commands**

### **Remove Backup Files**
```bash
# Remove temporary files
rm -rf backup_before_separation.sql
rm -rf package-admin.json

# Clean up git history
git add .
git commit -m "Clean up after admin separation"
```

### **Optimize Projects**
```bash
# Optimize main project
cd aliexpress-clone
npm run build
npm audit fix

# Optimize admin project
cd aliexpress-admin
npm run build
npm audit fix
```

## 📊 **Monitoring Commands**

### **Performance Monitoring**
```bash
# Monitor main app performance
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com

# Monitor admin app performance
curl -w "@curl-format.txt" -o /dev/null -s https://admin.yourdomain.com
```

### **Log Monitoring**
```bash
# Monitor main app logs
tail -f /var/log/yourdomain.com/access.log
tail -f /var/log/yourdomain.com/error.log

# Monitor admin app logs
tail -f /var/log/admin.yourdomain.com/access.log
tail -f /var/log/admin.yourdomain.com/error.log
```

## 🔄 **Rollback Commands**

### **Emergency Rollback**
```bash
# Stop both applications
pkill -f "node.*aliexpress"
pkill -f "node.*admin"

# Restore from backup
cp backup_before_separation.sql your_database
psql -h localhost -U your_user -d your_database < backup_before_separation.sql

# Restart original application
cd aliexpress-clone
git checkout main
npm run build
npm run start
```

---

**Commands Version**: 1.0  
**Last Updated**: [Current Date]  
**Status**: Ready for Use
