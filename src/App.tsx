import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Settings, Shield, Store } from "lucide-react";

import { useInitAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/app/Dashboard";
import Contacts from "@/pages/app/Contacts";
import ContactDetail from "@/pages/app/ContactDetail";
import Pipeline from "@/pages/app/Pipeline";
import Whatsapp from "@/pages/app/Whatsapp";
import AiInbox from "@/pages/app/AiInbox";
import Automations from "@/pages/app/Automations";
import Reports from "@/pages/app/Reports";
import { Stub } from "@/pages/app/Stub";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  useInitAuth();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
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
          <ProtectedRoute requireRoles={["tenant_admin", "super_admin"]}>
            <Stub icon={Settings} title="Configuración" description="Equipo, instancia, integraciones y facturación" />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute requireRoles={["super_admin"]}>
            <Stub icon={Shield} title="SuperAdmin" description="Gestión global de cuentas, planes y observabilidad" />
          </ProtectedRoute>
        } />
        <Route path="/marketplace" element={<Stub icon={Store} title="Marketplace" description="Módulos add-on: pagos, envíos, integraciones verticales" />} />
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
