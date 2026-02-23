import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, FileDown, Loader2, Search, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface EntregaRow {
  id: string;
  data_hora: string;
  motivo: string;
  observacao: string | null;
  colaborador: { nome: string; matricula: string; setor: string };
  itens: { nome_snapshot: string; ca_snapshot: string | null; quantidade: number }[];
}

export default function HistoricoEntregas() {
  const { selectedEmpresa } = useEmpresa();
  const { toast } = useToast();

  const [entregas, setEntregas] = useState<EntregaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFilter, setMotivoFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  useEffect(() => {
    loadEntregas();
  }, [selectedEmpresa]);

  const loadEntregas = async () => {
    setLoading(true);
    let query = supabase
      .from('entregas_epi')
      .select('id, data_hora, motivo, observacao, colaborador_id')
      .order('data_hora', { ascending: false })
      .limit(500);

    if (selectedEmpresa) query = query.eq('empresa_id', selectedEmpresa.id);

    const { data: entregasData, error } = await query;
    if (error || !entregasData) {
      setLoading(false);
      return;
    }

    // Fetch collaborators and items in parallel
    const colabIds = [...new Set(entregasData.map(e => e.colaborador_id))];
    const entregaIds = entregasData.map(e => e.id);

    const [colabRes, itensRes] = await Promise.all([
      supabase.from('colaboradores').select('id, nome, matricula, setor').in('id', colabIds),
      supabase.from('entrega_epi_itens').select('entrega_id, nome_snapshot, ca_snapshot, quantidade').in('entrega_id', entregaIds),
    ]);

    const colabMap = new Map((colabRes.data || []).map(c => [c.id, c]));
    const itensMap = new Map<string, typeof itensRes.data>();
    for (const item of itensRes.data || []) {
      const list = itensMap.get(item.entrega_id) || [];
      list.push(item);
      itensMap.set(item.entrega_id, list);
    }

    const rows: EntregaRow[] = entregasData.map(e => ({
      id: e.id,
      data_hora: e.data_hora,
      motivo: e.motivo,
      observacao: e.observacao,
      colaborador: colabMap.get(e.colaborador_id) || { nome: 'Desconhecido', matricula: '-', setor: '-' },
      itens: (itensMap.get(e.id) || []).map(i => ({ nome_snapshot: i.nome_snapshot, ca_snapshot: i.ca_snapshot, quantidade: i.quantidade })),
    }));

    setEntregas(rows);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return entregas.filter(e => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match = e.colaborador.nome.toLowerCase().includes(s)
          || e.colaborador.matricula.toLowerCase().includes(s)
          || e.itens.some(i => i.nome_snapshot.toLowerCase().includes(s));
        if (!match) return false;
      }
      if (motivoFilter !== 'all' && e.motivo !== motivoFilter) return false;
      if (dateFrom && new Date(e.data_hora) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(e.data_hora) > end) return false;
      }
      return true;
    });
  }, [entregas, searchTerm, motivoFilter, dateFrom, dateTo]);

  const handleDownloadPdf = async (entregaId: string) => {
    setDownloadingId(entregaId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-nr06-pdf', {
        body: { entregaId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('URL do documento não retornada');
      window.open(data.url, '_blank');
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    }
    setDownloadingId(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setMotivoFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasFilters = searchTerm || motivoFilter !== 'all' || dateFrom || dateTo;

  const motivos = ['Primeira entrega', 'Troca por desgaste', 'Perda', 'Danificado', 'Outro'];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Histórico de Entregas</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Consulte e reimprima termos NR-06</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador, matrícula ou item..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={motivoFilter} onValueChange={setMotivoFilter}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <Filter size={13} className="mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Motivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motivos</SelectItem>
              {motivos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", dateFrom && "text-foreground")}>
                <CalendarIcon size={13} />
                {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'De'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", dateTo && "text-foreground")}>
                <CalendarIcon size={13} />
                {dateTo ? format(dateTo, 'dd/MM/yy') : 'Até'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1 text-muted-foreground">
              <X size={13} /> Limpar
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {filtered.length} entrega{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">Nenhuma entrega encontrada.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Colaborador</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Setor</TableHead>
                <TableHead className="text-xs">Itens</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Motivo</TableHead>
                <TableHead className="text-xs w-[90px]">Termo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(e.data_hora), "dd/MM/yy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium leading-none">{e.colaborador.nome}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{e.colaborador.matricula}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{e.colaborador.setor}</TableCell>
                  <TableCell>
                    {e.itens.map((item, idx) => (
                      <p key={idx} className="text-xs leading-snug">
                        {item.quantidade}x {item.nome_snapshot}
                        {item.ca_snapshot && <span className="text-muted-foreground"> CA:{item.ca_snapshot}</span>}
                      </p>
                    ))}
                  </TableCell>
                  <TableCell className="text-xs hidden sm:table-cell">{e.motivo}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => handleDownloadPdf(e.id)}
                      disabled={downloadingId === e.id}
                    >
                      {downloadingId === e.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
