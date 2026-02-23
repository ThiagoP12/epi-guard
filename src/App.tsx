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
import HistoricoEntregas from "./pages/HistoricoEntregas";
import ControleEPC from "./pages/ControleEPC";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Solicitacoes from "./pages/Solicitacoes";
import Auditoria from "./pages/Auditoria";
import AdminTenants from "./pages/AdminTenants";
import PortalColaborador from "./pages/PortalColaborador";
import NotFound from "./pages/NotFound";
import { Shield, Clock, Building2, LogOut } from "lucide-react";
import { Button } from "./components/ui/button";
import { supabase } from "./integrations/supabase/client";

const queryClient = new QueryClient();

function PendingApproval() {
  const { signOut, refetchProfile } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm text-center animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-5">
          <Clock className="text-amber-600" size={32} />
        </div>
        <h1 className="text-lg font-bold text-foreground">Aguardando Aprovação</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Sua empresa foi cadastrada com sucesso e está aguardando aprovação do administrador da plataforma.
          Você receberá acesso assim que a aprovação for concedida.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => refetchProfile()} className="gap-1.5">
            <Clock size={14} /> Verificar status
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-muted-foreground">
            <LogOut size={14} /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

function NeedsTenantSetup() {
  const { signOut } = useAuth();
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaCnpj, setEmpresaCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { refetchProfile } = useAuth();

  const handleRegister = async () => {
    if (!empresaNome.trim()) {
      setError('Nome da empresa é obrigatório');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('register-tenant', {
        body: { empresa_nome: empresaNome, empresa_cnpj: empresaCnpj },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSuccess(true);
      await refetchProfile();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (success) return <PendingApproval />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="text-primary" size={26} />
          </div>
          <h1 className="text-lg font-bold text-foreground">Cadastrar Empresa</h1>
          <p className="text-xs text-muted-foreground mt-1">Vincule uma empresa à sua conta para começar</p>
        </div>
        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-medium">Nome da Empresa *</label>
            <input value={empresaNome} onChange={e => setEmpresaNome(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5" placeholder="Empresa Ltda" />
          </div>
          <div>
            <label className="text-xs font-medium">CNPJ</label>
            <input value={empresaCnpj} onChange={e => setEmpresaCnpj(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5" placeholder="00.000.000/0000-00" />
          </div>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium">{error}</div>}
          <Button onClick={handleRegister} disabled={loading} className="w-full h-10 font-semibold text-sm">
            {loading ? 'Cadastrando...' : 'Cadastrar Empresa'}
          </Button>
          <button onClick={signOut} className="w-full text-xs text-muted-foreground hover:text-foreground text-center mt-2">
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}

// Need to import useState for NeedsTenantSetup
import { useState } from "react";

function ProtectedRoutes() {
  const { user, loading, role, roles, empresaAprovada } = useAuth();

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

  // User has no role and no empresa → needs to register a tenant
  if (!role && empresaAprovada === null) {
    return <NeedsTenantSetup />;
  }

  // User has empresa but not approved
  if (empresaAprovada === false) {
    return <PendingApproval />;
  }

  // Colaborador role goes to portal
  if (role === 'colaborador') {
    return <PortalColaborador />;
  }

  return (
    <EmpresaProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/colaboradores" element={<Colaboradores />} />
          <Route path="/solicitacoes" element={<Solicitacoes />} />
          <Route path="/historico-entregas" element={<HistoricoEntregas />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/controle-epc" element={<ControleEPC />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          {roles.includes('super_admin') && (
            <Route path="/admin-tenants" element={<AdminTenants />} />
          )}
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
