import { useState, useEffect, useMemo, useRef } from 'react';
import { Download, FileDown, Filter, Users, Package, ClipboardCheck, TrendingUp, Loader2, AlertTriangle, BarChart3, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface EntregaReport {
  id: string;
  data_hora: string;
  motivo: string;
  colaborador_nome: string;
  colaborador_setor: string;
  itens: { nome: string; ca: string | null; qtde: number; custo: number }[];
}

interface EstoqueReport {
  id: string;
  codigo_interno: string;
  nome: string;
  tipo: string;
  saldo: number;
  estoque_minimo: number;
  custo_unitario: number;
  data_validade: string | null;
  marca: string | null;
}

const PIE_COLORS = [
  'hsl(215, 70%, 40%)', 'hsl(142, 64%, 40%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)', 'hsl(190, 70%, 45%)',
];

const PERIOD_PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: '6 meses', days: 180 },
  { label: 'Personalizado', days: 0 },
];

export default function Relatorios() {
  const { selectedEmpresa } = useEmpresa();
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  // Filters
  const [periodPreset, setPeriodPreset] = useState(30);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [setorFilter, setSetorFilter] = useState('todos');
  const [motivoFilter, setMotivoFilter] = useState('todos');
  const [colaboradorFilter, setColaboradorFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');

  // Data
  const [entregas, setEntregas] = useState<EntregaReport[]>([]);
  const [estoque, setEstoque] = useState<EstoqueReport[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [motivosUnicos, setMotivosUnicos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('entregas');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Charts
  const [entregasPorSetor, setEntregasPorSetor] = useState<{ name: string; value: number }[]>([]);
  const [entregasPorMotivo, setEntregasPorMotivo] = useState<{ name: string; value: number }[]>([]);
  const [entregasPorDia, setEntregasPorDia] = useState<{ label: string; entregas: number }[]>([]);

  // Period preset handler
  const handlePresetChange = (days: number) => {
    setPeriodPreset(days);
    if (days > 0) {
      const d = new Date(); d.setDate(d.getDate() - days);
      setDateFrom(d.toISOString().slice(0, 10));
      setDateTo(new Date().toISOString().slice(0, 10));
    }
  };

  const loadData = async () => {
    setLoading(true);

    // --- Entregas ---
    let entQuery = supabase.from('entregas_epi')
      .select('id, data_hora, motivo, colaborador_id, colaboradores(nome, setor)')
      .gte('data_hora', dateFrom + 'T00:00:00')
      .lte('data_hora', dateTo + 'T23:59:59')
      .order('data_hora', { ascending: false });
    if (selectedEmpresa) entQuery = entQuery.eq('empresa_id', selectedEmpresa.id);
    const { data: entData } = await entQuery;

    let entregasList: EntregaReport[] = [];
    const setoresSet = new Set<string>();
    const motivosSet = new Set<string>();

    if (entData) {
      const ids = entData.map((e: any) => e.id);
      let itensData: any[] = [];
      if (ids.length > 0) {
        const { data } = await supabase.from('entrega_epi_itens')
          .select('entrega_id, nome_snapshot, ca_snapshot, quantidade, custo_unitario_snapshot')
          .in('entrega_id', ids);
        itensData = data || [];
      }

      entregasList = entData.map((e: any) => {
        const setor = e.colaboradores?.setor || '—';
        setoresSet.add(setor);
        motivosSet.add(e.motivo);
        return {
          id: e.id,
          data_hora: e.data_hora,
          motivo: e.motivo,
          colaborador_nome: e.colaboradores?.nome || '—',
          colaborador_setor: setor,
          itens: itensData.filter(i => i.entrega_id === e.id).map(i => ({
            nome: i.nome_snapshot, ca: i.ca_snapshot, qtde: i.quantidade, custo: Number(i.custo_unitario_snapshot) || 0,
          })),
        };
      });
    }

    // Apply filters
    if (setorFilter !== 'todos') entregasList = entregasList.filter(e => e.colaborador_setor === setorFilter);
    if (motivoFilter !== 'todos') entregasList = entregasList.filter(e => e.motivo === motivoFilter);
    if (colaboradorFilter) {
      const s = colaboradorFilter.toLowerCase();
      entregasList = entregasList.filter(e => e.colaborador_nome.toLowerCase().includes(s));
    }

    setEntregas(entregasList);
    setSetores(Array.from(setoresSet).sort());
    setMotivosUnicos(Array.from(motivosSet).sort());

    // Charts
    const setorMap = new Map<string, number>();
    const motivoMap = new Map<string, number>();
    const diaMap = new Map<string, number>();

    for (const e of entregasList) {
      setorMap.set(e.colaborador_setor, (setorMap.get(e.colaborador_setor) || 0) + 1);
      motivoMap.set(e.motivo, (motivoMap.get(e.motivo) || 0) + 1);
      const dia = new Date(e.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      diaMap.set(dia, (diaMap.get(dia) || 0) + 1);
    }

    setEntregasPorSetor(Array.from(setorMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
    setEntregasPorMotivo(Array.from(motivoMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
    const sortedDias = Array.from(diaMap.entries()).sort((a, b) => {
      const [da, ma] = a[0].split('/').map(Number);
      const [db, mb] = b[0].split('/').map(Number);
      return ma !== mb ? ma - mb : da - db;
    });
    setEntregasPorDia(sortedDias.map(([label, entregas]) => ({ label, entregas })));

    // --- Estoque ---
    let prodQuery = supabase.from('produtos').select('*').eq('ativo', true).order('nome');
    if (selectedEmpresa) prodQuery = prodQuery.eq('empresa_id', selectedEmpresa.id);
    const { data: prodData } = await prodQuery;

    const estoqueList: EstoqueReport[] = [];
    if (prodData) {
      for (const p of prodData) {
        const { data: saldo } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
        estoqueList.push({
          id: p.id, codigo_interno: p.codigo_interno, nome: p.nome, tipo: p.tipo,
          saldo: typeof saldo === 'number' ? saldo : 0, estoque_minimo: p.estoque_minimo,
          custo_unitario: p.custo_unitario || 0, data_validade: p.data_validade, marca: p.marca,
        });
      }
    }
    setEstoque(estoqueList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedEmpresa, dateFrom, dateTo, setorFilter, motivoFilter, colaboradorFilter]);

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Filtered estoque
  const filteredEstoque = useMemo(() => {
    if (tipoFilter === 'todos') return estoque;
    return estoque.filter(p => p.tipo === tipoFilter);
  }, [estoque, tipoFilter]);

  // Estoque charts
  const estoquePorTipo = useMemo(() => {
    const map = new Map<string, number>();
    filteredEstoque.forEach(p => map.set(p.tipo, (map.get(p.tipo) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredEstoque]);

  const estoqueTop10Valor = useMemo(() => {
    return [...filteredEstoque]
      .sort((a, b) => (b.saldo * b.custo_unitario) - (a.saldo * a.custo_unitario))
      .slice(0, 10)
      .map(p => ({ name: p.nome.length > 20 ? p.nome.slice(0, 20) + '…' : p.nome, valor: p.saldo * p.custo_unitario }));
  }, [filteredEstoque]);

  // Stats
  const totalItensEntregues = entregas.reduce((s, e) => s + e.itens.reduce((ss, i) => ss + i.qtde, 0), 0);
  const custoTotalEntregas = entregas.reduce((s, e) => s + e.itens.reduce((ss, i) => ss + i.qtde * i.custo, 0), 0);
  const totalValorEstoque = filteredEstoque.reduce((s, p) => s + p.saldo * p.custo_unitario, 0);
  const estoqueBaixo = filteredEstoque.filter(p => p.saldo < p.estoque_minimo).length;

  // --- CSV Export ---
  const exportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const bom = '\uFEFF';
    const csv = bom + [headers.join(';'), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado', description: `Arquivo ${filename} gerado.` });
  };

  const exportEntregasCSV = () => {
    exportCSV(`entregas_${dateFrom}_${dateTo}.csv`,
      ['Data', 'Colaborador', 'Setor', 'Motivo', 'Itens', 'Quantidades', 'Custo Total'],
      entregas.map(e => [
        new Date(e.data_hora).toLocaleString('pt-BR'), e.colaborador_nome, e.colaborador_setor, e.motivo,
        e.itens.map(i => i.nome).join(', '), e.itens.map(i => String(i.qtde)).join(', '),
        formatCurrency(e.itens.reduce((s, i) => s + i.qtde * i.custo, 0)),
      ])
    );
  };

  const exportEstoqueCSV = () => {
    exportCSV('estoque_atual.csv',
      ['Código', 'Produto', 'Tipo', 'Marca', 'Saldo', 'Mínimo', 'Custo Un.', 'Valor Total', 'Validade'],
      filteredEstoque.map(p => [
        p.codigo_interno, p.nome, p.tipo, p.marca || '', String(p.saldo), String(p.estoque_minimo),
        formatCurrency(p.custo_unitario), formatCurrency(p.saldo * p.custo_unitario),
        p.data_validade ? new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
      ])
    );
  };

  // --- PDF Export ---
  const handleExportPdf = async (title: string) => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      // Header
      pdf.setFontSize(14);
      pdf.setTextColor(26, 39, 68);
      pdf.text(title, 15, 15);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`${selectedEmpresa?.nome || 'Todas as empresas'} • Gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 21);
      pdf.text(`Período: ${new Date(dateFrom).toLocaleDateString('pt-BR')} a ${new Date(dateTo).toLocaleDateString('pt-BR')}`, 15, 25);

      const imgW = pdfW - 30;
      const imgH = (canvas.height * imgW) / canvas.width;
      const maxH = pdfH - 35;

      if (imgH <= maxH) {
        pdf.addImage(imgData, 'PNG', 15, 30, imgW, imgH);
      } else {
        // Multi-page
        let yOffset = 0;
        let pageNum = 0;
        while (yOffset < canvas.height) {
          if (pageNum > 0) pdf.addPage();
          const sliceH = Math.min(canvas.height - yOffset, (maxH / imgW) * canvas.width);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceImg = sliceCanvas.toDataURL('image/png');
          const sliceImgH = (sliceH * imgW) / canvas.width;
          pdf.addImage(sliceImg, 'PNG', 15, pageNum === 0 ? 30 : 10, imgW, sliceImgH);
          yOffset += sliceH;
          pageNum++;
        }
      }

      pdf.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: 'PDF exportado', description: 'Arquivo salvo com sucesso.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setExportingPdf(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedEmpresa ? selectedEmpresa.nome : 'Todas as empresas'} • Análises e exportações
          </p>
        </div>
        <div className="flex gap-1.5">
          {PERIOD_PRESETS.map(p => (
            <Button
              key={p.days}
              variant={periodPreset === p.days ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-[11px] px-2.5 hidden sm:inline-flex"
              onClick={() => handlePresetChange(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-end">
          <div className="flex-1 min-w-0">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Período</Label>
            <div className="flex gap-2 mt-1">
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPeriodPreset(0); }} className="h-9 text-xs" />
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPeriodPreset(0); }} className="h-9 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Setor</Label>
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className="mt-1 w-36 h-9"><Filter size={13} className="mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos setores</SelectItem>
                {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Motivo</Label>
            <Select value={motivoFilter} onValueChange={setMotivoFilter}>
              <SelectTrigger className="mt-1 w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos motivos</SelectItem>
                {motivosUnicos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Colaborador</Label>
            <Input
              placeholder="Buscar nome..."
              value={colaboradorFilter}
              onChange={e => setColaboradorFilter(e.target.value)}
              className="mt-1 h-9 w-40 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="entregas" className="text-xs gap-1.5"><ClipboardCheck size={13} /> Entregas</TabsTrigger>
          <TabsTrigger value="estoque" className="text-xs gap-1.5"><Package size={13} /> Estoque</TabsTrigger>
        </TabsList>

        {/* === ENTREGAS TAB === */}
        <TabsContent value="entregas" className="space-y-4 mt-4">
          <div ref={activeTab === 'entregas' ? reportRef : undefined}>
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-card rounded-lg border p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Entregas</p>
                <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : entregas.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">no período selecionado</p>
              </div>
              <div className="bg-card rounded-lg border p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Itens Entregues</p>
                <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : totalItensEntregues}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">unidades distribuídas</p>
              </div>
              <div className="bg-card rounded-lg border p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Custo Total</p>
                <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : formatCurrency(custoTotalEntregas)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">valor estimado</p>
              </div>
              <div className="bg-card rounded-lg border p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Setores</p>
                <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : entregasPorSetor.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">setores atendidos</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div className="lg:col-span-2 bg-card rounded-lg border p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Entregas por Dia</h3>
                <div className="h-52">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin mr-2" /> Carregando...</div>
                  ) : entregasPorDia.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados no período</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={entregasPorDia} barSize={Math.max(6, Math.min(24, 500 / entregasPorDia.length))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={entregasPorDia.length > 15 ? Math.floor(entregasPorDia.length / 10) : 0} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={24} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Por Motivo</h3>
                <div className="h-52">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
                  ) : entregasPorMotivo.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={entregasPorMotivo} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} dataKey="value" nameKey="name">
                          {entregasPorMotivo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {/* Legend */}
                  {!loading && entregasPorMotivo.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
                      {entregasPorMotivo.map((m, i) => (
                        <div key={m.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {m.name} ({m.value})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Por Setor horizontal bar */}
            {!loading && entregasPorSetor.length > 0 && (
              <div className="bg-card rounded-lg border p-4 mb-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Entregas por Setor</h3>
                <div className="space-y-1.5">
                  {entregasPorSetor.map((s, i) => {
                    const maxVal = entregasPorSetor[0]?.value || 1;
                    const pct = (s.value / maxVal) * 100;
                    return (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28 truncate text-right shrink-0">{s.name}</span>
                        <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums w-8 text-right">{s.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportEntregasCSV} disabled={entregas.length === 0}>
              <FileDown size={13} /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExportPdf('Relatório de Entregas')} disabled={entregas.length === 0 || exportingPdf}>
              {exportingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
            </Button>
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Setor</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Motivo</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Itens</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Custo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-20 rounded skeleton-shimmer" /></td>)}</tr>
                    ))
                  ) : entregas.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">Nenhuma entrega no período selecionado.</td></tr>
                  ) : entregas.map(e => (
                    <tr key={e.id} className="table-row-hover">
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(e.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-2.5 font-medium">{e.colaborador_nome}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell"><span className="bg-muted px-1.5 py-0.5 rounded-full text-[10px]">{e.colaborador_setor}</span></td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{e.motivo}</td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">{e.itens.map(i => `${i.qtde}x ${i.nome}`).join(', ')}</td>
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell text-muted-foreground tabular-nums">{formatCurrency(e.itens.reduce((s, i) => s + i.qtde * i.custo, 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* === ESTOQUE TAB === */}
        <TabsContent value="estoque" className="space-y-4 mt-4">
          <div ref={activeTab === 'estoque' ? reportRef : undefined}>
            {/* Tipo filter */}
            <div className="flex items-center gap-2 mb-4">
              <Label className="text-xs text-muted-foreground">Tipo:</Label>
              {['todos', 'EPI', 'EPC'].map(t => (
                <Button key={t} variant={tipoFilter === t ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] px-2.5" onClick={() => setTipoFilter(t)}>
                  {t === 'todos' ? 'Todos' : t}
                </Button>
              ))}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-card rounded-lg border p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Produtos</p>
                <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : filteredEstoque.length}</p>
              </div>
              <div className="bg-card rounded-lg border p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Valor em Estoque</p>
                <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : formatCurrency(totalValorEstoque)}</p>
              </div>
              <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-danger">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Abaixo do Mínimo</p>
                <p className="text-xl font-bold text-status-danger mt-1">{loading ? '—' : estoqueBaixo}</p>
              </div>
              <div className="bg-card rounded-lg border p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Itens Vencendo</p>
                <p className="text-xl font-bold text-status-warning mt-1">
                  {loading ? '—' : filteredEstoque.filter(p => p.data_validade && Math.ceil((new Date(p.data_validade).getTime() - Date.now()) / 86400000) <= 30 && Math.ceil((new Date(p.data_validade).getTime() - Date.now()) / 86400000) > 0).length}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Distribuição por Tipo</h3>
                <div className="h-48">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
                  ) : estoquePorTipo.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={estoquePorTipo} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={5} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`} style={{ fontSize: 11 }}>
                          {estoquePorTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-xs font-semibold text-foreground mb-3">Top 10 por Valor em Estoque</h3>
                <div className="h-48">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
                  ) : estoqueTop10Valor.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={estoqueTop10Valor} layout="vertical" barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="valor" fill="hsl(142, 64%, 40%)" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Critical items */}
            {!loading && estoqueBaixo > 0 && (
              <div className="bg-status-danger/5 border border-status-danger/20 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-status-danger" />
                  <h3 className="text-xs font-semibold text-status-danger">Itens Críticos — Abaixo do Estoque Mínimo</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredEstoque.filter(p => p.saldo < p.estoque_minimo).map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border">
                      <div className="w-6 h-6 rounded-full bg-status-danger/10 flex items-center justify-center">
                        <Package size={12} className="text-status-danger" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.nome}</p>
                        <p className="text-[10px] text-muted-foreground">Saldo: <span className="text-status-danger font-bold">{p.saldo}</span> / Mín: {p.estoque_minimo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportEstoqueCSV} disabled={filteredEstoque.length === 0}>
              <FileDown size={13} /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExportPdf('Relatório de Estoque')} disabled={filteredEstoque.length === 0 || exportingPdf}>
              {exportingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
            </Button>
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Código</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Produto</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Marca</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Saldo</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Mín.</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Custo Un.</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Valor Total</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-16 rounded skeleton-shimmer" /></td>)}</tr>
                    ))
                  ) : filteredEstoque.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                  ) : filteredEstoque.map(p => {
                    const baixo = p.saldo < p.estoque_minimo;
                    const vencido = p.data_validade && new Date(p.data_validade) < new Date();
                    return (
                      <tr key={p.id} className={cn("table-row-hover", baixo && "bg-status-danger/5")}>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{p.codigo_interno}</td>
                        <td className="px-3 py-2.5 font-medium">{p.nome}</td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full",
                            p.tipo === 'EPI' ? 'bg-primary/10 text-primary' : 'bg-status-warning/10 text-status-warning'
                          )}>{p.tipo}</span>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{p.marca || '—'}</td>
                        <td className={cn("px-3 py-2.5 text-right font-bold tabular-nums", baixo && "text-status-danger")}>{p.saldo}</td>
                        <td className="px-3 py-2.5 text-right hidden sm:table-cell text-muted-foreground">{p.estoque_minimo}</td>
                        <td className="px-3 py-2.5 text-right hidden md:table-cell text-muted-foreground">{p.custo_unitario > 0 ? formatCurrency(p.custo_unitario) : '—'}</td>
                        <td className="px-3 py-2.5 text-right hidden lg:table-cell text-muted-foreground">{p.custo_unitario > 0 ? formatCurrency(p.saldo * p.custo_unitario) : '—'}</td>
                        <td className={cn("px-3 py-2.5 hidden lg:table-cell", vencido ? "text-status-danger font-medium" : "text-muted-foreground")}>
                          {p.data_validade ? new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
