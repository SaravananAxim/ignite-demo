# Ignite Visibility Franchise Portal

A multi-tenant franchise marketing portal system that enables franchise brands to onboard franchisees, manage marketing plans, and generate contracts.

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Database Schema](#database-schema)
7. [Authentication & Authorization](#authentication--authorization)
8. [Application Routes](#application-routes)
9. [Key Features Implemented](#key-features-implemented)
10. [Remaining Work](#remaining-work)
11. [Deployment](#deployment)

---

## Product Overview

### Purpose
This portal allows Ignite Visibility to manage multiple franchise brand clients. Each franchise brand can have multiple marketing plans, and franchisees can select plans, make payments via Stripe, and receive contracts.

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `super_admin` | Ignite Visibility staff with full system access | Can create portals, manage all brands/plans, assign roles |
| `admin` | Portal administrators | Can manage franchisees, contracts, view activity logs |
| `franchisee` | End-user franchise owners | Can view their own contracts and profile |

### Core Flows

1. **Franchisee Onboarding Flow**: Portal → Select Brand → Select Plan → (Payment) → Contract Generation
2. **Admin Management Flow**: Dashboard → Manage Franchisees → Generate Contracts → Track Activity
3. **Super Admin Flow**: Portal Builder → Create Portals → Manage Brands & Plans

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  - Vite + TypeScript + React 18                                  │
│  - TailwindCSS + shadcn/ui components                            │
│  - React Router for navigation                                   │
│  - React Query for data fetching                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Backend                             │
│  - PostgreSQL Database                                           │
│  - Row Level Security (RLS) policies                             │
│  - Authentication (email/password)                               │
│  - Edge Functions (serverless)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  - Stripe (payment processing)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 5.4
- **Language**: TypeScript
- **Styling**: TailwindCSS 3.4 + shadcn/ui components
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router DOM 6.30
- **Form Handling**: React Hook Form + Zod validation
- **Charts**: Recharts
- **PDF Generation**: jsPDF + html2canvas

### Backend (Supabase)
- **Database**: PostgreSQL
- **Authentication**: Supabase Auth
- **API**: Auto-generated REST API
- **Security**: Row Level Security (RLS)
- **Functions**: Edge Functions (Deno)

### Key Dependencies
```json
{
  "@supabase/supabase-js": "^2.89.0",
  "@tanstack/react-query": "^5.83.0",
  "react-hook-form": "^7.61.1",
  "zod": "^3.25.76",
  "jspdf": "^3.0.4",
  "react-quill": "^2.0.0",
  "date-fns": "^3.6.0",
  "sonner": "^1.7.4"
}
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (recommend using nvm)
- npm or bun package manager
- Supabase project (already configured)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ignite-franchise-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 8080 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

With `npm run dev`, the app uses **Vite’s hot module replacement (HMR)**. Save a file and the browser should update automatically. If a change doesn’t appear, try a hard refresh (e.g. **Cmd+Shift+R** / **Ctrl+Shift+R**) or restart the dev server.

---

## Environment Variables

Create a `.env` file with the following variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

**Note**: These are automatically configured when connected to Supabase.

---

## Database Schema

### Tables

#### `portals`
Multi-tenant portal configuration for different franchise networks.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Portal display name |
| subdomain | text | Unique subdomain (e.g., "k9" for k9.ignite.app) |
| require_payment | boolean | Whether payment is required before contract |
| created_at | timestamp | Creation timestamp |

#### `brands`
Brands within a portal (a portal can have multiple brands).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| portal_id | uuid | FK to portals |
| name | text | Brand name |
| domain_pattern | text | Optional domain pattern |
| logo_url | text | Brand logo URL |
| primary_color | text | Hex color code |
| accent_color | text | Hex color code |

#### `plans`
Marketing plans offered by brands.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| brand_id | uuid | FK to brands |
| name | text | Plan name |
| description | text | Plan description |
| monthly_price | numeric | Price in USD |
| stripe_payment_link | text | Stripe checkout URL |
| stripe_payment_link_with_media | text | Alternative link with media add-on |
| supports_paid_media | boolean | Whether plan supports paid media |
| pricing_tier | text | Tier: free, starter, pro, enterprise |
| features | jsonb | Feature flags object |
| status | text | active/inactive |

#### `franchisees`
Registered franchisee records.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| brand_id | uuid | FK to brands |
| plan_id | uuid | FK to plans |
| name | text | Franchisee name |
| email | text | Email address |
| phone | text | Phone number |
| address | text | Physical address |
| status | text | pending/active/inactive |
| join_date | timestamp | Signup date |

#### `contract_templates`
Reusable contract templates with placeholders.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Template name |
| html_content | text | HTML template with placeholders |
| placeholders | text[] | List of placeholder keys |
| version | text | Version number |
| updated_by | uuid | Last editor |

#### `generated_contracts`
Contracts generated for franchisees.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| franchisee_id | uuid | FK to franchisees |
| template_id | uuid | FK to contract_templates |
| final_html | text | Rendered HTML with values |
| pdf_url | text | Optional PDF storage URL |
| status | text | draft/sent/signed |

#### `activity_logs`
Audit trail of all system actions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Actor user ID |
| user_email | text | Actor email |
| action | text | Action identifier |
| target_type | text | Entity type (portal, brand, franchisee, etc.) |
| target_id | text | Entity ID |
| details | jsonb | Additional context |
| ip_address | text | Client IP |
| created_at | timestamp | Action timestamp |

#### `user_roles`
Role assignments for users.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| role | app_role | admin, franchisee, or super_admin |

#### `profiles`
User profile information.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK, matches auth.users.id |
| email | text | User email |
| full_name | text | Display name |

---

## Authentication & Authorization

### Authentication Flow
1. User signs up/signs in via email + password
2. Supabase Auth creates session with JWT
3. `handle_new_user_role` trigger auto-assigns role:
   - `@ignitevisibility.com` emails → `admin` role
   - All others → `franchisee` role

### Role Hierarchy
```
super_admin > admin > franchisee
```
---

## Application Routes

### Public Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/` | Index | Landing/Dashboard based on auth |
| `/auth` | Auth | Login/Signup page |
| `/select-brand` | SelectBrand | Franchisee brand selection |
| `/select-plan` | SelectPlan | Franchisee plan selection |
| `/unauthorized` | Unauthorized | Access denied page |

### Admin Routes (requires `admin` role)
| Path | Component | Description |
|------|-----------|-------------|
| `/admin/login` | AdminLogin | Admin authentication |
| `/admin/dashboard` | AdminDashboard | Main admin dashboard |
| `/admin/contracts` | ContractTemplates | Contract template management |
| `/admin/franchisees/:id` | FranchiseeDetails | Individual franchisee view |
| `/admin/users` | UserManagement | User and role management |
| `/admin/logs` | ActivityLogs | System activity audit trail |
| `/portals` | Portals | Portal listing |
| `/brands` | Brands | Brand management |
| `/plans` | Plans | Plan management |

### Super Admin Routes (requires `super_admin` role)
| Path | Component | Description |
|------|-----------|-------------|
| `/admin/portal-builder` | PortalBuilder | Create/manage portals |
| `/admin/portal-builder/brands` | PortalBrandManagement | Brand & plan configuration |

---

## Key Features Implemented

### 1. Multi-Tenant Portal System
- [x] Portal creation with unique subdomains
- [x] Subdomain validation (real-time uniqueness check)
- [x] Portal-to-brand-to-plan hierarchy

### 2. Brand & Plan Management
- [x] CRUD operations for brands
- [x] CRUD operations for plans
- [x] Feature flags per plan (custom_domain, ssl, templates, etc.)
- [x] Pricing tier system (free, starter, pro, enterprise)
- [x] Stripe payment link integration

### 3. Franchisee Management
- [x] Franchisee listing with search/filter
- [x] Bulk actions (activate, deactivate, delete, export)
- [x] Individual franchisee detail view
- [x] Status management (pending, active, inactive)

### 4. Contract System
- [x] Rich text template editor (React Quill)
- [x] Placeholder system ({{franchisee_name}}, {{plan_name}}, etc.)
- [x] Contract generation with placeholder substitution
- [x] PDF export capability
- [x] Contract preview modal

### 5. Activity Logging & Audit Trail
- [x] Comprehensive action logging
- [x] Filterable activity log table
- [x] Per-franchisee activity view
- [x] Global activity log page

### 6. Authentication & Security
- [x] Email/password authentication
- [x] Role-based access control (RBAC)
- [x] Row Level Security (RLS) policies
- [x] Session management with expiry handling
- [x] Cross-tab session sync
- [x] Network status monitoring
- [x] Form auto-save for session recovery

### 7. UI/UX
- [x] Responsive design
- [x] Dark/light mode support via design tokens
- [x] Toast notifications
- [x] Loading states and skeletons
- [x] Form validation with Zod

---

## Deployment

### Production Build
```bash
npm run build
```

### Hosting Options
1. **Vercel**: Connect GitHub repo for automatic deployments
2. **Netlify**: Similar to Vercel with form handling
3. **Cloudflare Pages**: Edge deployment
4. **Self-hosted**: Serve the `dist/` folder via nginx/caddy

### Environment Configuration
Ensure all environment variables are set in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Supabase Configuration
The Supabase project should have:
1. All migrations applied (check `supabase/migrations/`)
2. RLS enabled on all tables
3. Auth email auto-confirm enabled for testing
4. Edge functions deployed (if any)

---

## File Structure

```
src/
├── assets/                 # Static assets (logos, images)
├── components/
│   ├── admin/              # Admin-specific components
│   ├── auth/               # Auth wrappers (RequireAuth)
│   ├── brands/             # Brand cards and skeletons
│   ├── layout/             # Layout components (AdminLayout, DashboardLayout)
│   ├── plans/              # Plan cards and skeletons
│   └── ui/                 # shadcn/ui components
├── contexts/
│   ├── PortalContext.tsx   # Multi-tenant portal context
│   └── UserContext.tsx     # Auth and user state
├── hooks/
│   ├── useAuth.tsx         # Legacy auth hook (deprecated)
│   ├── useDebounce.ts      # Debounce utility
│   ├── useFormPersistence.ts # Form auto-save
│   ├── useNetworkStatus.ts # Online/offline detection
│   ├── useSessionManager.ts # Session lifecycle
│   └── use-mobile.tsx      # Mobile detection
├── integrations/
│   └── supabase/
│       ├── client.ts       # Supabase client instance
│       └── types.ts        # Auto-generated DB types
├── lib/
│   ├── activityLogger.ts   # Activity logging utilities
│   ├── pdfGenerator.ts     # PDF generation
│   └── utils.ts            # General utilities
├── pages/
│   ├── admin/              # Admin pages
│   └── *.tsx               # Public pages
├── types/
│   ├── activityLog.ts      # Activity log types
│   └── contract.ts         # Contract types
├── App.tsx                 # Root component with routing
├── index.css               # Tailwind + design tokens
└── main.tsx                # Entry point
```

---