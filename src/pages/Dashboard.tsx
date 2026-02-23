import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ClipboardCheck, Users, AlertTriangle, TrendingUp, Clock, ArrowRight, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEmpresa } from '@/contexts/EmpresaContext';

interface RecentActivity {
  id: string;
  type: 'entrega' | 'entrada' | 'saida';
  description: string;
  time: string;
}

interface Alert {
  id: string;
  severity: 'danger' | 'warning';
  message: string;
  link: string;
}

interface ChartData {
  label: string;
  entregas: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedEmpresa } = useEmpresa();
  const [stats, setStats] = useState({ estoqueBaixo: 0, entregasMes: 0, totalColabs: 0, totalProdutos: 0 });
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      // --- Stats ---
      let prodQuery = supabase.from('produtos').select('id, nome, estoque_minimo, data_validade, ca').eq('ativo', true);
      if (selectedEmpresa) prodQuery = prodQuery.eq('empresa_id', selectedEmpresa.id);
      const { data: produtos } = await prodQuery;
      let estoqueBaixo = 0;
      const alertsList: Alert[] = [];

      if (produtos) {
        for (const p of produtos) {
          const { data: saldo } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
          const s = typeof saldo === 'number' ? saldo : 0;
          if (s < p.estoque_minimo) {
            estoqueBaixo++;
            alertsList.push({
              id: `stock-${p.id}`,
              severity: 'danger',
              message: `${p.nome} — estoque ${s}/${p.estoque_minimo}`,
              link: '/estoque?status=baixo',
            });
          }
          if (p.data_validade) {
            const dias = Math.ceil((new Date(p.data_validade).getTime() - Date.now()) / 86400000);
            if (dias < 0) {
              alertsList.push({ id: `exp-${p.id}`, severity: 'danger', message: `${p.nome} (CA: ${p.ca || 'N/A'}) — VENCIDO`, link: '/estoque' });
            } else if (dias <= 30) {
              alertsList.push({ id: `exp-${p.id}`, severity: 'warning', message: `${p.nome} (CA: ${p.ca || 'N/A'}) — vence em ${dias} dias`, link: '/estoque' });
            }
          }
        }
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      let entregaQuery = supabase.from('entregas_epi').select('id', { count: 'exact', head: true }).gte('data_hora', startOfMonth);
      if (selectedEmpresa) entregaQuery = entregaQuery.eq('empresa_id', selectedEmpresa.id);
      const { count: entregasMes } = await entregaQuery;

      let colabQuery = supabase.from('colaboradores').select('id', { count: 'exact', head: true }).eq('ativo', true);
      if (selectedEmpresa) colabQuery = colabQuery.eq('empresa_id', selectedEmpresa.id);
      const { count: totalColabs } = await colabQuery;

      setStats({
        estoqueBaixo,
        entregasMes: entregasMes || 0,
        totalColabs: totalColabs || 0,
        totalProdutos: produtos?.length || 0,
      });
      setAlerts(alertsList);

      // --- Chart: entregas últimos 7 dias ---
      const days: ChartData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        let dayQuery = supabase.from('entregas_epi').select('id', { count: 'exact', head: true })
          .gte('data_hora', dayStart).lt('data_hora', dayEnd);
        if (selectedEmpresa) dayQuery = dayQuery.eq('empresa_id', selectedEmpresa.id);
        const { count } = await dayQuery;
        days.push({
          label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
          entregas: count || 0,
        });
      }
      setChartData(days);

      // --- Recent activities ---
      let recentEntregaQuery = supabase.from('entregas_epi')
        .select('id, data_hora, colaborador_id, colaboradores(nome)')
        .order('data_hora', { ascending: false }).limit(5);
      if (selectedEmpresa) recentEntregaQuery = recentEntregaQuery.eq('empresa_id', selectedEmpresa.id);
      const { data: recentEntregas } = await recentEntregaQuery;

      let recentMovQuery = supabase.from('movimentacoes_estoque')
        .select('id, data_hora, tipo_movimentacao, quantidade, motivo, produtos(nome)')
        .order('data_hora', { ascending: false }).limit(5);
      if (selectedEmpresa) recentMovQuery = recentMovQuery.eq('empresa_id', selectedEmpresa.id);
      const { data: recentMov } = await recentMovQuery;

      const acts: RecentActivity[] = [];
      recentEntregas?.forEach((e: any) => {
        acts.push({
          id: e.id,
          type: 'entrega',
          description: `Entrega para ${e.colaboradores?.nome || 'Colaborador'}`,
          time: new Date(e.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        });
      });
      recentMov?.forEach((m: any) => {
        acts.push({
          id: m.id,
          type: m.tipo_movimentacao === 'ENTRADA' ? 'entrada' : 'saida',
          description: `${m.tipo_movimentacao === 'ENTRADA' ? 'Entrada' : 'Saída'} ${m.quantidade}x ${m.produtos?.nome || 'Produto'}`,
          time: new Date(m.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        });
      });
      acts.sort((a, b) => b.time.localeCompare(a.time));
      setActivities(acts.slice(0, 8));

      setLoading(false);
    };
    loadAll();
  }, [selectedEmpresa]);

  const cards = [
    {
      title: 'Estoque Baixo',
      value: stats.estoqueBaixo,
      subtitle: `de ${stats.totalProdutos} produtos`,
      severity: stats.estoqueBaixo > 0 ? 'danger' as const : 'ok' as const,
      icon: Package,
      onClick: () => navigate('/estoque?status=baixo'),
    },
    {
      title: 'Entregas do Mês',
      value: stats.entregasMes,
      subtitle: new Date().toLocaleString('pt-BR', { month: 'long' }),
      severity: 'ok' as const,
      icon: ClipboardCheck,
      onClick: () => navigate('/entrega-epi'),
    },
    {
      title: 'Colaboradores',
      value: stats.totalColabs,
      subtitle: 'ativos',
      severity: 'ok' as const,
      icon: Users,
      onClick: () => navigate('/colaboradores'),
    },
    {
      title: 'Alertas',
      value: alerts.length,
      subtitle: alerts.length > 0 ? 'itens requerem atenção' : 'tudo em dia',
      severity: alerts.length > 0 ? 'warning' as const : 'ok' as const,
      icon: AlertTriangle,
      onClick: () => document.getElementById('alerts-section')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ];

  const severityStyles = {
    ok: { bg: 'bg-status-ok-bg', text: 'text-status-ok', border: 'border-l-status-ok' },
    warning: { bg: 'bg-status-warning-bg', text: 'text-status-warning', border: 'border-l-status-warning' },
    danger: { bg: 'bg-status-danger-bg', text: 'text-status-danger', border: 'border-l-status-danger' },
  };

  const activityIcons = {
    entrega: <ClipboardCheck size={14} className="text-primary" />,
    entrada: <TrendingUp size={14} className="text-status-ok" />,
    saida: <Package size={14} className="text-status-danger" />,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const style = severityStyles[card.severity];
          return (
            <button
              key={card.title}
              onClick={card.onClick}
              className="card-interactive bg-card rounded-lg border border-l-4 p-4 text-left w-full transition-all"
              style={{ borderLeftColor: `hsl(var(--status-${card.severity === 'ok' ? 'ok' : card.severity}))` }}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.title}</p>
                <div className={`p-1.5 rounded-md ${style.bg}`}>
                  <card.icon size={16} className={style.text} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? '—' : card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{card.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Chart + Activities Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <div className="lg:col-span-3 bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Entregas — Últimos 7 dias</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Quantidade de entregas de EPI por dia</p>
            </div>
            <Calendar size={16} className="text-muted-foreground" />
          </div>
          <div className="h-48">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={24} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value: number) => [value, 'Entregas']}
                  />
                  <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Atividades Recentes</h2>
            <Clock size={16} className="text-muted-foreground" />
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade ainda.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 py-2 px-2 rounded-md hover:bg-muted/40 transition-colors">
                  <div className="p-1 rounded bg-muted/60">{activityIcons[a.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{a.description}</p>
                    <p className="text-[10px] text-muted-foreground">{a.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div id="alerts-section" className="bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Alertas e Notificações</h2>
            <AlertTriangle size={16} className="text-status-warning" />
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 10).map((alert) => (
              <button
                key={alert.id}
                onClick={() => navigate(alert.link)}
                className="w-full flex items-center gap-3 p-3 rounded-md text-left hover:bg-muted/40 transition-colors group"
              >
                <StatusBadge status={alert.severity} label={alert.severity === 'danger' ? 'Crítico' : 'Atenção'} />
                <span className="text-xs text-foreground flex-1">{alert.message}</span>
                <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
            {alerts.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                e mais {alerts.length - 10} alertas...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
