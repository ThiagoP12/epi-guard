import { useState, useEffect } from 'react';
import { BarChart3, Download, FileDown, Filter, Calendar, Users, Package, ClipboardCheck, TrendingUp, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { cn } from '@/lib/utils';

interface EntregaReport {
  id: string;
  data_hora: string;
  motivo: string;
  colaborador_nome: string;
  colaborador_setor: string;
  itens: { nome: string; ca: string | null; qtde: number }[];
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
}

const PIE_COLORS = [
  'hsl(215, 70%, 40%)',
  'hsl(142, 64%, 40%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 60%, 50%)',
  'hsl(190, 70%, 45%)',
];

export default function Relatorios() {
  const { selectedEmpresa } = useEmpresa();
  const { toast } = useToast();

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [setorFilter, setSetorFilter] = useState('todos');

  // Report data
  const [entregas, setEntregas] = useState<EntregaReport[]>([]);
  const [estoque, setEstoque] = useState<EstoqueReport[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('entregas');

  // Chart data
  const [entregasPorSetor, setEntregasPorSetor] = useState<{ name: string; value: number }[]>([]);
  const [entregasPorMotivo, setEntregasPorMotivo] = useState<{ name: string; value: number }[]>([]);
  const [entregasPorDia, setEntregasPorDia] = useState<{ label: string; entregas: number }[]>([]);

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

    if (entData) {
      const ids = entData.map((e: any) => e.id);
      let itensData: any[] = [];
      if (ids.length > 0) {
        const { data } = await supabase.from('entrega_epi_itens')
          .select('entrega_id, nome_snapshot, ca_snapshot, quantidade')
          .in('entrega_id', ids);
        itensData = data || [];
      }

      entregasList = entData.map((e: any) => {
        const setor = e.colaboradores?.setor || '—';
        setoresSet.add(setor);
        return {
          id: e.id,
          data_hora: e.data_hora,
          motivo: e.motivo,
          colaborador_nome: e.colaboradores?.nome || '—',
          colaborador_setor: setor,
          itens: itensData.filter(i => i.entrega_id === e.id).map(i => ({
            nome: i.nome_snapshot, ca: i.ca_snapshot, qtde: i.quantidade,
          })),
        };
      });
    }

    // Apply setor filter
    if (setorFilter !== 'todos') {
      entregasList = entregasList.filter(e => e.colaborador_setor === setorFilter);
    }

    setEntregas(entregasList);
    setSetores(Array.from(setoresSet).sort());

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
          id: p.id,
          codigo_interno: p.codigo_interno,
          nome: p.nome,
          tipo: p.tipo,
          saldo: typeof saldo === 'number' ? saldo : 0,
          estoque_minimo: p.estoque_minimo,
          custo_unitario: p.custo_unitario || 0,
          data_validade: p.data_validade,
        });
      }
    }
    setEstoque(estoqueList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [selectedEmpresa, dateFrom, dateTo, setorFilter]);

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // --- Export CSV ---
  const exportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const bom = '\uFEFF';
    const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado', description: `Arquivo ${filename} gerado.` });
  };

  const exportEntregasCSV = () => {
    const headers = ['Data', 'Colaborador', 'Setor', 'Motivo', 'Itens', 'Quantidades'];
    const rows = entregas.map(e => [
      new Date(e.data_hora).toLocaleString('pt-BR'),
      e.colaborador_nome,
      e.colaborador_setor,
      e.motivo,
      e.itens.map(i => i.nome).join(', '),
      e.itens.map(i => i.qtde).join(', '),
    ]);
    exportCSV(`entregas_${dateFrom}_${dateTo}.csv`, headers, rows);
  };

  const exportEstoqueCSV = () => {
    const headers = ['Código', 'Produto', 'Tipo', 'Saldo', 'Mínimo', 'Custo Un.', 'Valor Total', 'Validade'];
    const rows = estoque.map(p => [
      p.codigo_interno,
      p.nome,
      p.tipo,
      String(p.saldo),
      String(p.estoque_minimo),
      formatCurrency(p.custo_unitario),
      formatCurrency(p.saldo * p.custo_unitario),
      p.data_validade ? new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
    ]);
    exportCSV('estoque_atual.csv', headers, rows);
  };

  // --- Export PDF (printable HTML) ---
  const exportPDF = (title: string, content: string) => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
  h1 { font-size: 16px; color: #1a2744; margin-bottom: 4px; }
  .meta { font-size: 10px; color: #888; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1a2744; color: white; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
  tr:nth-child(even) { background: #f9f9f9; }
  .footer { margin-top: 16px; font-size: 9px; color: #aaa; text-align: center; border-top: 1px solid #ddd; padding-top: 6px; }
</style></head><body>
  <h1>${title}</h1>
  <div class="meta">Gerado em ${new Date().toLocaleString('pt-BR')} • ${selectedEmpresa?.nome || 'Todas as empresas'}</div>
  ${content}
  <div class="footer">Sistema Gestão de EPI & EPC — Relatório gerado automaticamente</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.onload = () => { w.print(); };
    }
    toast({ title: 'PDF', description: 'Janela de impressão aberta.' });
  };

  const exportEntregasPDF = () => {
    const rows = entregas.map(e =>
      `<tr><td>${new Date(e.data_hora).toLocaleString('pt-BR')}</td><td>${e.colaborador_nome}</td><td>${e.colaborador_setor}</td><td>${e.motivo}</td><td>${e.itens.map(i => `${i.qtde}x ${i.nome}`).join(', ')}</td></tr>`
    ).join('');
    exportPDF(
      `Relatório de Entregas — ${dateFrom} a ${dateTo}`,
      `<table><thead><tr><th>Data</th><th>Colaborador</th><th>Setor</th><th>Motivo</th><th>Itens</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="meta" style="margin-top:8px">Total: ${entregas.length} entregas no período</div>`
    );
  };

  const exportEstoquePDF = () => {
    const rows = estoque.map(p => {
      const baixo = p.saldo < p.estoque_minimo;
      return `<tr style="${baixo ? 'color:#d32f2f;font-weight:bold' : ''}"><td>${p.codigo_interno}</td><td>${p.nome}</td><td>${p.tipo}</td><td style="text-align:right">${p.saldo}</td><td style="text-align:right">${p.estoque_minimo}</td><td style="text-align:right">${formatCurrency(p.custo_unitario)}</td><td style="text-align:right">${formatCurrency(p.saldo * p.custo_unitario)}</td></tr>`;
    }).join('');
    const totalValor = estoque.reduce((s, p) => s + p.saldo * p.custo_unitario, 0);
    exportPDF(
      'Relatório de Estoque Atual',
      `<table><thead><tr><th>Código</th><th>Produto</th><th>Tipo</th><th style="text-align:right">Saldo</th><th style="text-align:right">Mín.</th><th style="text-align:right">Custo Un.</th><th style="text-align:right">Valor Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="meta" style="margin-top:8px">Total: ${estoque.length} produtos • Valor total em estoque: ${formatCurrency(totalValor)}</div>`
    );
  };

  // Summary stats
  const totalItensEntregues = entregas.reduce((s, e) => s + e.itens.reduce((ss, i) => ss + i.qtde, 0), 0);
  const totalValorEstoque = estoque.reduce((s, p) => s + p.saldo * p.custo_unitario, 0);
  const estoqueBaixo = estoque.filter(p => p.saldo < p.estoque_minimo).length;

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
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-end">
          <div className="flex-1 min-w-0">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Período</Label>
            <div className="flex gap-2 mt-1">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Setor</Label>
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className="mt-1 w-40 h-9"><Filter size={13} className="mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos setores</SelectItem>
                {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
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
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-lg border p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Entregas no Período</p>
              <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : entregas.length}</p>
            </div>
            <div className="bg-card rounded-lg border p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Itens Entregues</p>
              <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : totalItensEntregues}</p>
            </div>
            <div className="bg-card rounded-lg border p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Setores Atendidos</p>
              <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : entregasPorSetor.length}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg border p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3">Entregas por Dia</h3>
              <div className="h-48">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Carregando...</div>
                ) : entregasPorDia.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados no período</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={entregasPorDia} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
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
              <div className="h-48">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Carregando...</div>
                ) : entregasPorMotivo.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados no período</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={entregasPorMotivo} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false} style={{ fontSize: 9 }}>
                        {entregasPorMotivo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportEntregasCSV} disabled={entregas.length === 0}>
              <FileDown size={13} /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportEntregasPDF} disabled={entregas.length === 0}>
              <Download size={13} /> Exportar PDF
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-20 rounded skeleton-shimmer" /></td>)}
                      </tr>
                    ))
                  ) : entregas.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-12 text-center text-muted-foreground">Nenhuma entrega no período selecionado.</td></tr>
                  ) : entregas.map(e => (
                    <tr key={e.id} className="table-row-hover">
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(e.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-2.5 font-medium">{e.colaborador_nome}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell"><span className="bg-muted px-1.5 py-0.5 rounded-full text-[10px]">{e.colaborador_setor}</span></td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{e.motivo}</td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">{e.itens.map(i => `${i.qtde}x ${i.nome}`).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* === ESTOQUE TAB === */}
        <TabsContent value="estoque" className="space-y-4 mt-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-lg border p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Produtos</p>
              <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : estoque.length}</p>
            </div>
            <div className="bg-card rounded-lg border p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Valor em Estoque</p>
              <p className="text-xl font-bold text-foreground mt-1">{loading ? '—' : formatCurrency(totalValorEstoque)}</p>
            </div>
            <div className="bg-card rounded-lg border p-3.5 border-l-2 border-l-status-danger">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Abaixo do Mínimo</p>
              <p className="text-xl font-bold text-status-danger mt-1">{loading ? '—' : estoqueBaixo}</p>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportEstoqueCSV} disabled={estoque.length === 0}>
              <FileDown size={13} /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportEstoquePDF} disabled={estoque.length === 0}>
              <Download size={13} /> Exportar PDF
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
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-16 rounded skeleton-shimmer" /></td>)}
                      </tr>
                    ))
                  ) : estoque.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
                  ) : estoque.map(p => {
                    const baixo = p.saldo < p.estoque_minimo;
                    return (
                      <tr key={p.id} className={cn("table-row-hover", baixo && "bg-status-danger-bg/30")}>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{p.codigo_interno}</td>
                        <td className="px-3 py-2.5 font-medium">{p.nome}</td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full",
                            p.tipo === 'EPI' ? 'bg-primary/10 text-primary' : 'bg-status-warning/10 text-status-warning'
                          )}>{p.tipo}</span>
                        </td>
                        <td className={cn("px-3 py-2.5 text-right font-bold tabular-nums", baixo && "text-status-danger")}>{p.saldo}</td>
                        <td className="px-3 py-2.5 text-right hidden sm:table-cell text-muted-foreground">{p.estoque_minimo}</td>
                        <td className="px-3 py-2.5 text-right hidden md:table-cell text-muted-foreground">{p.custo_unitario > 0 ? formatCurrency(p.custo_unitario) : '—'}</td>
                        <td className="px-3 py-2.5 text-right hidden lg:table-cell text-muted-foreground">{p.custo_unitario > 0 ? formatCurrency(p.saldo * p.custo_unitario) : '—'}</td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
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
