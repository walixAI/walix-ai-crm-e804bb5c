import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useInitAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Dashboard from "@/pages/app/Dashboard";
import Contacts from "@/pages/app/Contacts";
import ContactDetail from "@/pages/app/ContactDetail";
import Pipeline from "@/pages/app/Pipeline";
import Whatsapp from "@/pages/app/Whatsapp";
import AiInbox from "@/pages/app/AiInbox";
import Automations from "@/pages/app/Automations";
import Reports from "@/pages/app/Reports";
import Settings from "@/pages/app/Settings";
import SuperAdmin from "@/pages/app/SuperAdmin";
import Organization from "@/pages/app/Organization";
import Platform from "@/pages/app/Platform";
import Marketplace from "@/pages/app/Marketplace";
import { Stub } from "@/pages/app/Stub";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  useInitAuth();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/pipeline" element={<Pipeline />} />
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
        <Route path="/marketplace" element={<Marketplace />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
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
