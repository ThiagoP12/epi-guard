import { useState } from 'react';
import { FileText, Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const relatorios = [
  { id: 'consumo', nome: 'Consumo mensal por setor', desc: 'Quantidade e custo de EPI/EPC por setor e período' },
  { id: 'sem-epi', nome: 'Colaboradores sem EPI', desc: 'Lista de colaboradores sem registro de EPI atualizado' },
  { id: 'estoque-baixo', nome: 'Estoque abaixo do mínimo', desc: 'Produtos com saldo abaixo do estoque mínimo configurado' },
  { id: 'vencimentos', nome: 'Itens vencendo e vencidos', desc: 'Produtos e CAs próximos ou após a data de validade' },
  { id: 'custo-mensal', nome: 'Custo por mês', desc: 'Custo total de saídas de estoque por mês' },
  { id: 'ranking-trocas', nome: 'Ranking de trocas por colaborador', desc: 'Trocas por desgaste, perda e danificado por colaborador' },
];

export default function Relatorios() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Relatórios</h1>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Data Inicial</Label>
            <Input type="date" className="mt-1" defaultValue="2026-01-01" />
          </div>
          <div>
            <Label className="text-xs">Data Final</Label>
            <Input type="date" className="mt-1" defaultValue="2026-02-22" />
          </div>
          <div>
            <Label className="text-xs">Setor</Label>
            <Select defaultValue="todos">
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
                <SelectItem value="logistica">Logística</SelectItem>
                <SelectItem value="administrativo">Administrativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select defaultValue="todos">
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="EPI">EPI</SelectItem>
                <SelectItem value="EPC">EPC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Reports grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatorios.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedReport(r.id)}
            className={`card-interactive bg-card rounded-lg border p-5 text-left transition-all ${
              selectedReport === r.id ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <BarChart3 size={18} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{r.nome}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedReport && (
        <div className="mt-6 bg-card rounded-lg border p-6 text-center animate-fade-in">
          <BarChart3 size={40} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm mb-4">
            Selecione os filtros e clique em gerar para visualizar o relatório.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button>
              <FileText size={16} className="mr-2" /> Gerar Relatório
            </Button>
            <Button variant="outline">
              <Download size={16} className="mr-2" /> Exportar PDF
            </Button>
            <Button variant="outline">
              <Download size={16} className="mr-2" /> Exportar Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
