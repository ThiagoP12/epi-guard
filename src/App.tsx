import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Colaboradores from "./pages/Colaboradores";
import EntregaEPI from "./pages/EntregaEPI";
import ControleEPC from "./pages/ControleEPC";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Revendas from "./pages/Revendas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <EmpresaProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/colaboradores" element={<Colaboradores />} />
          <Route path="/entrega-epi" element={<EntregaEPI />} />
          <Route path="/controle-epc" element={<ControleEPC />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/revendas" element={<Revendas />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </EmpresaProvider>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
