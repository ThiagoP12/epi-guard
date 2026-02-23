import { useState } from 'react';
import { Shield } from 'lucide-react';
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
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-3">
            <Shield className="text-primary-foreground" size={24} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Gestão de EPI & EPC</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? 'Acesse sua conta' : 'Criar nova conta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-5 space-y-4">
          {!isLogin && (
            <div>
              <Label>Nome completo</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required={!isLogin}
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-md status-danger text-xs">{error}</div>
          )}
          {success && (
            <div className="p-2.5 rounded-md status-ok text-xs">{success}</div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
              className="text-primary font-medium hover:underline"
            >
              {isLogin ? 'Criar conta' : 'Fazer login'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
