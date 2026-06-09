import { Routes, Route } from "react-router-dom";
import { RequireAuth, RedirectIfAuthenticated } from "@/components/auth/RequireAuth";

// Public pages
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Unauthorized from "@/pages/Unauthorized";
import NotFound from "@/pages/NotFound";

// Franchisee pages
import SelectBrand from "@/pages/SelectBrand";
import SelectPlan from "@/pages/SelectPlan";
import Onboarding from "@/pages/Onboarding";
import Representatives from "@/pages/Representatives";
import ContractReview from "@/pages/ContractReview";
import PaymentProcessing from "@/pages/PaymentProcessing";
import PaymentConfirmation from "@/pages/PaymentConfirmation";
import Confirmation from "@/pages/Confirmation";
import FranchiseeAuth from "@/pages/FranchiseeAuth";
import FranchiseeDashboard from "@/pages/FranchiseeDashboard";

// Admin pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ContractTemplates from "@/pages/admin/ContractTemplates";
import FranchiseeDetails from "@/pages/admin/FranchiseeDetails";
import UserManagement from "@/pages/admin/UserManagement";
import ActivityLogs from "@/pages/admin/ActivityLogs";
import PortalBrandManagement from "@/pages/admin/PortalBrandManagement";
import PendingSignatures from "@/pages/admin/PendingSignatures";
import CompletedSignups from "@/pages/admin/CompletedSignups";
import PortalCompletedSignups from "@/pages/admin/PortalCompletedSignups";
import WebhooksAdmin from "@/pages/admin/Webhooks";

// Protected pages
import Portals from "@/pages/Portals";
import PortalDetail from "@/pages/PortalDetail";
import BrandDetail from "@/pages/BrandDetail";
import Brands from "@/pages/Brands";
import Plans from "@/pages/Plans";
import SKUs from "@/pages/admin/SKUs";
import Packages from "@/pages/admin/Packages";
import Products from "@/pages/admin/Products";
import Programs from "@/pages/admin/Programs";
import ApiKeys from "@/pages/admin/ApiKeys";

/**
 * Route configuration component
 * Centralizes all application routes for easier management
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Franchisee auth - public entry point */}
      <Route path="/franchisee-auth" element={<FranchiseeAuth />} />

      {/* Franchisee protected routes - require franchisee login */}
      <Route
        path="/my-locations"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <FranchiseeDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/select-brand"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <SelectBrand />
          </RequireAuth>
        }
      />
      <Route
        path="/select-plan"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <SelectPlan />
          </RequireAuth>
        }
      />
      <Route
        path="/onboarding"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/representatives"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <Representatives />
          </RequireAuth>
        }
      />
      <Route
        path="/contract-review"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <ContractReview />
          </RequireAuth>
        }
      />
      <Route
        path="/payment-processing"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <PaymentProcessing />
          </RequireAuth>
        }
      />
      <Route
        path="/payment-confirmation"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <PaymentConfirmation />
          </RequireAuth>
        }
      />
      <Route
        path="/confirmation"
        element={
          <RequireAuth requiredRole="franchisee" redirectTo="/franchisee-auth">
            <Confirmation />
          </RequireAuth>
        }
      />

      {/* Admin authentication */}
      <Route
        path="/admin/login"
        element={
          <RedirectIfAuthenticated redirectTo="/admin/dashboard">
            <AdminLogin />
          </RedirectIfAuthenticated>
        }
      />

      {/* Protected admin routes */}
      <Route
        path="/admin/dashboard"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/portals"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <Portals />
          </RequireAuth>
        }
      />
      <Route
        path="/portals/:id"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <PortalDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/portals/:portalId/brands/:brandId"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <BrandDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/brands"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <Brands />
          </RequireAuth>
        }
      />
      <Route
        path="/plans"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <Plans />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/skus"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <SKUs />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/products"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <Products />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/packages"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <Packages />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/programs"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <Programs />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/api-keys"
        element={
          <RequireAuth requiredRole="super_admin" redirectTo="/admin/login">
            <ApiKeys />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/contracts"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <ContractTemplates />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/franchisees/:id"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <FranchiseeDetails />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <UserManagement />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <ActivityLogs />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/webhooks"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <WebhooksAdmin />
          </RequireAuth>
        }
      />

      {/* Super admin routes */}
      <Route
        path="/admin/portal-builder/brands"
        element={
          <RequireAuth requiredRole="super_admin" redirectTo="/admin/login">
            <PortalBrandManagement />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/completed-signups"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <CompletedSignups />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/completed-signups/:portalId"
        element={
          <RequireAuth requiredRole="admin" redirectTo="/admin/login">
            <PortalCompletedSignups />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/pending-signatures"
        element={
          <RequireAuth requiredRole="super_admin" redirectTo="/admin/login">
            <PendingSignatures />
          </RequireAuth>
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/**
 * Route path constants for type-safe navigation
 */
export const ROUTES = {
  // Public
  HOME: '/',
  AUTH: '/auth',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  UNAUTHORIZED: '/unauthorized',

  // Franchisee
  MY_LOCATIONS: '/my-locations',
  SELECT_BRAND: '/select-brand',
  SELECT_PLAN: '/select-plan',
  FRANCHISEE_AUTH: '/franchisee-auth',
  ONBOARDING: '/onboarding',
  REPRESENTATIVES: '/representatives',
  CONTRACT_REVIEW: '/contract-review',
  PAYMENT_PROCESSING: '/payment-processing',
  PAYMENT_CONFIRMATION: '/payment-confirmation',
  CONFIRMATION: '/confirmation',

  // Admin
  ADMIN_LOGIN: '/admin/login',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_CONTRACTS: '/admin/contracts',
  ADMIN_WEBHOOKS: '/admin/webhooks',
  ADMIN_USERS: '/admin/users',
  ADMIN_LOGS: '/admin/logs',
  ADMIN_FRANCHISEE: (id: string) => `/admin/franchisees/${id}`,

  // Super admin
  PORTAL_BRAND_MANAGEMENT: '/admin/portal-builder/brands',
  PENDING_SIGNATURES: '/admin/pending-signatures',

  // Protected admin routes
  PORTALS: '/portals',
  PORTAL_DETAIL: (id: string) => `/portals/${id}`,
  BRAND_DETAIL: (portalId: string, brandId: string) => `/portals/${portalId}/brands/${brandId}`,
  BRANDS: '/brands',
  PLANS: '/plans',
  ADMIN_SKUS: '/admin/skus',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_PACKAGES: '/admin/packages',
  ADMIN_PROGRAMS: '/admin/programs',
  ADMIN_API_KEYS: '/admin/api-keys',
} as const;
