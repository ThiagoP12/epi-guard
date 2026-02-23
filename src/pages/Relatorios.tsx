import { BarChart3, Construction } from 'lucide-react';

export default function Relatorios() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="p-4 rounded-xl bg-muted/50 mb-4">
        <Construction size={40} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">Relatórios</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Relatórios avançados serão implementados na Fase 2, com exportação PDF/Excel e filtros por setor e período.
      </p>
    </div>
  );
}
