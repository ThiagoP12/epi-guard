import { useState, useEffect } from 'react';
import { Building2, CheckCircle, XCircle, Clock, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TenantInfo {
  id: string;
  nome: string;
  cnpj: string | null;
  aprovado: boolean;
  created_at: string;
  email: string | null;
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('empresas')
      .select('id, nome, cnpj, aprovado, created_at, email')
      .order('created_at', { ascending: false });
    if (data) setTenants(data as TenantInfo[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleAprovacao = async (id: string, aprovado: boolean) => {
    setActionLoading(id);
    const { error } = await supabase
      .from('empresas')
      .update({ aprovado })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: aprovado ? 'Empresa aprovada!' : 'Aprovação revogada' });
      load();
    }
    setActionLoading(null);
  };

  const pending = tenants.filter(t => !t.aprovado);
  const approved = tenants.filter(t => t.aprovado);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Gestão de Tenants</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {tenants.length} empresa(s) • {pending.length} aguardando aprovação
        </p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock size={14} className="text-amber-500" /> Aguardando Aprovação ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map(t => (
              <div key={t.id} className="bg-card rounded-xl border-2 border-amber-500/20 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Building2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{t.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.cnpj || 'CNPJ não informado'} • Cadastro: {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => toggleAprovacao(t.id, true)}
                  disabled={actionLoading === t.id}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {actionLoading === t.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Aprovar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-500" /> Empresas Ativas ({approved.length})
        </h2>
        <div className="space-y-1.5">
          {approved.map(t => (
            <div key={t.id} className="bg-card rounded-lg border p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t.cnpj || '—'} • {new Date(t.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleAprovacao(t.id, false)}
                disabled={actionLoading === t.id}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                {actionLoading === t.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                Revogar
              </Button>
            </div>
          ))}
          {approved.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma empresa aprovada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
