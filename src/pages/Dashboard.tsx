import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ClipboardCheck, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ estoqueBaixo: 0, entregasMes: 0, totalColabs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      // Get products with stock below minimum
      const { data: produtos } = await supabase.from('produtos').select('id, estoque_minimo').eq('ativo', true);
      let estoqueBaixo = 0;
      if (produtos) {
        for (const p of produtos) {
          const { data } = await supabase.rpc('get_saldo_produto', { p_produto_id: p.id });
          if (typeof data === 'number' && data < p.estoque_minimo) estoqueBaixo++;
        }
      }

      // Get deliveries this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: entregasMes } = await supabase
        .from('entregas_epi')
        .select('id', { count: 'exact', head: true })
        .gte('data_hora', startOfMonth);

      const { count: totalColabs } = await supabase
        .from('colaboradores')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true);

      setStats({ estoqueBaixo, entregasMes: entregasMes || 0, totalColabs: totalColabs || 0 });
      setLoading(false);
    };
    loadStats();
  }, []);

  const cards = [
    {
      title: 'Estoque Baixo',
      total: stats.estoqueBaixo,
      severity: stats.estoqueBaixo > 0 ? 'danger' : 'ok',
      icon: Package,
      onClick: () => navigate('/estoque?status=baixo'),
    },
    {
      title: 'Entregas do Mês',
      total: stats.entregasMes,
      severity: 'ok',
      icon: ClipboardCheck,
      onClick: () => navigate('/entrega-epi'),
    },
    {
      title: 'Colaboradores Ativos',
      total: stats.totalColabs,
      severity: 'ok',
      icon: Users,
      onClick: () => navigate('/colaboradores'),
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {cards.map((card) => (
          <button key={card.title} onClick={card.onClick} className="card-interactive bg-card rounded-lg border p-5 text-left w-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{loading ? '...' : card.total}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${
                card.severity === 'ok' ? 'bg-status-ok-bg' : 'bg-status-danger-bg'
              }`}>
                <card.icon size={20} className={
                  card.severity === 'ok' ? 'text-status-ok' : 'text-status-danger'
                } />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-card rounded-lg border p-6 text-center">
        <TrendingUp size={32} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">
          Indicadores avançados (Dias sem acidente, % EPI atualizado, EPCs pendentes) serão adicionados na Fase 2.
        </p>
      </div>
    </div>
  );
}
