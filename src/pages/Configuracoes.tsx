import { useState } from 'react';
import { Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function Configuracoes() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Configurações</h1>

      <div className="max-w-2xl space-y-6">
        {/* Empresa */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Dados da Empresa (Termo NR-06)</h2>
          <div className="space-y-3">
            <div>
              <Label>Razão Social</Label>
              <Input defaultValue="Indústria Exemplo S.A." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CNPJ</Label>
                <Input defaultValue="12.345.678/0001-90" className="mt-1" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input defaultValue="(11) 3456-7890" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input defaultValue="Rua das Indústrias, 500 - São Paulo/SP" className="mt-1" />
            </div>
          </div>
        </div>

        {/* Parameters */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Parâmetros do Sistema</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dias para alerta "vencendo"</Label>
                <Input type="number" defaultValue={30} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 30 dias</p>
              </div>
              <div>
                <Label>Periodicidade inspeção EPC (dias)</Label>
                <Input type="number" defaultValue={60} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 60 dias</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Critério "EPI atualizado" (meses)</Label>
                <Input type="number" defaultValue={6} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Padrão: 6 meses</p>
              </div>
              <div>
                <Label>Data do último acidente</Label>
                <Input type="date" defaultValue="2025-10-18" className="mt-1" />
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full sm:w-auto">
          <Save size={16} className="mr-2" /> Salvar Configurações
        </Button>

        {saved && (
          <div className="p-3 rounded-lg status-ok text-sm font-medium text-center animate-fade-in">
            ✓ Configurações salvas com sucesso!
          </div>
        )}
      </div>
    </div>
  );
}
