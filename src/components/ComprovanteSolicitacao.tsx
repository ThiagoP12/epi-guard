import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, X, HardHat, ShieldCheck } from 'lucide-react';
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
    ip_origem?: string | null;
    user_agent?: string | null;
    pdf_hash?: string | null;
    geo_latitude?: number | null;
    geo_longitude?: number | null;
    assinado_em?: string | null;
    cpf_colaborador?: string | null;
    email_colaborador?: string | null;
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
    CRIADA: 'Criada',
    ENVIADA: 'Enviada',
    APROVADA: 'Aprovada',
    REPROVADA: 'Reprovada',
    EM_SEPARACAO: 'Em Separação',
    BAIXADA_NO_ESTOQUE: 'Baixada no Estoque',
    ENTREGUE: 'Entregue',
    CONFIRMADA: 'Confirmada',
  };

  const hashShort = solicitacao.pdf_hash ? `${solicitacao.pdf_hash.slice(0, 16)}...${solicitacao.pdf_hash.slice(-8)}` : null;

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
            <h2 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Identificação do Signatário</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <Field label="Nome Completo" value={colaborador.nome} />
              <Field label="Matrícula" value={colaborador.matricula} />
              <Field label="Função" value={colaborador.funcao} />
              <Field label="Setor" value={colaborador.setor} />
              {solicitacao.cpf_colaborador && <Field label="CPF" value={maskCpf(solicitacao.cpf_colaborador)} />}
              {solicitacao.email_colaborador && <Field label="E-mail" value={solicitacao.email_colaborador} />}
              {colaborador.empresa && <Field label="Empresa" value={colaborador.empresa} />}
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
              <Field label="Solicitado em" value={format(new Date(solicitacao.created_at), 'dd/MM/yyyy HH:mm:ss')} />
              {solicitacao.aprovado_em && (
                <Field label="Aprovado em" value={format(new Date(solicitacao.aprovado_em), 'dd/MM/yyyy HH:mm:ss')} />
              )}
            </div>
          </div>

          {/* Selfie + Signature */}
          <div className="grid grid-cols-2 gap-4 mb-5">
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

          {/* Audit Certificate */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                <ShieldCheck size={12} className="text-white" />
              </div>
              <h2 className="text-xs font-bold uppercase text-gray-700 tracking-wider">Certificado de Assinatura Digital</h2>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-[11px]">
              <AuditField label="ID do Documento" value={solicitacao.id} />
              {solicitacao.assinado_em && (
                <AuditField label="Assinado em" value={format(new Date(solicitacao.assinado_em), 'dd/MM/yyyy HH:mm:ss (xxx)')} />
              )}
              {solicitacao.ip_origem && (
                <AuditField label="Endereço IP" value={solicitacao.ip_origem} />
              )}
              {solicitacao.geo_latitude != null && solicitacao.geo_longitude != null && (
                <AuditField label="Geolocalização" value={`${solicitacao.geo_latitude.toFixed(6)}, ${solicitacao.geo_longitude.toFixed(6)}`} />
              )}
              {solicitacao.user_agent && (
                <AuditField label="Dispositivo" value={parseUserAgent(solicitacao.user_agent)} />
              )}
              {hashShort && (
                <AuditField label="Hash SHA-256" value={hashShort} mono />
              )}
              <AuditField label="Método" value="Assinatura Eletrônica Avançada (canvas + selfie + geolocalização)" />
            </div>
          </div>

          {/* Declaration */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong>DECLARAÇÃO:</strong> O signatário acima identificado declara que as informações prestadas são verdadeiras 
              e que necessita do EPI solicitado para execução segura de suas atividades. A assinatura eletrônica aqui aposta 
              possui validade jurídica nos termos do art. 10, §2º da MP 2.200-2/2001, sendo verificável através da trilha 
              de auditoria acima. Este documento é protegido por hash criptográfico SHA-256 que garante sua integridade 
              e imutabilidade após a assinatura.
            </p>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-gray-300 text-center space-y-1">
            <p className="text-[10px] text-gray-500 font-medium">
              ✅ Documento assinado digitalmente • Integridade verificável por hash SHA-256
            </p>
            <p className="text-[9px] text-gray-400">
              Validade jurídica: MP 2.200-2/2001 • Lei 14.063/2020 • Art. 411, CPC
            </p>
            {solicitacao.pdf_hash && (
              <p className="text-[8px] text-gray-400 font-mono break-all">
                Hash: {solicitacao.pdf_hash}
              </p>
            )}
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

function AuditField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 min-w-[110px]">{label}:</span>
      <span className={`text-gray-800 font-medium break-all ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
    </div>
  );
}

function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf;
}

function parseUserAgent(ua: string): string {
  if (ua.includes('iPhone')) return 'iPhone (iOS)';
  if (ua.includes('iPad')) return 'iPad (iOS)';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Navegador Web';
}
