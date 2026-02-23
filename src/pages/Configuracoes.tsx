import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Config {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
}

const labels: Record<string, string> = {
  empresa_razao_social: 'Razão Social',
  empresa_cnpj: 'CNPJ',
  empresa_endereco: 'Endereço',
  empresa_telefone: 'Telefone',
  dias_alerta_vencimento: 'Dias para alerta "vencendo"',
  periodicidade_inspecao_epc: 'Periodicidade inspeção EPC (dias)',
  criterio_epi_atualizado_meses: 'Critério EPI atualizado (meses)',
  data_ultimo_acidente: 'Data do último acidente',
  termo_nr06_texto: 'Texto do Termo NR-06',
};

export default function Configuracoes() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('configuracoes').select('*').order('chave');
      if (data) {
        setConfigs(data as Config[]);
        const v: Record<string, string> = {};
        data.forEach((c: any) => { v[c.chave] = c.valor; });
        setValues(v);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const config of configs) {
      if (values[config.chave] !== config.valor) {
        await supabase.from('configuracoes').update({ valor: values[config.chave] }).eq('id', config.id);
      }
    }
    toast({ title: 'Configurações salvas!' });
    setSaving(false);
  };

  const empresaKeys = ['empresa_razao_social', 'empresa_cnpj', 'empresa_endereco', 'empresa_telefone'];
  const paramKeys = ['dias_alerta_vencimento', 'periodicidade_inspecao_epc', 'criterio_epi_atualizado_meses', 'data_ultimo_acidente'];

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Configurações</h1>
      <div className="max-w-2xl space-y-6">
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Dados da Empresa (Termo NR-06)</h2>
          <div className="space-y-3">
            {empresaKeys.map(key => (
              <div key={key}>
                <Label>{labels[key] || key}</Label>
                <Input value={values[key] || ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Parâmetros do Sistema</h2>
          <div className="grid grid-cols-2 gap-3">
            {paramKeys.map(key => (
              <div key={key}>
                <Label>{labels[key] || key}</Label>
                <Input
                  type={key === 'data_ultimo_acidente' ? 'date' : 'text'}
                  value={values[key] || ''}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save size={16} className="mr-2" /> {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
