import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ClipboardCheck, Users, AlertTriangle, TrendingUp, Clock, ArrowRight, Calendar, Shield, Award, Medal, FileDown, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
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

interface RankingItem {
  nome: string;
  quantidade: number;
}

interface CentroCustoData {
  nome: string;
  quantidade: number;
}

const CC_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--status-ok))',
  'hsl(var(--status-warning))',
  'hsl(210 70% 55%)',
  'hsl(280 60% 55%)',
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedEmpresa } = useEmpresa();
  const [stats, setStats] = useState({ estoqueBaixo: 0, entregasMes: 0, totalColabs: 0, totalProdutos: 0, totalEPIs: 0, totalEPCs: 0 });
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [topColaboradores, setTopColaboradores] = useState<RankingItem[]>([]);
  const [topEPIs, setTopEPIs] = useState<RankingItem[]>([]);
  const [topEPCs, setTopEPCs] = useState<RankingItem[]>([]);
  const [centroCustoData, setCentroCustoData] = useState<CentroCustoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankingDays, setRankingDays] = useState(30);
  const [chartDays, setChartDays] = useState(7);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = useCallback(async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      // Header
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Relatório Gerencial — Dashboard', 14, 14);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120);
      const empresa = selectedEmpresa?.nome || 'Todas as empresas';
      pdf.text(`${empresa} • Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20);
      pdf.setTextColor(0);

      // Image
      const marginTop = 26;
      const availH = pdfH - marginTop - 8;
      const imgRatio = canvas.width / canvas.height;
      const availRatio = (pdfW - 28) / availH;
      let imgW: number, imgH: number;
      if (imgRatio > availRatio) {
        imgW = pdfW - 28;
        imgH = imgW / imgRatio;
      } else {
        imgH = availH;
        imgW = imgH * imgRatio;
      }
      pdf.addImage(imgData, 'PNG', 14, marginTop, imgW, imgH);

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(160);
      pdf.text('Sistema de Gestão EPI & EPC • Documento gerado automaticamente', 14, pdfH - 4);

      pdf.save(`Dashboard_${empresa.replace(/\\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    }
    setExporting(false);
  }, [selectedEmpresa]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);

      // --- Stats ---
      let prodQuery = supabase.from('produtos').select('id, nome, estoque_minimo, data_validade, ca, tipo').eq('ativo', true);
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

      const totalEPIs = produtos?.filter(p => p.tipo === 'EPI').length || 0;
      const totalEPCs = produtos?.filter(p => p.tipo === 'EPC').length || 0;

      setStats({
        estoqueBaixo,
        entregasMes: entregasMes || 0,
        totalColabs: totalColabs || 0,
        totalProdutos: produtos?.length || 0,
        totalEPIs,
        totalEPCs,
      });
      setAlerts(alertsList);

      // --- Chart: entregas by period ---
      const days: ChartData[] = [];
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        let dayQuery = supabase.from('entregas_epi').select('id', { count: 'exact', head: true })
          .gte('data_hora', dayStart).lt('data_hora', dayEnd);
        if (selectedEmpresa) dayQuery = dayQuery.eq('empresa_id', selectedEmpresa.id);
        const { count } = await dayQuery;
        const labelFormat = chartDays <= 7
          ? d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
          : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        days.push({ label: labelFormat, entregas: count || 0 });
      }
      setChartData(days);

      // --- Top 5 Colaboradores que mais recebem (filtered by period) ---
      const rankingStart = new Date();
      rankingStart.setDate(rankingStart.getDate() - rankingDays);
      const rankingStartISO = rankingStart.toISOString();

      let entregasItensQuery = supabase.from('entregas_epi')
        .select('colaborador_id, colaboradores(nome), entrega_epi_itens(quantidade)')
        .gte('data_hora', rankingStartISO)
        .order('data_hora', { ascending: false })
        .limit(500);
      if (selectedEmpresa) entregasItensQuery = entregasItensQuery.eq('empresa_id', selectedEmpresa.id);
      const { data: entregasData } = await entregasItensQuery;

      if (entregasData) {
        // Aggregate by colaborador
        const colabMap = new Map<string, { nome: string; total: number }>();
        for (const e of entregasData as any[]) {
          const nome = e.colaboradores?.nome || 'Desconhecido';
          const key = e.colaborador_id;
          const qtd = (e.entrega_epi_itens || []).reduce((sum: number, i: any) => sum + (i.quantidade || 0), 0);
          const existing = colabMap.get(key);
          if (existing) {
            existing.total += qtd;
          } else {
            colabMap.set(key, { nome, total: qtd });
          }
        }
        const sorted = Array.from(colabMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
          .map(c => ({ nome: c.nome, quantidade: c.total }));
        setTopColaboradores(sorted);

        // Aggregate by produto for EPI and EPC
        const prodMap = new Map<string, { nome: string; tipo: string; total: number }>();
        for (const e of entregasData as any[]) {
          for (const item of (e.entrega_epi_itens || []) as any[]) {
            // We need produto info - use itens with nome_snapshot
          }
        }
      }

      // --- Top 5 EPIs and EPCs (from entrega_epi_itens joined with produtos) ---
      let itensQuery = supabase.from('entrega_epi_itens')
        .select('entrega_id, nome_snapshot, quantidade, produto_id, produtos(tipo)')
        .limit(1000);
      // Filter by empresa through entregas
      const { data: allItens } = await itensQuery;

      if (allItens) {
        // Filter by empresa and period through entregas
        let filteredItens = allItens as any[];
        let entregaFilterQuery = supabase.from('entregas_epi')
          .select('id')
          .gte('data_hora', rankingStartISO);
        if (selectedEmpresa) entregaFilterQuery = entregaFilterQuery.eq('empresa_id', selectedEmpresa.id);
        const { data: entregaIds } = await entregaFilterQuery;
        if (entregaIds) {
          const idSet = new Set(entregaIds.map(e => e.id));
          filteredItens = filteredItens.filter((i: any) => idSet.has(i.entrega_id));
        }

        const epiMap = new Map<string, number>();
        const epcMap = new Map<string, number>();

        for (const item of filteredItens) {
          const tipo = item.produtos?.tipo || 'EPI';
          const nome = item.nome_snapshot;
          const map = tipo === 'EPC' ? epcMap : epiMap;
          map.set(nome, (map.get(nome) || 0) + item.quantidade);
        }

        setTopEPIs(
          Array.from(epiMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nome, quantidade]) => ({ nome, quantidade }))
        );
        setTopEPCs(
          Array.from(epcMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nome, quantidade]) => ({ nome, quantidade }))
        );
      }

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

      // --- Centro de Custo report ---
      let ccQuery = supabase.from('colaboradores').select('centro_custo').eq('ativo', true);
      if (selectedEmpresa) ccQuery = ccQuery.eq('empresa_id', selectedEmpresa.id);
      const { data: ccData } = await ccQuery;
      if (ccData) {
        const ccMap = new Map<string, number>();
        for (const c of ccData as any[]) {
          const cc = c.centro_custo || 'Não definido';
          ccMap.set(cc, (ccMap.get(cc) || 0) + 1);
        }
        setCentroCustoData(
          Array.from(ccMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([nome, quantidade]) => ({ nome, quantidade }))
        );
      }

      setLoading(false);
    };
    loadAll();
  }, [selectedEmpresa, rankingDays, chartDays]);

  const cards = [
    {
      title: 'Colaboradores',
      value: stats.totalColabs,
      subtitle: 'ativos',
      severity: 'ok' as const,
      icon: Users,
      onClick: () => navigate('/colaboradores'),
    },
    {
      title: 'EPIs Cadastrados',
      value: stats.totalEPIs,
      subtitle: `de ${stats.totalProdutos} produtos`,
      severity: 'ok' as const,
      icon: Package,
      onClick: () => navigate('/estoque'),
    },
    {
      title: 'EPCs Cadastrados',
      value: stats.totalEPCs,
      subtitle: `de ${stats.totalProdutos} produtos`,
      severity: 'ok' as const,
      icon: Shield,
      onClick: () => navigate('/estoque'),
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
      title: 'Estoque Baixo',
      value: stats.estoqueBaixo,
      subtitle: 'itens abaixo do mínimo',
      severity: stats.estoqueBaixo > 0 ? 'danger' as const : 'ok' as const,
      icon: AlertTriangle,
      onClick: () => navigate('/estoque?status=baixo'),
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

  const medalColors = ['text-amber-500', 'text-zinc-400', 'text-amber-700', 'text-muted-foreground', 'text-muted-foreground'];

  const RankingCard = ({ title, icon: Icon, items, emptyText, accentColor }: {
    title: string;
    icon: typeof Users;
    items: RankingItem[];
    emptyText: string;
    accentColor: string;
  }) => (
    <div className="bg-card rounded-lg border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-1.5 rounded-md ${accentColor}`}>
          <Icon size={16} className="text-primary-foreground" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full skeleton-shimmer" />
              <div className="h-4 flex-1 rounded skeleton-shimmer" />
              <div className="h-4 w-10 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, idx) => {
            const maxQty = items[0]?.quantidade || 1;
            const pct = (item.quantidade / maxQty) * 100;
            return (
              <div key={idx} className="group relative flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/40 transition-colors">
                <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {idx < 3 ? (
                      <Medal size={14} className={medalColors[idx]} />
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-foreground truncate flex-1">{item.nome}</span>
                  <span className="text-xs font-bold tabular-nums text-foreground shrink-0">{item.quantidade}</span>
                </div>
                {/* Progress bar background */}
                <div
                  className="absolute inset-0 rounded-md bg-primary/5 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          {selectedEmpresa && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Dados de <span className="font-medium text-foreground">{selectedEmpresa.nome}</span>
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportPdf} disabled={exporting || loading}>
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          Exportar PDF
        </Button>
      </div>

      <div ref={dashboardRef}>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
              <h2 className="text-sm font-semibold text-foreground">Entregas — Últimos {chartDays} dias</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Quantidade de entregas de EPI por dia</p>
            </div>
            <div className="flex gap-1">
              {[7, 30, 90].map(d => (
                <Button key={d} variant={chartDays === d ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] px-2.5" onClick={() => setChartDays(d)}>
                  {d}d
                </Button>
              ))}
            </div>
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

      {/* Rankings Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Rankings de Entregas</h2>
          <div className="flex gap-1">
            {[30, 60, 90].map(d => (
              <Button key={d} variant={rankingDays === d ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] px-2.5" onClick={() => setRankingDays(d)}>
                {d} dias
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RankingCard
          title="Top 5 Colaboradores"
          icon={Users}
          items={topColaboradores}
          emptyText="Nenhuma entrega registrada ainda."
          accentColor="bg-primary"
        />
        <RankingCard
          title="Top 5 EPIs"
          icon={Award}
          items={topEPIs}
          emptyText="Nenhum EPI entregue ainda."
          accentColor="bg-status-ok"
        />
        <RankingCard
          title="Top 5 EPCs"
          icon={Shield}
          items={topEPCs}
          emptyText="Nenhum EPC entregue ainda."
          accentColor="bg-status-warning"
        />
        </div>
      </div>

      {/* Centro de Custo Report */}
      <div className="bg-card rounded-lg border p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-md bg-primary">
            <Wallet size={16} className="text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Colaboradores por Centro de Custo</h2>
            <p className="text-xs text-muted-foreground">Distribuição dos colaboradores ativos</p>
          </div>
        </div>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
        ) : centroCustoData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum colaborador com centro de custo definido.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={centroCustoData}
                    dataKey="quantidade"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ nome, quantidade }) => `${quantidade}`}
                    labelLine={false}
                  >
                    {centroCustoData.map((_, idx) => (
                      <Cell key={idx} fill={CC_COLORS[idx % CC_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {centroCustoData.map((cc, idx) => {
                const total = centroCustoData.reduce((sum, c) => sum + c.quantidade, 0);
                const pct = total > 0 ? ((cc.quantidade / total) * 100).toFixed(1) : '0';
                return (
                  <div key={cc.nome} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CC_COLORS[idx % CC_COLORS.length] }} />
                    <span className="text-xs font-medium text-foreground flex-1 truncate">{cc.nome}</span>
                    <span className="text-xs font-bold tabular-nums text-foreground">{cc.quantidade}</span>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
      </div>{/* end dashboardRef */}
    </div>
  );
}
