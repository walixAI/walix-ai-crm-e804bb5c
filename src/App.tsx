import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Users, KanbanSquare, MessageCircle, BarChart3, Zap, Settings, Shield, Store
} from "lucide-react";

import { useInitAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import RootRedirect from "@/pages/app/RootRedirect";
import Dashboard from "@/pages/app/Dashboard";
import { Stub } from "@/pages/app/Stub";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  useInitAuth();
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contacts" element={<Stub icon={Users} title="Contactos" description="Vista 360° de tus clientes y prospectos" badge="2,481 activos" />} />
        <Route path="/contacts/:id" element={<Stub icon={Users} title="Detalle de contacto" description="Historial completo, conversaciones, oportunidades y notas" />} />
        <Route path="/pipeline" element={<Stub icon={KanbanSquare} title="Pipeline" description="Tablero Kanban arrastrar-y-soltar de oportunidades" badge="287 deals" />} />
        <Route path="/whatsapp" element={<Stub icon={MessageCircle} title="WhatsApp" description="Bandeja unificada multi-agente con IA" badge="12 sin leer" />} />
        <Route path="/reports" element={<Stub icon={BarChart3} title="Reportes & Analytics" description="Métricas en tiempo real, embudos y exportables" />} />
        <Route path="/automations" element={<Stub icon={Zap} title="Automatizaciones" description="Flujos no-code: triggers, condiciones y acciones con IA" />} />
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
