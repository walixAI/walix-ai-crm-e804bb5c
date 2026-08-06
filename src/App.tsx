import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useInitAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ErrorBoundary } from "@/components/walix/ErrorBoundary";
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";

// Eager: rutas críticas / pequeñas
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/app/Dashboard";
import Contacts from "@/pages/app/Contacts";
import NotFound from "@/pages/NotFound";
import RootRedirect from "@/pages/app/RootRedirect";
import { useAuth } from "@/hooks/useAuth";

// Lazy: rutas pesadas
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const ContactDetail = lazy(() => import("@/pages/app/ContactDetail"));
const Pipeline = lazy(() => import("@/pages/app/Pipeline"));
const Whatsapp = lazy(() => import("@/pages/app/Whatsapp"));
const AiInbox = lazy(() => import("@/pages/app/AiInbox"));
const Automations = lazy(() => import("@/pages/app/Automations"));
const Reports = lazy(() => import("@/pages/app/Reports"));
const Settings = lazy(() => import("@/pages/app/Settings"));
const SuperAdmin = lazy(() => import("@/pages/app/SuperAdmin"));
const Organization = lazy(() => import("@/pages/app/Organization"));
const Platform = lazy(() => import("@/pages/app/Platform"));
const AIMetrics = lazy(() => import("@/pages/app/admin/AIMetrics"));
const Marketplace = lazy(() => import("@/pages/app/Marketplace"));
const Tasks = lazy(() => import("@/pages/app/Tasks"));
const Profile = lazy(() => import("@/pages/app/Profile"));
const MiDia = lazy(() => import("@/pages/app/MiDia"));
const Expenses = lazy(() => import("@/pages/app/Expenses"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const Team = lazy(() => import("@/pages/app/Team"));
const WhatsappSim = lazy(() => import("@/pages/app/WhatsappSim"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center" role="status" aria-label="Cargando">
      <LoadingSpinner />
    </div>
  );
}

function LandingOrHome() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <RootRedirect />;
  return <Landing />;
}

const AppRoutes = () => {
  useInitAuth();
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/" element={<LandingOrHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mi-dia" element={<MiDia />} />
        <Route path="/wa-sim" element={<WhatsappSim />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/gastos" element={<Expenses />} />
        <Route path="/equipo" element={<Team />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/whatsapp" element={<Whatsapp />} />
        <Route path="/ai-inbox" element={<AiInbox />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/automations" element={<Automations />} />
        <Route path="/settings" element={
          <ProtectedRoute requireRoles={["tenant_admin", "tenant_owner", "platform_owner", "platform_staff", "super_admin"]}>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/org" element={
          <ProtectedRoute requireRoles={["org_owner", "platform_owner", "platform_staff", "super_admin"]}>
            <Organization />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute requireRoles={["platform_owner", "platform_staff", "super_admin"]}>
            <SuperAdmin />
          </ProtectedRoute>
        } />
        <Route path="/platform" element={
          <ProtectedRoute requireRoles={["platform_owner", "platform_staff", "super_admin"]}>
            <Platform />
          </ProtectedRoute>
        } />
        <Route path="/admin/ai-metrics" element={
          <ProtectedRoute requireRoles={["platform_owner", "platform_staff", "super_admin"]}>
            <AIMetrics />
          </ProtectedRoute>
        } />
        <Route path="/marketplace" element={<Marketplace />} />
      </Route>

      <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
