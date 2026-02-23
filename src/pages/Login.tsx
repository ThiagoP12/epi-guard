import { useState } from 'react';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, nome);
      if (error) {
        setError(error);
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      }
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
          <h1 className="text-xl font-bold text-foreground tracking-tight">Gestão de EPI & EPC</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {isLogin ? 'Acesse sua conta para continuar' : 'Criar nova conta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          {!isLogin && (
            <div className="animate-fade-in">
              <Label className="text-xs font-medium">Nome completo</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required={!isLogin}
                className="mt-1.5 h-10"
              />
            </div>
          )}
          <div>
            <Label className="text-xs font-medium">E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="mt-1.5 h-10"
              autoComplete="email"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Senha</Label>
            <div className="relative mt-1.5">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="h-10 pr-10"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg status-danger text-xs animate-fade-in font-medium">{error}</div>
          )}
          {success && (
            <div className="p-3 rounded-lg status-ok text-xs animate-fade-in font-medium">{success}</div>
          )}

          <Button type="submit" className="w-full h-10 font-semibold text-sm" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Aguarde...
              </span>
            ) : isLogin ? 'Entrar' : 'Criar conta'}
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
              className="text-primary font-semibold hover:underline underline-offset-2 transition-colors"
            >
              {isLogin ? 'Criar conta' : 'Fazer login'}
            </button>
          </p>
        </form>

        <p className="text-center text-[10px] text-muted-foreground/60 mt-6">
          Sistema de Segurança do Trabalho
        </p>
      </div>
    </div>
  );
}
