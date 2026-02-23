import { useState } from 'react';
import { Shield, Eye, EyeOff, Building2, Loader2, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type Mode = 'login' | 'signup' | 'register-empresa';

export default function Login() {
  const { signIn, signUp, refetchProfile } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaCnpj, setEmpresaCnpj] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Resolve login identifier: if it looks like a CPF (digits only), convert to email format
  const resolveEmail = (input: string) => {
    const digits = input.replace(/\D/g, '');
    if (digits.length === 11 && !/[@]/.test(input)) {
      return `${digits}@portal.local`;
    }
    return input;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const resolvedEmail = resolveEmail(email);
    const { error } = await signIn(resolvedEmail, password);
    if (error) setError(error);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!empresaNome.trim()) {
      setError('Nome da empresa é obrigatório.');
      setLoading(false);
      return;
    }

    // 1. Create auth account
    const { error: signUpError } = await signUp(email, password, nome);
    if (signUpError) {
      setError(signUpError);
      setLoading(false);
      return;
    }

    // 2. Sign in immediately to get session
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      // Email might need verification
      setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro. Após confirmar, faça login para cadastrar sua empresa.');
      setLoading(false);
      return;
    }

    // 3. Register tenant via edge function
    try {
      const { data, error: fnError } = await supabase.functions.invoke('register-tenant', {
        body: { empresa_nome: empresaNome, empresa_cnpj: empresaCnpj },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      await refetchProfile();
      setSuccess('Empresa cadastrada com sucesso! Aguarde a aprovação do administrador da plataforma.');
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar empresa');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20">
            <Shield className="text-primary-foreground" size={26} />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Gestão de EPIs</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {mode === 'login' ? 'Acesse sua conta para continuar' : 'Cadastre sua empresa'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
            <div>
              <Label className="text-xs font-medium">CPF</Label>
              <Input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="000.000.000-00" required className="mt-1.5 h-10" autoComplete="username" inputMode="numeric" />
            </div>
            <div>
              <Label className="text-xs font-medium">Senha</Label>
              <div className="relative mt-1.5">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10 pr-10" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium animate-fade-in">{error}</div>}

            <Button type="submit" className="w-full h-10 font-semibold text-sm" disabled={loading}>
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Aguarde...</> : 'Entrar'}
            </Button>

          </form>
        ) : (
          <form onSubmit={handleSignup} className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
            <div className="bg-muted/40 rounded-lg p-3 border flex items-start gap-2.5">
              <Building2 size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Cadastro de Nova Empresa</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sua conta será criada como administrador. A empresa ficará pendente de aprovação.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Nome da Empresa *</Label>
                <Input value={empresaNome} onChange={e => setEmpresaNome(e.target.value)} placeholder="Empresa Ltda" required className="mt-1.5 h-10" />
              </div>
              <div>
                <Label className="text-xs font-medium">CNPJ</Label>
                <Input value={empresaCnpj} onChange={e => setEmpresaCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="mt-1.5 h-10" />
              </div>
            </div>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground uppercase tracking-wider">Dados do Administrador</span></div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Nome completo *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" required className="mt-1.5 h-10" />
              </div>
              <div>
                <Label className="text-xs font-medium">E-mail *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required className="mt-1.5 h-10" autoComplete="email" />
              </div>
              <div>
                <Label className="text-xs font-medium">Senha *</Label>
                <div className="relative mt-1.5">
                  <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10 pr-10" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium animate-fade-in">{error}</div>}
            {success && <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium animate-fade-in">{success}</div>}

            <Button type="submit" className="w-full h-10 font-semibold text-sm" disabled={loading}>
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Cadastrando...</> : 'Cadastrar Empresa'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Já tem conta?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="text-primary font-semibold hover:underline underline-offset-2">
                Fazer login
              </button>
            </p>
          </form>
        )}

        <p className="text-center text-[10px] text-muted-foreground/60 mt-6">
          Sistema de Segurança do Trabalho • Multi-Tenant
        </p>
      </div>
    </div>
  );
}
