import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, X, HardHat } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ComprovanteData {
  colaborador: {
    nome: string;
    matricula: string;
    setor: string;
    funcao: string;
    empresa?: string;
  };
  solicitacao: {
    id: string;
    produto_nome: string;
    produto_ca: string | null;
    quantidade: number;
    motivo: string;
    status: string;
    created_at: string;
    aprovado_em?: string | null;
    assinatura_base64?: string | null;
    selfie_base64?: string | null;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ComprovanteData | null;
}

export default function ComprovanteSolicitacao({ open, onClose, data }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const { colaborador, solicitacao } = data;

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`comprovante-${solicitacao.id.slice(0, 8)}.pdf`);
  };

  const statusLabel: Record<string, string> = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    entregue: 'Entregue',
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <HardHat size={16} className="text-primary" />
            Comprovante de Solicitação
          </DialogTitle>
        </DialogHeader>

        {/* Printable area */}
        <div ref={printRef} className="bg-white text-gray-900 p-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {/* Header */}
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
            <h1 className="text-lg font-bold tracking-tight">COMPROVANTE DE SOLICITAÇÃO DE EPI</h1>
            <p className="text-xs text-gray-500 mt-1">
              {colaborador.empresa || 'Gestão de EPI & EPC'} • Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>

          {/* Colaborador Info */}
          <div className="mb-5">
            <h2 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Dados do Colaborador</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <Field label="Nome" value={colaborador.nome} />
              <Field label="Matrícula" value={colaborador.matricula} />
              <Field label="Função" value={colaborador.funcao} />
              <Field label="Setor" value={colaborador.setor} />
              {colaborador.empresa && <Field label="Revenda" value={colaborador.empresa} />}
            </div>
          </div>

          {/* Solicitação Info */}
          <div className="mb-5">
            <h2 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Dados da Solicitação</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <Field label="Produto" value={solicitacao.produto_nome} />
              {solicitacao.produto_ca && <Field label="C.A." value={solicitacao.produto_ca} />}
              <Field label="Quantidade" value={String(solicitacao.quantidade)} />
              <Field label="Motivo" value={solicitacao.motivo} />
              <Field label="Status" value={statusLabel[solicitacao.status] || solicitacao.status} />
              <Field label="Solicitado em" value={format(new Date(solicitacao.created_at), 'dd/MM/yyyy HH:mm')} />
              {solicitacao.aprovado_em && (
                <Field label="Aprovado em" value={format(new Date(solicitacao.aprovado_em), 'dd/MM/yyyy HH:mm')} />
              )}
            </div>
          </div>

          {/* Selfie + Signature */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {solicitacao.selfie_base64 && (
              <div>
                <h2 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Foto do Colaborador</h2>
                <img
                  src={solicitacao.selfie_base64}
                  alt="Selfie"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                />
              </div>
            )}
            {solicitacao.assinatura_base64 && (
              <div>
                <h2 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Assinatura Digital</h2>
                <img
                  src={solicitacao.assinatura_base64}
                  alt="Assinatura"
                  className="h-20 border border-gray-300 rounded-lg bg-white p-1"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-300 text-center">
            <p className="text-[10px] text-gray-400">
              ID: {solicitacao.id} • Documento digital com validade jurídica (MP 2.200-2/2001)
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onClose}>
            <X size={14} /> Fechar
          </Button>
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleDownloadPdf}>
            <Download size={14} /> Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-gray-400">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
