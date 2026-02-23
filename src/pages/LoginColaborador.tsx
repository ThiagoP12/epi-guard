import { useState } from 'react';
import { HardHat, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function LoginColaborador() {
  const { signIn } = useAuth();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) {
      setError('CPF inválido. Digite os 11 dígitos.');
      setLoading(false);
      return;
    }
    const email = `${digits}@portal.local`;
    const { error } = await signIn(email, password);
    if (error) setError('CPF ou senha incorretos.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20">
            <HardHat className="text-primary-foreground" size={26} />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Portal do Colaborador</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Acesse com seu CPF e senha</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <div>
            <Label className="text-xs font-medium">CPF</Label>
            <Input
              type="text"
              value={cpf}
              onChange={e => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              required
              className="mt-1.5 h-10"
              inputMode="numeric"
              autoComplete="username"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Senha</Label>
            <div className="relative mt-1.5">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="h-10 pr-10"
                autoComplete="current-password"
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
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium animate-fade-in">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-10 font-semibold text-sm" disabled={loading}>
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Aguarde...</> : 'Entrar'}
          </Button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground/60 mt-6">
          Portal do Colaborador • Gestão de EPIs
        </p>
      </div>
    </div>
  );
}
