import { Shield, Construction } from 'lucide-react';

export default function ControleEPC() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="p-4 rounded-xl bg-muted/50 mb-4">
        <Construction size={40} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">Controle de EPC</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Este módulo será implementado na Fase 2, com inspeções, anexos de fotos e alertas de vencimento.
      </p>
    </div>
  );
}
