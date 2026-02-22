import { useNavigate } from 'react-router-dom';
import {
  Package,
  AlertTriangle,
  Shield,
  ClipboardCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { dashboardStats, alertas } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';

const severityLabel = { ok: 'Normal', warning: 'Atenção', danger: 'Urgente' };

function DashboardCard({
  title,
  total,
  severidade,
  icon: Icon,
  onClick,
}: {
  title: string;
  total: number;
  severidade: 'ok' | 'warning' | 'danger';
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-interactive bg-card rounded-lg border p-5 text-left w-full"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{total}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${
          severidade === 'ok' ? 'bg-status-ok-bg' :
          severidade === 'warning' ? 'bg-status-warning-bg' : 'bg-status-danger-bg'
        }`}>
          <Icon size={20} className={
            severidade === 'ok' ? 'text-status-ok' :
            severidade === 'warning' ? 'text-status-warning' : 'text-status-danger'
          } />
        </div>
      </div>
      <div className="mt-3">
        <StatusBadge status={severidade} label={severityLabel[severidade]} />
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-5">Dashboard</h1>

      {/* Main Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardCard
          title="Estoque Baixo"
          total={dashboardStats.estoqueBaixo.total}
          severidade={dashboardStats.estoqueBaixo.severidade}
          icon={Package}
          onClick={() => navigate('/estoque?status=baixo')}
        />
        <DashboardCard
          title="EPIs Vencendo"
          total={dashboardStats.episVencendo.total}
          severidade={dashboardStats.episVencendo.severidade}
          icon={AlertTriangle}
          onClick={() => navigate('/estoque?status=vencendo')}
        />
        <DashboardCard
          title="EPCs Pendentes"
          total={dashboardStats.epcsPendentes.total}
          severidade={dashboardStats.epcsPendentes.severidade}
          icon={Shield}
          onClick={() => navigate('/controle-epc?status=pendente')}
        />
        <DashboardCard
          title="Entregas do Mês"
          total={dashboardStats.entregasMes.total}
          severidade={dashboardStats.entregasMes.severidade}
          icon={ClipboardCheck}
          onClick={() => navigate('/entrega-epi')}
        />
      </div>

      {/* Differential indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-status-ok-bg">
              <TrendingUp size={18} className="text-status-ok" />
            </div>
            <p className="text-sm text-muted-foreground">Dias sem Acidente</p>
          </div>
          <p className="text-4xl font-bold text-foreground">{dashboardStats.diasSemAcidente}</p>
          <p className="text-xs text-muted-foreground mt-1">Último acidente: 18/10/2025</p>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users size={18} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Colaboradores com EPI Atualizado</p>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-foreground">{dashboardStats.percentualEpiAtualizado}%</p>
            <p className="text-sm text-muted-foreground mb-1">6 de 8</p>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${dashboardStats.percentualEpiAtualizado}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <div className="bg-card rounded-lg border">
        <div className="px-5 py-3.5 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Alertas Recentes</h2>
          <span className="text-xs text-muted-foreground">{alertas.length} alertas</span>
        </div>
        <div className="divide-y">
          {alertas.slice(0, 6).map((alerta) => (
            <div key={alerta.id} className="px-5 py-3 flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full shrink-0 ${
                alerta.severidade === 'danger' ? 'bg-status-danger' :
                alerta.severidade === 'warning' ? 'bg-status-warning' : 'bg-status-ok'
              }`} />
              <p className="text-sm text-foreground flex-1">{alerta.mensagem}</p>
              <span className="text-xs text-muted-foreground shrink-0">{alerta.data}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
