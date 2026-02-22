import { useState } from 'react';
import { CheckCircle, Search } from 'lucide-react';
import { colaboradores, produtos } from '@/data/mockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const motivos = ['Primeira entrega', 'Troca por desgaste', 'Perda', 'Danificado'];

export default function EntregaEPI() {
  const [colaboradorId, setColaboradorId] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [success, setSuccess] = useState(false);

  const epiProducts = produtos.filter(p => p.tipo === 'EPI' && p.saldo > 0 && p.ativo);
  const selectedProduct = produtos.find(p => p.id === produtoId);

  const handleSubmit = () => {
    if (!colaboradorId || !produtoId || !motivo || quantidade < 1) return;
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Entrega de EPI</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-lg border p-5 space-y-5">
            <div>
              <Label>Colaborador</Label>
              <Select value={colaboradorId} onValueChange={setColaboradorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.filter(c => c.ativo).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} — {c.matricula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Item (EPI)</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar item..." />
                </SelectTrigger>
                <SelectContent>
                  {epiProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — CA: {p.ca} (Saldo: {p.saldo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={selectedProduct?.saldo || 999}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Motivo</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {motivos.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observação (opcional)"
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Signature area placeholder */}
            <div>
              <Label>Assinatura Digital</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg h-32 flex items-center justify-center text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors">
                Clique ou toque para assinar
              </div>
            </div>

            <Button className="w-full h-12 text-base font-semibold" onClick={handleSubmit}>
              <CheckCircle size={18} className="mr-2" />
              Confirmar Entrega
            </Button>

            {success && (
              <div className="p-3 rounded-lg status-ok text-sm font-medium text-center animate-fade-in">
                ✓ Entrega registrada com sucesso!
              </div>
            )}
          </div>
        </div>

        {/* Recent deliveries */}
        <div>
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3">Entregas Recentes</h3>
            <div className="space-y-3">
              {[
                { nome: 'Carlos A. Silva', item: 'Luva Nitrílica x2', data: '20/02' },
                { nome: 'José R. Pereira', item: 'Avental Couro x1', data: '19/02' },
                { nome: 'Patrícia S. Ramos', item: 'Protetor Auricular x5', data: '18/02' },
              ].map((e, i) => (
                <div key={i} className="p-2.5 rounded-md bg-muted/50 text-sm">
                  <p className="font-medium">{e.nome}</p>
                  <p className="text-muted-foreground text-xs">{e.item} • {e.data}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
