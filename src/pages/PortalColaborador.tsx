import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/useTheme';
import SignatureCanvas from '@/components/SignatureCanvas';
import SelfieCapture from '@/components/SelfieCapture';
import ComprovanteSolicitacao from '@/components/ComprovanteSolicitacao';
import {
  LogOut, Package, History, ClipboardCheck, CheckCircle, Clock, XCircle,
  Loader2, FileText, User, Building2, Hash,
  Camera, PenTool, Send, AlertTriangle, HardHat, Eye, Shield, ImagePlus,
  Sun, Moon, Bell, UserCircle, Mail, Briefcase, Ruler, Footprints, Hand
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays, parseISO } from 'date-fns';

interface Colaborador {
  id: string; nome: string; matricula: string; cpf: string | null; email: string | null;
  setor: string; funcao: string; empresa_id: string | null;
  empresa?: { nome: string } | null;
  tamanho_uniforme?: string | null; tamanho_bota?: string | null; tamanho_luva?: string | null;
  data_admissao?: string | null; centro_custo?: string | null;
}
interface Produto { id: string; nome: string; ca: string | null; tipo: string; saldo: number; tamanho: string | null; marca: string | null; data_validade: string | null; }
interface Solicitacao {
  id: string; produto_id: string; quantidade: number; motivo: string; observacao: string | null;
  status: string; created_at: string; motivo_rejeicao: string | null;
  aprovado_em?: string | null;
  assinatura_base64?: string | null;
  selfie_base64?: string | null;
  ip_origem?: string | null;
  user_agent?: string | null;
  pdf_hash?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  assinado_em?: string | null;
  cpf_colaborador?: string | null;
  email_colaborador?: string | null;
  produto?: { nome: string; ca: string | null };
}
interface EntregaItem { nome_snapshot: string; ca_snapshot: string | null; quantidade: number; }
interface Entrega {
  id: string; data_hora: string; motivo: string; observacao: string | null;
  itens: EntregaItem[];
}

export default function PortalColaborador() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'solicitar' | 'historico' | 'recebimentos' | 'perfil'>('solicitar');
  const { theme, toggleTheme } = useTheme();
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('Solicitação');
  const [observacao, setObservacao] = useState('');
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [declaracao, setDeclaracao] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comprovanteOpen, setComprovanteOpen] = useState(false);
  const [comprovanteSolicitacao, setComprovanteSolicitacao] = useState<Solicitacao | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user) return;
    let colabId: string | null = null;

    const load = async () => {
      const { data: colab } = await supabase
        .from('colaboradores')
        .select('id, nome, matricula, cpf, email, setor, funcao, empresa_id, tamanho_uniforme, tamanho_bota, tamanho_luva, data_admissao, centro_custo, empresas:empresa_id(nome)')
        .eq('user_id', user.id)
        .single();

      if (!colab) { setLoading(false); return; }
      const colabData = { ...colab, empresa: (colab as any).empresas } as Colaborador;
      setColaborador(colabData);
      colabId = colabData.id;

      let prodQuery = supabase.from('produtos').select('*').eq('ativo', true).order('nome');
      const { data: prods } = await prodQuery;
      if (prods) {
        const withSaldo: Produto[] = [];
        for (const p of prods) {
          const { data: saldo } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
          if (typeof saldo === 'number' && saldo > 0) {
            withSaldo.push({ id: p.id, nome: p.nome, ca: p.ca, tipo: p.tipo, saldo, tamanho: p.tamanho, marca: p.marca, data_validade: p.data_validade });
          }
        }
        setProdutos(withSaldo);
      }

      await loadSolicitacoes(colabData.id);
      await loadEntregas(colabData.id);

      // Load avatar
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

      setLoading(false);
    };
    load();

    // Realtime: auto-refresh when solicitacoes or entregas change
    const channel = supabase
      .channel('portal-solicitacoes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_epi' },
        () => {
          if (colabId) {
            loadSolicitacoes(colabId);
            loadEntregas(colabId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregas_epi' },
        () => {
          if (colabId) loadEntregas(colabId);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadEntregas = async (colabId: string) => {
    const { data } = await supabase
      .from('entregas_epi')
      .select('id, data_hora, motivo, observacao')
      .eq('colaborador_id', colabId)
      .order('data_hora', { ascending: false });

    if (data && data.length > 0) {
      const entregaIds = data.map(e => e.id);
      const { data: itens } = await supabase
        .from('entrega_epi_itens')
        .select('entrega_id, nome_snapshot, ca_snapshot, quantidade')
        .in('entrega_id', entregaIds);

      const enriched: Entrega[] = data.map(e => ({
        ...e,
        itens: (itens?.filter(i => i.entrega_id === e.id) || []) as EntregaItem[],
      }));
      setEntregas(enriched);
    } else {
      setEntregas([]);
    }
  };

  const loadSolicitacoes = async (colabId: string) => {
    const { data } = await supabase
      .from('solicitacoes_epi')
      .select('id, produto_id, quantidade, motivo, observacao, status, created_at, motivo_rejeicao, aprovado_em, assinatura_base64, selfie_base64, ip_origem, user_agent, pdf_hash, geo_latitude, geo_longitude, assinado_em, cpf_colaborador, email_colaborador')
      .eq('colaborador_id', colabId)
      .order('created_at', { ascending: false });

    if (data) {
      const prodIds = [...new Set(data.map(s => s.produto_id))];
      let prodsInfo: { id: string; nome: string; ca: string | null }[] = [];
      if (prodIds.length > 0) {
        const { data: prods } = await supabase
          .from('produtos')
          .select('id, nome, ca')
          .in('id', prodIds);
        prodsInfo = prods || [];
      }

      const enriched = data.map(s => ({
        ...s,
        produto: prodsInfo.find(p => p.id === s.produto_id) || undefined,
      }));
      setSolicitacoes(enriched);
    }
  };

  const captureGeolocation = (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleSubmit = async () => {
    if (!produtoId || !assinatura || !selfie || !declaracao || !colaborador) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // Capture IP
      let ipOrigem = 'browser';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipOrigem = ipData.ip || 'browser';
      } catch { /* fallback */ }

      // Capture geolocation
      const geo = await captureGeolocation();

      const timestamp = new Date().toISOString();

      // Build hash with all audit data
      const hashInput = [
        assinatura, colaborador.id, colaborador.cpf || '', colaborador.email || '',
        produtoId, quantidade, motivo, timestamp, ipOrigem, navigator.userAgent,
        geo ? `${geo.lat},${geo.lng}` : 'no-geo'
      ].join('|');
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pdfHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('solicitacoes_epi').insert({
        colaborador_id: colaborador.id,
        empresa_id: colaborador.empresa_id,
        produto_id: produtoId,
        quantidade,
        motivo,
        observacao: observacao || null,
        assinatura_base64: assinatura,
        selfie_base64: selfie,
        declaracao_aceita: true,
        ip_origem: ipOrigem,
        user_agent: navigator.userAgent,
        pdf_hash: pdfHash,
        geo_latitude: geo?.lat ?? null,
        geo_longitude: geo?.lng ?? null,
        geo_accuracy: geo?.accuracy ?? null,
        assinado_em: timestamp,
        cpf_colaborador: colaborador.cpf || null,
        email_colaborador: colaborador.email || null,
      } as any);

      if (error) throw error;

      toast({ title: '✅ Solicitação enviada!', description: 'Aguarde a aprovação do gestor.' });
      setProdutoId('');
      setQuantidade(1);
      setMotivo('Solicitação');
      setObservacao('');
      setAssinatura(null);
      setSelfie(null);
      setDeclaracao(false);
      await loadSolicitacoes(colaborador.id);
      setActiveSection('historico');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const selectedProduct = produtos.find(p => p.id === produtoId);
  const pendingCount = solicitacoes.filter(s => s.status === 'ENVIADA').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm bg-card rounded-xl border shadow-sm p-8">
          <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-destructive" />
          </div>
          <h2 className="text-base font-bold text-foreground">Conta não vinculada</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Sua conta ainda não está vinculada a um cadastro de colaborador. Entre em contato com o administrador.
          </p>
          <Button variant="outline" className="mt-6 gap-2" onClick={signOut}>
            <LogOut size={15} /> Sair
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
    CRIADA: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted border-border', label: 'Criada' },
    ENVIADA: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', label: 'Enviada' },
    APROVADA: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', label: 'Aprovada' },
    REPROVADA: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', label: 'Reprovada' },
    EM_SEPARACAO: { icon: Package, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', label: 'Em Separação' },
    BAIXADA_NO_ESTOQUE: { icon: Package, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800', label: 'Baixada' },
    ENTREGUE: { icon: Package, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', label: 'Entregue' },
    CONFIRMADA: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', label: 'Confirmada' },
  };

  // Notifications: count recent status changes (approved/rejected/delivered in last 24h)
  const recentNotifications = solicitacoes.filter(s => {
    if (s.status === 'ENVIADA' || s.status === 'CRIADA') return false;
    const created = new Date(s.aprovado_em || s.created_at);
    return differenceInDays(new Date(), created) <= 7;
  });

  const navItems = [
    { key: 'solicitar' as const, label: 'Nova Solicitação', shortLabel: 'Solicitar', icon: ClipboardCheck, badge: 0 },
    { key: 'historico' as const, label: 'Minhas Solicitações', shortLabel: 'Histórico', icon: History, badge: pendingCount },
    { key: 'recebimentos' as const, label: 'Recebimentos', shortLabel: 'Recebidos', icon: Package, badge: entregas.length + solicitacoes.filter(s => ['ENTREGUE', 'CONFIRMADA'].includes(s.status)).length },
    { key: 'perfil' as const, label: 'Meu Perfil', shortLabel: 'Perfil', icon: UserCircle, badge: 0 },
  ];

  const initials = colaborador.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-16 sm:pb-0">
      {/* Top Bar - gradient */}
      <header className="bg-gradient-to-r from-primary to-primary/80 sticky top-0 z-20 shadow-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-11 sm:h-12">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
                <HardHat size={14} className="text-primary-foreground" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-primary-foreground">Portal EPI</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Notifications bell */}
              <button
                onClick={() => setActiveSection('historico')}
                className="relative p-2 rounded-lg text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                title="Notificações"
              >
                <Bell size={16} />
                {recentNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                )}
              </button>
              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero card */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 pb-2 sm:pt-5 sm:pb-3">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3">
            <label className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-xs sm:text-sm font-bold text-primary shrink-0 cursor-pointer group overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 size={14} className="text-white animate-spin" />
                ) : (
                  <Camera size={14} className="text-white" />
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !user) return;
                  if (file.size > 2 * 1024 * 1024) {
                    toast({ title: 'Arquivo muito grande', description: 'Máximo 2MB.', variant: 'destructive' });
                    return;
                  }
                  setUploadingAvatar(true);
                  try {
                    const ext = file.name.split('.').pop();
                    const path = `${user.id}/avatar.${ext}`;
                    const { error: uploadErr } = await supabase.storage
                      .from('avatars')
                      .upload(path, file, { upsert: true });
                    if (uploadErr) throw uploadErr;
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
                    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
                    setAvatarUrl(publicUrl);
                    toast({ title: '✅ Foto atualizada!' });
                  } catch (err: any) {
                    toast({ title: 'Erro ao enviar foto', description: err.message, variant: 'destructive' });
                  }
                  setUploadingAvatar(false);
                }}
              />
            </label>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-bold text-foreground truncate">
                Olá, {colaborador.nome.split(' ')[0]} 👋
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                {colaborador.funcao} • {colaborador.setor}
                {colaborador.empresa?.nome && <> • {colaborador.empresa.nome}</>}
              </p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive transition-colors text-xs px-3 py-2 rounded-lg border border-border hover:border-destructive/30 hover:bg-destructive/5 shrink-0"
              title="Sair"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <InfoPill icon={Hash} label="Mat" value={colaborador.matricula} />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex-1 w-full">
        {/* Tab Navigation - desktop only */}
        <div className="hidden sm:flex bg-card rounded-xl border shadow-sm mb-5 p-1 gap-1">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all rounded-lg',
                activeSection === item.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className={cn(
                  'text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1',
                  activeSection === item.key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-primary/10 text-primary'
                )}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        <div className="pb-6">
          {/* SOLICITAR */}
          {activeSection === 'solicitar' && (
            <div className="space-y-5 animate-in fade-in-0 duration-200">
              {/* Form Card */}
              <section className="bg-card rounded-xl border shadow-sm">
                <div className="px-5 py-4 border-b bg-primary/5">
                  <h3 className="text-sm font-semibold text-foreground">Dados da Solicitação</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Selecione o item e preencha as informações</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <Label className="text-xs font-medium">Item do Estoque *</Label>
                    {produtos.length === 0 ? (
                      <div className="mt-1.5 p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 text-center">
                        <Package size={20} className="mx-auto text-muted-foreground/40 mb-1.5" />
                        <p className="text-xs text-muted-foreground font-medium">Nenhum item disponível</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {!colaborador.empresa_id
                            ? 'Seu cadastro não está vinculado a uma empresa. Contate o administrador.'
                            : 'Não há produtos com saldo em estoque para sua empresa.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <Select value={produtoId} onValueChange={setProdutoId}>
                          <SelectTrigger className="mt-1.5 h-10">
                            <SelectValue placeholder="Selecionar equipamento..." />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{p.nome}</span>
                                  {p.tamanho && <span className="text-muted-foreground text-[10px] bg-muted px-1.5 py-0.5 rounded">Tam: {p.tamanho}</span>}
                                  {p.marca && <span className="text-muted-foreground text-[10px]">({p.marca})</span>}
                                  {p.ca && <span className="text-muted-foreground text-[10px] font-mono">CA: {p.ca}</span>}
                                  <span className="text-primary text-[10px] font-semibold ml-auto">{p.saldo} un</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedProduct && (
                          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Disponível: <strong className="text-primary">{selectedProduct.saldo} un</strong></span>
                            {selectedProduct.tamanho && <span>• Tamanho: <strong>{selectedProduct.tamanho}</strong></span>}
                            {selectedProduct.marca && <span>• Marca: <strong>{selectedProduct.marca}</strong></span>}
                            {selectedProduct.ca && <span>• CA: <strong>{selectedProduct.ca}</strong></span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium">Quantidade *</Label>
                      <Input
                        type="number" min={1} max={selectedProduct?.saldo || 999}
                        value={quantidade}
                        onChange={(e) => setQuantidade(Number(e.target.value))}
                        className="mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Motivo</Label>
                      <Select value={motivo} onValueChange={setMotivo}>
                        <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Solicitação', 'Troca por desgaste', 'Perda', 'Danificado'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Observação</Label>
                    <Textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Descreva o motivo detalhado (opcional)"
                      className="mt-1.5 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </section>

              {/* Selfie */}
              <section className="bg-card rounded-xl border shadow-sm">
                <div className="px-5 py-4 border-b bg-primary/5">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Camera size={14} className="text-primary" />
                    Selfie do Colaborador
                  </h3>
                </div>
                <div className="p-5">
                  <SelfieCapture onCaptureChange={setSelfie} />
                </div>
              </section>

              {/* Signature */}
              <section className="bg-card rounded-xl border shadow-sm">
                <div className="px-5 py-4 border-b bg-primary/5">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <PenTool size={14} className="text-primary" />
                    Assinatura Digital
                  </h3>
                </div>
                <div className="p-5">
                  <SignatureCanvas onSignatureChange={setAssinatura} />
                </div>
              </section>

              {/* Declaration + Submit */}
              <section className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-primary/5 border border-primary/10">
                  <Checkbox
                    id="declaracao"
                    checked={declaracao}
                    onCheckedChange={(v) => setDeclaracao(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="declaracao" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
                    <strong className="text-foreground">DECLARO</strong> que as informações prestadas são verdadeiras e que necessito do EPI solicitado para execução segura das minhas atividades.
                    Estou ciente de que a assinatura digital aqui aposta possui validade jurídica conforme a MP 2.200-2/2001 e que este documento é protegido por hash criptográfico SHA-256.
                  </label>
                </div>

                <Button
                  className="w-full h-11 text-sm font-semibold gap-2"
                  onClick={handleSubmit}
                  disabled={submitting || !produtoId || !assinatura || !selfie || !declaracao}
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                  ) : (
                    <><Send size={16} /> Enviar Solicitação</>
                  )}
                </Button>
              </section>
            </div>
          )}

          {/* HISTÓRICO */}
          {activeSection === 'historico' && (
            <div className="space-y-3 animate-in fade-in-0 duration-200">
              {solicitacoes.filter(s => !['ENTREGUE', 'CONFIRMADA'].includes(s.status)).length === 0 ? (
                <EmptyState icon={History} message="Nenhuma solicitação realizada ainda." sub="Suas solicitações de EPI aparecerão aqui." />
              ) : (
                solicitacoes.filter(s => !['ENTREGUE', 'CONFIRMADA'].includes(s.status)).map(s => {
                  const cfg = statusConfig[s.status] || statusConfig.ENVIADA;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={s.id} className="bg-card rounded-xl border shadow-sm p-4 transition-colors hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.produto?.nome || 'Produto'}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            {s.produto?.ca && <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">CA: {s.produto.ca}</span>}
                            <span>Qtde: {s.quantidade}</span>
                            <span className="text-border">|</span>
                            <span>{s.motivo}</span>
                          </div>
                        </div>
                        <span className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0 border',
                          cfg.bg, cfg.color
                        )}>
                          <StatusIcon size={12} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t">
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(s.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                        <div className="flex gap-1.5">
                          {['APROVADA', 'EM_SEPARACAO', 'BAIXADA_NO_ESTOQUE', 'ENTREGUE', 'CONFIRMADA'].includes(s.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2"
                              onClick={() => { setComprovanteSolicitacao(s); setComprovanteOpen(true); }}
                            >
                              <Eye size={12} /> Comprovante
                            </Button>
                          )}
                        </div>
                      </div>
                      {s.motivo_rejeicao && (
                        <div className="mt-2 p-2 rounded bg-destructive/5 border border-destructive/10">
                          <p className="text-[11px] text-destructive"><strong>Motivo:</strong> {s.motivo_rejeicao}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* RECEBIMENTOS */}
          {activeSection === 'recebimentos' && (
            <div className="space-y-3 animate-in fade-in-0 duration-200">
              {/* Summary - combine entregas + solicitações entregues */}
              {(() => {
                const totals: { nome: string; ca: string | null; total: number; data_validade: string | null }[] = [];
                // From entregas_epi
                entregas.forEach(e => e.itens.forEach(item => {
                  const existing = totals.find(t => t.nome === item.nome_snapshot);
                  const prod = produtos.find(p => p.nome === item.nome_snapshot);
                  if (existing) existing.total += item.quantidade;
                  else totals.push({ nome: item.nome_snapshot, ca: item.ca_snapshot, total: item.quantidade, data_validade: prod?.data_validade || null });
                }));
                // From solicitações entregues
                const solEntregues = solicitacoes.filter(s => ['ENTREGUE', 'CONFIRMADA'].includes(s.status));
                solEntregues.forEach(s => {
                  const nome = s.produto?.nome || 'Produto';
                  const ca = s.produto?.ca || null;
                  const prod = produtos.find(p => p.id === s.produto_id);
                  const existing = totals.find(t => t.nome === nome);
                  if (existing) existing.total += s.quantidade;
                  else totals.push({ nome, ca, total: s.quantidade, data_validade: prod?.data_validade || null });
                });
                if (totals.length === 0) return null;

                // Check for validade alerts
                const now = new Date();
                const validadeAlerts = totals.filter(item => {
                  if (!item.data_validade) return false;
                  const days = differenceInDays(parseISO(item.data_validade), now);
                  return days <= 60;
                });

                return (
                  <>
                    {/* Validade alerts */}
                    {validadeAlerts.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Atenção: Validade próxima</span>
                        </div>
                        <div className="space-y-1.5">
                          {validadeAlerts.map(item => {
                            const days = differenceInDays(parseISO(item.data_validade!), now);
                            const expired = days < 0;
                            return (
                              <div key={item.nome} className="flex items-center justify-between text-xs">
                                <span className="font-medium text-foreground">{item.nome}</span>
                                <span className={cn(
                                  'font-bold px-2 py-0.5 rounded-full text-[10px]',
                                  expired
                                    ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                                    : days <= 30
                                      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                                      : 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400'
                                )}>
                                  {expired ? `Vencido há ${Math.abs(days)}d` : `Vence em ${days}d`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-2">
                      <div className="px-5 py-3 border-b bg-primary/5">
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                          <ClipboardCheck size={13} className="text-primary" />
                          EPIs em Uso
                        </h3>
                      </div>
                      <div className="p-4 space-y-1.5">
                        {totals.map(item => {
                          const days = item.data_validade ? differenceInDays(parseISO(item.data_validade), now) : null;
                          return (
                            <div key={item.nome} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-xs">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-foreground truncate block">{item.nome}</span>
                                <div className="flex items-center gap-2">
                                  {item.ca && <span className="text-[10px] text-muted-foreground font-mono">CA: {item.ca}</span>}
                                  {item.data_validade && (
                                    <span className={cn(
                                      'text-[10px] font-mono',
                                      days !== null && days < 0 ? 'text-red-600 dark:text-red-400 font-bold' :
                                      days !== null && days <= 30 ? 'text-amber-600 dark:text-amber-400' :
                                      'text-muted-foreground'
                                    )}>
                                      Val: {format(parseISO(item.data_validade), 'dd/MM/yy')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold text-primary ml-3">{item.total}×</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Solicitações entregues */}
              {(() => {
                const solEntregues2 = solicitacoes.filter(s => ['ENTREGUE', 'CONFIRMADA'].includes(s.status));
                if (solEntregues2.length > 0) {
                  return solEntregues2.map(s => (
                    <div key={`sol-${s.id}`} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{s.motivo}</span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Via Solicitação</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {format(new Date(s.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Package size={12} className="text-muted-foreground" />
                            <span className="font-medium text-foreground">{s.produto?.nome || 'Produto'}</span>
                            {s.produto?.ca && <span className="text-muted-foreground font-mono text-[10px]">CA: {s.produto.ca}</span>}
                          </div>
                          <span className="font-bold text-primary">{s.quantidade}×</span>
                        </div>
                      </div>
                      {s.observacao && (
                        <div className="px-5 pb-3">
                          <p className="text-[11px] text-muted-foreground italic">Obs: {s.observacao}</p>
                        </div>
                      )}
                    </div>
                  ));
                }
                return null;
              })()}

              {/* Entregas diretas */}
              {entregas.map(e => (
                <div key={e.id} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{e.motivo}</span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Entrega Direta</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {format(new Date(e.data_hora), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5">
                    {e.itens.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Package size={12} className="text-muted-foreground" />
                          <span className="font-medium text-foreground">{item.nome_snapshot}</span>
                          {item.ca_snapshot && <span className="text-muted-foreground font-mono text-[10px]">CA: {item.ca_snapshot}</span>}
                        </div>
                        <span className="font-bold text-primary">{item.quantidade}×</span>
                      </div>
                    ))}
                  </div>
                  {e.observacao && (
                    <div className="px-5 pb-3">
                      <p className="text-[11px] text-muted-foreground italic">Obs: {e.observacao}</p>
                    </div>
                  )}
                </div>
              ))}

              {entregas.length === 0 && solicitacoes.filter(s => s.status === 'entregue').length === 0 && (
                <EmptyState icon={Package} message="Nenhum equipamento recebido." sub="Quando você receber EPIs, eles aparecerão aqui." />
              )}
            </div>
          )}

          {/* PERFIL */}
          {activeSection === 'perfil' && (
            <div className="space-y-4 animate-in fade-in-0 duration-200">
              {/* Info pessoal */}
              <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b bg-primary/5">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <User size={13} className="text-primary" />
                    Dados Pessoais
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  <ProfileRow icon={User} label="Nome completo" value={colaborador.nome} />
                  <ProfileRow icon={Hash} label="Matrícula" value={colaborador.matricula} mono />
                  {colaborador.cpf && <ProfileRow icon={FileText} label="CPF" value={colaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} mono />}
                  {colaborador.email && <ProfileRow icon={Mail} label="E-mail" value={colaborador.email} />}
                </div>
              </section>

              {/* Info profissional */}
              <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b bg-primary/5">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Briefcase size={13} className="text-primary" />
                    Dados Profissionais
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  <ProfileRow icon={Building2} label="Empresa" value={colaborador.empresa?.nome || '—'} />
                  <ProfileRow icon={Briefcase} label="Função" value={colaborador.funcao} />
                  <ProfileRow icon={ClipboardCheck} label="Setor" value={colaborador.setor} />
                  {colaborador.centro_custo && <ProfileRow icon={Hash} label="Centro de custo" value={colaborador.centro_custo} />}
                  {colaborador.data_admissao && <ProfileRow icon={Clock} label="Admissão" value={format(parseISO(colaborador.data_admissao), 'dd/MM/yyyy')} />}
                </div>
              </section>

              {/* Tamanhos */}
              <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b bg-primary/5">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Ruler size={13} className="text-primary" />
                    Tamanhos
                  </h3>
                </div>
                <div className="p-5 grid grid-cols-3 gap-3">
                  <SizeCard icon={User} label="Uniforme" value={colaborador.tamanho_uniforme} />
                  <SizeCard icon={Footprints} label="Calçado" value={colaborador.tamanho_bota} />
                  <SizeCard icon={Hand} label="Luva" value={colaborador.tamanho_luva} />
                </div>
              </section>

              {/* Notificações recentes */}
              {recentNotifications.length > 0 && (
                <section className="bg-card rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b bg-primary/5">
                    <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <Bell size={13} className="text-primary" />
                      Atualizações Recentes
                    </h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {recentNotifications.slice(0, 5).map(s => {
                      const cfg = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pendente;
                      const StatusIcon = cfg.icon;
                      return (
                        <div key={s.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs', cfg.bg)}>
                          <StatusIcon size={14} className={cfg.color} />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground truncate block">{s.produto?.nome || 'Produto'}</span>
                            <span className="text-[10px] text-muted-foreground">{cfg.label} • {format(new Date(s.aprovado_em || s.created_at), 'dd/MM HH:mm')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Tema */}
              <section className="bg-card rounded-xl border shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon size={16} className="text-primary" /> : <Sun size={16} className="text-primary" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">Tema {theme === 'dark' ? 'Escuro' : 'Claro'}</p>
                      <p className="text-[11px] text-muted-foreground">Alterne a aparência do portal</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={toggleTheme}>
                    {theme === 'dark' ? <><Sun size={13} /> Claro</> : <><Moon size={13} /> Escuro</>}
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Footer - desktop */}
      <footer className="hidden sm:block border-t bg-card py-4 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Portal EPI • v1.0.0
          </p>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive text-xs transition-colors px-3 py-2 rounded-lg hover:bg-destructive/5 border border-transparent hover:border-destructive/20"
          >
            <LogOut size={14} />
            <span>Sair da conta</span>
          </button>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-stretch">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative',
                activeSection === item.key
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {activeSection === item.key && (
                <div className="absolute top-0 left-3 right-3 h-0.5 bg-primary rounded-b-full" />
              )}
              <div className="relative">
                <item.icon size={18} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.shortLabel}</span>
            </button>
          ))}
        </div>
      </nav>

      <ComprovanteSolicitacao
        open={comprovanteOpen}
        onClose={() => { setComprovanteOpen(false); setComprovanteSolicitacao(null); }}
        data={comprovanteSolicitacao && colaborador ? {
          colaborador: {
            nome: colaborador.nome,
            matricula: colaborador.matricula,
            setor: colaborador.setor,
            funcao: colaborador.funcao,
            empresa: colaborador.empresa?.nome,
          },
          solicitacao: {
            id: comprovanteSolicitacao.id,
            produto_nome: comprovanteSolicitacao.produto?.nome || 'Produto',
            produto_ca: comprovanteSolicitacao.produto?.ca || null,
            quantidade: comprovanteSolicitacao.quantidade,
            motivo: comprovanteSolicitacao.motivo,
            status: comprovanteSolicitacao.status,
            created_at: comprovanteSolicitacao.created_at,
            aprovado_em: comprovanteSolicitacao.aprovado_em,
            assinatura_base64: comprovanteSolicitacao.assinatura_base64,
            selfie_base64: comprovanteSolicitacao.selfie_base64,
            ip_origem: comprovanteSolicitacao.ip_origem,
            user_agent: comprovanteSolicitacao.user_agent,
            pdf_hash: comprovanteSolicitacao.pdf_hash,
            geo_latitude: comprovanteSolicitacao.geo_latitude,
            geo_longitude: comprovanteSolicitacao.geo_longitude,
            assinado_em: comprovanteSolicitacao.assinado_em,
            cpf_colaborador: comprovanteSolicitacao.cpf_colaborador,
            email_colaborador: comprovanteSolicitacao.email_colaborador,
          },
        } : null}
      />
    </div>
  );
}

/* ── Sub-components ── */

function InfoPill({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 sm:gap-1.5 bg-muted/50 border rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-muted-foreground">
      <Icon size={10} className="sm:w-[11px] sm:h-[11px]" />
      <span className="font-medium">{label}:</span>
      <span className={cn('text-foreground font-semibold', mono && 'font-mono text-[10px]')}>{value}</span>
    </span>
  );
}

function StatCard({ label, value, detail, accent }: { label: string; value: number; detail: string; accent?: boolean }) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-2.5 sm:p-4 text-center">
      <p className={cn('text-xl sm:text-2xl font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
      <p className="text-[10px] sm:text-xs font-medium text-foreground mt-0.5">{label}</p>
      <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 truncate">{detail}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: any; message: string; sub?: string }) {
  return (
    <div className="bg-card rounded-xl border shadow-sm py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
        <Icon size={20} className="text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function ProfileRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <Icon size={14} className="text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className={cn('text-sm font-medium text-foreground truncate', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

function SizeCard({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center border">
      <Icon size={18} className="mx-auto text-primary mb-1.5" />
      <p className="text-lg font-bold text-foreground">{value || '—'}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
