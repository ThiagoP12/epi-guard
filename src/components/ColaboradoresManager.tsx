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
import { format } from 'date-fns';
import {
  Search, Loader2, Users, User, Mail, KeyRound, CheckCircle,
  XCircle, ExternalLink, Shield, Eye, EyeOff, Filter, Briefcase,
  MapPin, Hash, Calendar, CreditCard, Phone,
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
  data_admissao: string;
  tamanho_uniforme: string | null;
  tamanho_bota: string | null;
  tamanho_luva: string | null;
  centro_custo: string | null;
}

type FilterStatus = 'todos' | 'com_acesso' | 'sem_acesso';

export default function ColaboradoresManager() {
  const { toast } = useToast();
  const { selectedEmpresa } = useEmpresa();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailColab, setDetailColab] = useState<Colaborador | null>(null);

  // Create account dialog
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountColab, setAccountColab] = useState<Colaborador | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from('colaboradores')
      .select('id, nome, matricula, cpf, setor, funcao, email, ativo, user_id, data_admissao, tamanho_uniforme, tamanho_bota, tamanho_luva, centro_custo')
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
    setShowPassword(false);
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

  const withAccount = colaboradores.filter(c => c.user_id).length;
  const withoutAccount = colaboradores.filter(c => !c.user_id).length;

  const filtered = colaboradores.filter(c => {
    if (filterStatus === 'com_acesso' && !c.user_id) return false;
    if (filterStatus === 'sem_acesso' && c.user_id) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.nome.toLowerCase().includes(s) ||
      c.matricula.toLowerCase().includes(s) ||
      c.setor.toLowerCase().includes(s) ||
      c.funcao.toLowerCase().includes(s) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.cpf && c.cpf.includes(s))
    );
  });

  const formatCpf = (cpf: string | null) => {
    if (!cpf) return '—';
    const d = cpf.replace(/\D/g, '');
    if (d.length !== 11) return cpf;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy'); } catch { return d; }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Users size={18} /> Colaboradores — Portal
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gerencie o acesso dos colaboradores ao portal. Clique em um colaborador para ver detalhes.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'todos' as FilterStatus, label: 'Total', value: colaboradores.length, icon: Users, color: 'text-foreground', bg: 'bg-muted' },
          { key: 'com_acesso' as FilterStatus, label: 'Com acesso', value: withAccount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
          { key: 'sem_acesso' as FilterStatus, label: 'Sem acesso', value: withoutAccount, icon: XCircle, color: 'text-amber-600', bg: 'bg-amber-500/10' },
        ]).map(kpi => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.key}
              onClick={() => setFilterStatus(filterStatus === kpi.key ? 'todos' : kpi.key)}
              className={cn(
                "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                filterStatus === kpi.key && kpi.key !== 'todos' && "border-primary ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <p className={cn("text-[10px] font-semibold uppercase tracking-wider", kpi.color)}>{kpi.label}</p>
                <div className={cn("p-1 rounded-md", kpi.bg)}>
                  <Icon size={12} className={kpi.color} />
                </div>
              </div>
              <p className={cn("text-xl font-bold mt-0.5", kpi.color)}>{loading ? '—' : kpi.value}</p>
              {kpi.key === 'sem_acesso' && kpi.value > 0 && (
                <p className="text-[9px] text-muted-foreground mt-1">Clique para filtrar</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + filter indicator */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, matrícula, setor, CPF..." className="pl-9 h-9" />
        </div>
        {filterStatus !== 'todos' && (
          <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setFilterStatus('todos')}>
            <Filter size={11} />
            {filterStatus === 'com_acesso' ? 'Com acesso' : 'Sem acesso'}
            <XCircle size={11} className="ml-0.5" />
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} resultado(s)</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-10 text-center">
          <Users size={36} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum colaborador encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filterStatus !== 'todos' ? 'Tente mudar o filtro ou buscar por outro termo.' : 'Cadastre colaboradores na aba Colaboradores.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => (
            <div
              key={c.id}
              className="bg-card rounded-lg border shadow-sm hover:border-primary/30 transition-colors cursor-pointer overflow-hidden"
              onClick={() => { setDetailColab(c); setDetailOpen(true); }}
            >
              <div className="flex items-center">
                {/* Status bar */}
                <div className={cn("w-1 self-stretch shrink-0", c.user_id ? 'bg-emerald-500' : 'bg-muted-foreground/20')} />

                <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                    c.user_id ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground/50"
                  )}>
                    {c.nome.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><MapPin size={10} /> {c.setor}</span>
                      <span className="flex items-center gap-0.5"><Briefcase size={10} /> {c.funcao}</span>
                      <span className="flex items-center gap-0.5"><Hash size={10} /> {c.matricula}</span>
                      {c.email && <span className="flex items-center gap-0.5"><Mail size={10} /> {c.email}</span>}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {c.user_id ? (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-auto bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
                        <CheckCircle size={10} /> Portal ativo
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-auto bg-muted text-muted-foreground border-border gap-1">
                          <XCircle size={10} /> Sem acesso
                        </Badge>
                        {isAdmin && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-[11px] gap-1 shrink-0"
                            onClick={(e) => { e.stopPropagation(); openCreateAccount(c); }}
                          >
                            <KeyRound size={11} /> Criar acesso
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <User size={18} /> Detalhes do Colaborador
            </DialogTitle>
          </DialogHeader>
          {detailColab && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="flex items-center gap-3 pb-3 border-b">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                  detailColab.user_id ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground/50"
                )}>
                  {detailColab.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{detailColab.nome}</p>
                  <p className="text-xs text-muted-foreground">{detailColab.setor} • {detailColab.funcao}</p>
                </div>
                {detailColab.user_id ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
                    <CheckCircle size={10} /> Portal ativo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border gap-1">
                    <XCircle size={10} /> Sem acesso
                  </Badge>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem icon={Hash} label="Matrícula" value={detailColab.matricula} />
                <InfoItem icon={CreditCard} label="CPF" value={formatCpf(detailColab.cpf)} mono />
                <InfoItem icon={MapPin} label="Setor" value={detailColab.setor} />
                <InfoItem icon={Briefcase} label="Função" value={detailColab.funcao} />
                <InfoItem icon={Mail} label="E-mail" value={detailColab.email || '—'} />
                <InfoItem icon={Calendar} label="Admissão" value={formatDate(detailColab.data_admissao)} />
                {detailColab.centro_custo && <InfoItem icon={CreditCard} label="Centro de Custo" value={detailColab.centro_custo} />}
              </div>

              {/* Sizes */}
              {(detailColab.tamanho_uniforme || detailColab.tamanho_bota || detailColab.tamanho_luva) && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tamanhos</p>
                  <div className="flex gap-4 text-xs">
                    {detailColab.tamanho_uniforme && <span><strong>Uniforme:</strong> {detailColab.tamanho_uniforme}</span>}
                    {detailColab.tamanho_bota && <span><strong>Bota:</strong> {detailColab.tamanho_bota}</span>}
                    {detailColab.tamanho_luva && <span><strong>Luva:</strong> {detailColab.tamanho_luva}</span>}
                  </div>
                </div>
              )}

              {/* Portal action */}
              {!detailColab.user_id && isAdmin && (
                <div className="border-t pt-3">
                  <Button
                    className="w-full h-9 gap-1.5"
                    onClick={() => { setDetailOpen(false); openCreateAccount(detailColab); }}
                  >
                    <KeyRound size={14} /> Criar Acesso ao Portal
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                    <Shield size={10} /> O colaborador poderá solicitar EPIs pelo portal
                  </p>
                </div>
              )}

              {detailColab.user_id && (
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/5 rounded-lg px-3 py-2.5">
                    <CheckCircle size={14} />
                    <div>
                      <p className="font-medium">Acesso ao portal ativo</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">Este colaborador pode fazer login e solicitar EPIs.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                  {accountColab.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{accountColab.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{accountColab.setor} • {accountColab.funcao} • Mat: {accountColab.matricula}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs">E-mail de acesso *</Label>
                <div className="relative mt-1">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} className="h-9 pl-9" placeholder="colaborador@empresa.com" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Senha *</Label>
                <div className="relative mt-1">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={accountPassword}
                    onChange={e => setAccountPassword(e.target.value)}
                    className="h-9 pl-9 pr-9"
                    placeholder="Mín. 6 caracteres"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <Shield size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  O colaborador receberá acesso ao <strong>Portal do Colaborador</strong>, onde poderá visualizar seus EPIs e fazer novas solicitações.
                </p>
              </div>
              <Button className="w-full h-10 font-medium gap-1.5" onClick={handleCreateAccount} disabled={accountSubmitting}>
                {accountSubmitting ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : <><KeyRound size={14} /> Criar Acesso</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Icon size={10} /> {label}</p>
      <p className={cn("text-xs font-medium text-foreground", mono && "font-mono")}>{value}</p>
    </div>
  );
}
