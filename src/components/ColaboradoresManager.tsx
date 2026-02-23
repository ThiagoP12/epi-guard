import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Search, Loader2, Users, User, Mail, KeyRound, CheckCircle,
  XCircle, ExternalLink, Shield,
} from 'lucide-react';

interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  cpf: string | null;
  setor: string;
  funcao: string;
  email: string | null;
  ativo: boolean;
  user_id: string | null;
}

export default function ColaboradoresManager() {
  const { toast } = useToast();
  const { selectedEmpresa } = useEmpresa();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create account dialog
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountColab, setAccountColab] = useState<Colaborador | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from('colaboradores')
      .select('id, nome, matricula, cpf, setor, funcao, email, ativo, user_id')
      .eq('ativo', true)
      .order('nome');
    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);
    const { data } = await query;
    if (data) setColaboradores(data as Colaborador[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEmpresa]);

  const openCreateAccount = (c: Colaborador) => {
    setAccountColab(c);
    setAccountEmail(c.email || '');
    setAccountPassword('');
    setAccountOpen(true);
  };

  const handleCreateAccount = async () => {
    if (!accountColab || !accountEmail || !accountPassword) {
      toast({ title: 'Preencha e-mail e senha', variant: 'destructive' });
      return;
    }
    if (accountPassword.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setAccountSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-colaborador-account', {
        body: { colaboradorId: accountColab.id, email: accountEmail, password: accountPassword },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      toast({ title: 'Conta criada!', description: `Login: ${accountEmail}` });
      setAccountOpen(false);
      await load();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setAccountSubmitting(false);
  };

  const filtered = colaboradores.filter(c =>
    !search ||
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.matricula.toLowerCase().includes(search.toLowerCase()) ||
    c.setor.toLowerCase().includes(search.toLowerCase())
  );

  const withAccount = colaboradores.filter(c => c.user_id).length;
  const withoutAccount = colaboradores.filter(c => !c.user_id).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Users size={18} /> Colaboradores — Portal
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gerencie o acesso dos colaboradores ao portal. Colaboradores com conta podem fazer solicitações de EPI.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : colaboradores.length}</p>
        </div>
        <div className="bg-card rounded-lg border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Com acesso</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{loading ? '—' : withAccount}</p>
        </div>
        <div className="bg-card rounded-lg border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sem acesso</p>
          <p className="text-xl font-bold text-muted-foreground mt-1">{loading ? '—' : withoutAccount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, matrícula ou setor..." className="pl-9 h-9" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <Users size={32} className="text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => (
            <div key={c.id} className="bg-card rounded-lg border shadow-sm p-3 flex items-center gap-3 hover:border-primary/20 transition-colors">
              {/* Avatar placeholder */}
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User size={16} className="text-muted-foreground/50" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {c.setor} • {c.funcao} • Mat: {c.matricula}
                </p>
              </div>

              {/* Status */}
              {c.user_id ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1 shrink-0">
                  <CheckCircle size={10} /> Com acesso
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-muted text-muted-foreground border-border gap-1 shrink-0">
                  <XCircle size={10} /> Sem acesso
                </Badge>
              )}

              {/* Action */}
              {isAdmin && !c.user_id && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => openCreateAccount(c)}>
                  <KeyRound size={12} /> Criar acesso
                </Button>
              )}
              {c.user_id && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                  <ExternalLink size={10} /> Portal ativo
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Account Dialog */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound size={16} /> Criar Acesso ao Portal
            </DialogTitle>
          </DialogHeader>
          {accountColab && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium">{accountColab.nome}</p>
                <p className="text-[11px] text-muted-foreground">{accountColab.setor} • {accountColab.funcao} • Mat: {accountColab.matricula}</p>
              </div>
              <div>
                <Label className="text-xs">E-mail de acesso *</Label>
                <Input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} className="mt-1 h-9" placeholder="colaborador@empresa.com" />
              </div>
              <div>
                <Label className="text-xs">Senha *</Label>
                <Input type="password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} className="mt-1 h-9" placeholder="Mín. 6 caracteres" />
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Shield size={10} /> O colaborador poderá acessar o portal e solicitar EPIs
              </p>
              <Button className="w-full h-9 font-medium" onClick={handleCreateAccount} disabled={accountSubmitting}>
                {accountSubmitting ? <><Loader2 size={14} className="animate-spin mr-1" /> Criando...</> : 'Criar Acesso'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
