# Honic Store - Technology Stack & Architecture Documentation

## Overview
Honic Store is a modern full-stack e-commerce platform built with Next.js and TypeScript, designed for B2B transactions with comprehensive supplier management, order processing, and payment integration.

## Core Technologies

### Frontend Framework
- **Next.js 15.5.9** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5.7.2** - Type-safe JavaScript

### Styling & UI
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Headless UI component library
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, Hover Card, Label, Menubar, Navigation Menu, Popover, Progress, Radio Group, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, Tooltip
- **Lucide React** - Icon library
- **next-themes** - Dark mode support

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication (Supabase Auth)
  - Real-time subscriptions
  - Storage for images/files
- **Next.js API Routes** - Serverless API endpoints

### State Management & Data Fetching
- **React Context API** - Global state management
  - Auth Context
  - Theme Context
  - Currency Context
  - Company Context
  - Global Auth Modal Context
- **SWR 2.3.6** - Data fetching and caching
- **React Hook Form 7.54.1** - Form state management

### Validation & Type Safety
- **Zod 3.24.1** - Schema validation
- **TypeScript** - Static type checking

### Payment Integration
- **ClickPesa API** - Payment gateway integration
  - Checkout link generation
  - Webhook handling
  - Transaction verification

### Email Services
- **Nodemailer 7.0.10** - Email sending
- **Resend API** - Email delivery service

### Additional Services
- **Google Cloud Vision API** - Image recognition
- **Google Maps JavaScript API** - Maps integration
- **QR Code** - QR code generation

### Search & Data Processing
- **Fuse.js 7.1.0** - Fuzzy search
- **date-fns 4.1.0** - Date manipulation

### Charts & Visualization
- **Recharts 2.15.0** - Chart library

### Performance & Optimization
- **Vercel Analytics** - Analytics
- **Vercel Speed Insights** - Performance monitoring
- **React Window 2.2.5** - Virtual scrolling
- **Image Optimization** - Next.js Image component

### Internationalization
- **next-intl 4.5.8** - Internationalization

### Development Tools
- **ESLint** - Code linting
- **TypeScript** - Type checking
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

## Architecture

### Project Structure
```
honicstore/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (serverless functions)
│   ├── products/          # Product listing and detail pages
│   ├── supplier/          # Supplier dashboard
│   ├── siem-dashboard/    # Admin dashboard
│   └── ...
├── components/            # React components
│   ├── ui/                # Reusable UI components
│   └── ...
├── lib/                   # Utility libraries
│   ├── supabase-*.ts      # Supabase clients
│   ├── auth.ts            # Authentication logic
│   ├── clickpesa-api.ts   # Payment integration
│   └── ...
├── hooks/                 # Custom React hooks
├── contexts/              # React Context providers
├── database/              # SQL scripts and migrations
└── public/                # Static assets
```

### Key Features

#### 1. Authentication System
- Email/password authentication via Supabase
- OAuth (Google) integration
- Email verification
- Password reset
- Session management

#### 2. Product Management
- Product listing with pagination
- Product detail pages
- Category filtering
- Brand filtering
- Search functionality
- Image optimization
- Variant management

#### 3. Order Processing
- Shopping cart
- Checkout flow
- Order creation
- Payment processing (ClickPesa)
- Order tracking
- Stock management

#### 4. Supplier Dashboard
- Product management
- Order management
- Analytics
- Marketing tools
- Payment accounts
- Company information

#### 5. Admin Dashboard
- User management
- Product management
- Order management
- Supplier management
- Settings management
- Advertisement management

#### 6. Payment Integration
- ClickPesa payment gateway
- Checkout link generation
- Webhook handling
- Transaction verification
- Refund processing

## Database Schema

### Key Tables
- **products** - Product catalog
- **orders** - Order records
- **order_items** - Order line items
- **profiles** - User profiles
- **supplier_plans** - Supplier subscription plans
- **advertisements** - Advertisement management
- **categories** - Product categories

### Database Triggers
- **sold_count** and **buyers_count** are updated automatically via database triggers when orders are paid
- See `database/create-sold-count-trigger.sql` for trigger implementation

## API Routes

### Authentication
- `/api/auth/login` - User login
- `/api/auth/register` - User registration
- `/api/auth/supabase-register` - Supabase registration
- `/api/auth/logout` - User logout
- `/api/auth/session` - Get current session
- `/api/auth/verify` - Email verification
- `/api/auth/resend-verification` - Resend verification email

### Products
- `/api/products` - List products (with filtering)
- `/api/products/[id]` - Get product details
- `/api/products/[id]/variant-images` - Get variant images
- `/api/products/[id]/sold-count` - Get sold count

### Orders
- `/api/orders` - Create order
- `/api/orders/[referenceId]` - Get order by reference
- `/api/checkout` - Checkout processing

### Payment
- `/api/payment/clickpesa` - Create ClickPesa checkout link
- `/api/webhooks/clickpesa` - ClickPesa webhook handler

### Admin
- `/api/admin/products` - Admin product management
- `/api/admin/orders` - Admin order management
- `/api/admin/suppliers` - Supplier management
- `/api/admin/settings` - Application settings

### Supplier
- `/api/supplier/products` - Supplier product management
- `/api/supplier/orders` - Supplier order management
- `/api/supplier/payment/premium` - Premium plan payment

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Payment
- `CLICKPESA_API_KEY` - ClickPesa API key
- `CLICKPESA_SECRET` - ClickPesa secret
- `CLICKPESA_API_URL` - ClickPesa API URL

### Email
- `SMTP_HOST` - SMTP server host
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password
- `RESEND_API_KEY` - Resend API key (optional)

### Application
- `NEXT_PUBLIC_SITE_URL` - Site URL
- `NEXT_PUBLIC_APP_URL` - Application URL
- `NODE_ENV` - Environment (development/production)

## Deployment

### Platform
- **Vercel** - Hosting and deployment platform
- **Standalone Output** - Optimized for serverless deployment

### Build Configuration
- Memory limit: 6GB (for build process)
- Node.js version: Compatible with Next.js 15.5.9
- Build command: `npm run build`

## Performance Optimizations

### Caching
- API response caching
- Product data caching
- Image CDN caching
- Browser caching headers

### Code Splitting
- Route-based code splitting
- Component lazy loading
- Dynamic imports

### Image Optimization
- Next.js Image component
- WebP/AVIF format support
- Responsive image sizes
- Lazy loading

## Security Features

### Authentication
- Secure session management
- JWT tokens via Supabase
- Password hashing
- Email verification

### API Security
- Rate limiting
- Input validation (Zod)
- SQL injection prevention (Supabase parameterized queries)
- XSS protection
- CSRF protection

### Payment Security
- Checksum validation
- Webhook signature verification
- Secure order updates
- Reference ID protection

## Development Workflow

### Local Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Database Migrations

SQL scripts are located in `database/` directory:
- `check-sold-count-trigger.sql` - Check if trigger exists
- `create-sold-count-trigger.sql` - Create sold_count trigger

Run these scripts in Supabase SQL Editor to manage database triggers.

## Key Libraries & Dependencies

### UI Components
- Radix UI primitives
- Custom UI components in `components/ui/`
- Responsive design with Tailwind CSS

### Forms
- React Hook Form for form state
- Zod for validation
- Custom form components

### Data Fetching
- SWR for client-side data fetching
- Next.js API routes for server-side logic
- Supabase client for database queries

### Utilities
- `clsx` - Conditional class names
- `tailwind-merge` - Merge Tailwind classes
- `nanoid` - ID generation
- `uuid` - UUID generation
- `date-fns` - Date utilities

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive design
- Progressive Web App capabilities

## License
Private project - All rights reserved
