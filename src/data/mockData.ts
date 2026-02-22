// Mock data for the EPI & EPC management system

export interface Produto {
  id: string;
  codigo_interno: string;
  nome: string;
  tipo: 'EPI' | 'EPC';
  ca: string | null;
  marca: string;
  tamanho: string;
  fornecedor: string;
  data_validade: string | null;
  estoque_minimo: number;
  localizacao_fisica: string;
  custo_unitario: number;
  ativo: boolean;
  saldo: number;
}

export interface Colaborador {
  id: string;
  nome: string;
  matricula: string;
  setor: string;
  funcao: string;
  data_admissao: string;
  tamanho_luva: string;
  tamanho_bota: string;
  tamanho_uniforme: string;
  ativo: boolean;
  status_epi: 'atualizado' | 'atencao' | 'irregular';
}

export interface MovimentacaoEstoque {
  id: string;
  produto_id: string;
  tipo_movimentacao: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  quantidade: number;
  motivo: string;
  data_hora: string;
  usuario: string;
  colaborador_nome?: string;
  referencia_nf?: string;
  observacao?: string;
}

export interface EntregaEPI {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  usuario: string;
  data_hora: string;
  motivo: string;
  itens: { produto_nome: string; ca: string; quantidade: number; validade: string | null }[];
}

export interface EPC {
  id: string;
  nome: string;
  local_instalacao: string;
  responsavel: string;
  ultima_inspecao: string;
  proxima_inspecao: string;
  status: 'OK' | 'MANUTENCAO' | 'VENCIDO';
  observacoes: string;
  ativo: boolean;
}

export interface Alerta {
  id: string;
  tipo: 'estoque' | 'validade' | 'epc' | 'epi';
  severidade: 'ok' | 'warning' | 'danger';
  mensagem: string;
  data: string;
}

export const produtos: Produto[] = [
  { id: '1', codigo_interno: 'EPI-001', nome: 'Luva de Proteção Nitrílica', tipo: 'EPI', ca: '32.456', marca: 'SafeHands', tamanho: 'M', fornecedor: 'Distribuidora Segurança Total', data_validade: '2026-08-15', estoque_minimo: 50, localizacao_fisica: 'Prateleira A1', custo_unitario: 12.50, ativo: true, saldo: 120 },
  { id: '2', codigo_interno: 'EPI-002', nome: 'Capacete de Segurança Classe B', tipo: 'EPI', ca: '28.901', marca: 'ProHead', tamanho: 'Único', fornecedor: 'EPI Center', data_validade: '2027-03-20', estoque_minimo: 30, localizacao_fisica: 'Prateleira B2', custo_unitario: 45.00, ativo: true, saldo: 35 },
  { id: '3', codigo_interno: 'EPI-003', nome: 'Bota de Segurança Couro', tipo: 'EPI', ca: '31.222', marca: 'Marluvas', tamanho: '42', fornecedor: 'Calçados Industriais', data_validade: null, estoque_minimo: 20, localizacao_fisica: 'Prateleira C1', custo_unitario: 89.90, ativo: true, saldo: 8 },
  { id: '4', codigo_interno: 'EPI-004', nome: 'Óculos de Proteção Ampla Visão', tipo: 'EPI', ca: '29.876', marca: 'ClearView', tamanho: 'Único', fornecedor: 'Distribuidora Segurança Total', data_validade: '2026-03-10', estoque_minimo: 40, localizacao_fisica: 'Prateleira A3', custo_unitario: 18.00, ativo: true, saldo: 15 },
  { id: '5', codigo_interno: 'EPI-005', nome: 'Protetor Auricular Plug', tipo: 'EPI', ca: '33.100', marca: 'SilentPro', tamanho: 'Único', fornecedor: 'EPI Center', data_validade: '2026-12-01', estoque_minimo: 100, localizacao_fisica: 'Prateleira A2', custo_unitario: 3.50, ativo: true, saldo: 250 },
  { id: '6', codigo_interno: 'EPI-006', nome: 'Respirador PFF2', tipo: 'EPI', ca: '30.555', marca: '3M', tamanho: 'Único', fornecedor: '3M Brasil', data_validade: '2026-04-05', estoque_minimo: 60, localizacao_fisica: 'Prateleira D1', custo_unitario: 8.90, ativo: true, saldo: 45 },
  { id: '7', codigo_interno: 'EPI-007', nome: 'Cinto de Segurança Tipo Paraquedista', tipo: 'EPI', ca: '27.888', marca: 'AltPro', tamanho: 'G', fornecedor: 'Altura Segura', data_validade: '2026-06-20', estoque_minimo: 10, localizacao_fisica: 'Armário E1', custo_unitario: 320.00, ativo: true, saldo: 12 },
  { id: '8', codigo_interno: 'EPC-001', nome: 'Extintor de Incêndio ABC 6kg', tipo: 'EPC', ca: null, marca: 'Kidde', tamanho: '6kg', fornecedor: 'Prevenção Total', data_validade: '2026-09-30', estoque_minimo: 5, localizacao_fisica: 'Depósito Central', custo_unitario: 150.00, ativo: true, saldo: 18 },
  { id: '9', codigo_interno: 'EPC-002', nome: 'Cone de Sinalização 75cm', tipo: 'EPC', ca: null, marca: 'Plastcor', tamanho: '75cm', fornecedor: 'Sinaliza BR', data_validade: null, estoque_minimo: 15, localizacao_fisica: 'Depósito Central', custo_unitario: 35.00, ativo: true, saldo: 22 },
  { id: '10', codigo_interno: 'EPI-008', nome: 'Avental de Raspa de Couro', tipo: 'EPI', ca: '34.200', marca: 'Solda Safe', tamanho: 'Único', fornecedor: 'Soldas & EPI', data_validade: null, estoque_minimo: 10, localizacao_fisica: 'Prateleira C3', custo_unitario: 55.00, ativo: true, saldo: 5 },
];

export const colaboradores: Colaborador[] = [
  { id: '1', nome: 'Carlos Alberto Silva', matricula: 'MAT-001', setor: 'Produção', funcao: 'Operador de Máquina', data_admissao: '2020-03-15', tamanho_luva: 'M', tamanho_bota: '42', tamanho_uniforme: 'G', ativo: true, status_epi: 'atualizado' },
  { id: '2', nome: 'Maria Fernanda Costa', matricula: 'MAT-002', setor: 'Manutenção', funcao: 'Eletricista', data_admissao: '2019-07-20', tamanho_luva: 'P', tamanho_bota: '37', tamanho_uniforme: 'M', ativo: true, status_epi: 'atualizado' },
  { id: '3', nome: 'José Ricardo Pereira', matricula: 'MAT-003', setor: 'Produção', funcao: 'Soldador', data_admissao: '2021-01-10', tamanho_luva: 'G', tamanho_bota: '44', tamanho_uniforme: 'GG', ativo: true, status_epi: 'atencao' },
  { id: '4', nome: 'Ana Paula Oliveira', matricula: 'MAT-004', setor: 'Logística', funcao: 'Operadora de Empilhadeira', data_admissao: '2022-05-08', tamanho_luva: 'P', tamanho_bota: '36', tamanho_uniforme: 'P', ativo: true, status_epi: 'irregular' },
  { id: '5', nome: 'Roberto Santos Lima', matricula: 'MAT-005', setor: 'Manutenção', funcao: 'Mecânico Industrial', data_admissao: '2018-11-25', tamanho_luva: 'G', tamanho_bota: '43', tamanho_uniforme: 'G', ativo: true, status_epi: 'atualizado' },
  { id: '6', nome: 'Patrícia Souza Ramos', matricula: 'MAT-006', setor: 'Produção', funcao: 'Auxiliar de Produção', data_admissao: '2023-02-14', tamanho_luva: 'M', tamanho_bota: '38', tamanho_uniforme: 'M', ativo: true, status_epi: 'atualizado' },
  { id: '7', nome: 'Fernando Alves Dias', matricula: 'MAT-007', setor: 'Logística', funcao: 'Conferente', data_admissao: '2021-09-03', tamanho_luva: 'M', tamanho_bota: '41', tamanho_uniforme: 'M', ativo: true, status_epi: 'atencao' },
  { id: '8', nome: 'Luciana Martins Rocha', matricula: 'MAT-008', setor: 'Administrativo', funcao: 'Técnica de Segurança', data_admissao: '2019-04-12', tamanho_luva: 'P', tamanho_bota: '36', tamanho_uniforme: 'P', ativo: true, status_epi: 'atualizado' },
];

export const epcs: EPC[] = [
  { id: '1', nome: 'Guarda-corpo Plataforma Nível 2', local_instalacao: 'Galpão A - Plataforma 2', responsavel: 'Roberto Santos Lima', ultima_inspecao: '2026-01-15', proxima_inspecao: '2026-03-15', status: 'OK', observacoes: 'Pintura em bom estado', ativo: true },
  { id: '2', nome: 'Extintor CO2 - Sala Elétrica', local_instalacao: 'Subestação Principal', responsavel: 'Maria Fernanda Costa', ultima_inspecao: '2025-11-20', proxima_inspecao: '2026-02-20', status: 'VENCIDO', observacoes: 'Necessita recarga', ativo: true },
  { id: '3', nome: 'Lava-olhos de Emergência', local_instalacao: 'Laboratório Químico', responsavel: 'Luciana Martins Rocha', ultima_inspecao: '2026-02-01', proxima_inspecao: '2026-04-01', status: 'OK', observacoes: 'Funcionando normalmente', ativo: true },
  { id: '4', nome: 'Sistema de Ventilação Exaustora', local_instalacao: 'Galpão B - Setor de Pintura', responsavel: 'Carlos Alberto Silva', ultima_inspecao: '2025-12-10', proxima_inspecao: '2026-02-10', status: 'MANUTENCAO', observacoes: 'Filtros necessitam troca', ativo: true },
  { id: '5', nome: 'Rede de Proteção Contra Queda', local_instalacao: 'Cobertura Galpão A', responsavel: 'Roberto Santos Lima', ultima_inspecao: '2026-01-28', proxima_inspecao: '2026-04-28', status: 'OK', observacoes: 'Cabos em bom estado', ativo: true },
];

export const entregasRecentes: EntregaEPI[] = [
  { id: '1', colaborador_id: '1', colaborador_nome: 'Carlos Alberto Silva', usuario: 'Admin', data_hora: '2026-02-20 08:30', motivo: 'Troca por desgaste', itens: [{ produto_nome: 'Luva de Proteção Nitrílica', ca: '32.456', quantidade: 2, validade: '2026-08-15' }] },
  { id: '2', colaborador_id: '3', colaborador_nome: 'José Ricardo Pereira', usuario: 'Admin', data_hora: '2026-02-19 14:15', motivo: 'Primeira entrega', itens: [{ produto_nome: 'Avental de Raspa de Couro', ca: '34.200', quantidade: 1, validade: null }, { produto_nome: 'Óculos de Proteção Ampla Visão', ca: '29.876', quantidade: 1, validade: '2026-03-10' }] },
  { id: '3', colaborador_id: '6', colaborador_nome: 'Patrícia Souza Ramos', usuario: 'Admin', data_hora: '2026-02-18 10:00', motivo: 'Primeira entrega', itens: [{ produto_nome: 'Protetor Auricular Plug', ca: '33.100', quantidade: 5, validade: '2026-12-01' }] },
];

export const alertas: Alerta[] = [
  { id: '1', tipo: 'estoque', severidade: 'danger', mensagem: 'Bota de Segurança Couro: saldo (8) abaixo do mínimo (20)', data: '2026-02-22' },
  { id: '2', tipo: 'estoque', severidade: 'danger', mensagem: 'Avental de Raspa de Couro: saldo (5) abaixo do mínimo (10)', data: '2026-02-22' },
  { id: '3', tipo: 'estoque', severidade: 'warning', mensagem: 'Óculos de Proteção: saldo (15) próximo do mínimo (40)', data: '2026-02-22' },
  { id: '4', tipo: 'validade', severidade: 'warning', mensagem: 'Óculos de Proteção Ampla Visão: vence em 16 dias (10/03/2026)', data: '2026-02-22' },
  { id: '5', tipo: 'validade', severidade: 'warning', mensagem: 'Respirador PFF2: vence em 42 dias (05/04/2026)', data: '2026-02-22' },
  { id: '6', tipo: 'epc', severidade: 'danger', mensagem: 'Extintor CO2 - Sala Elétrica: inspeção vencida (20/02/2026)', data: '2026-02-22' },
  { id: '7', tipo: 'epc', severidade: 'warning', mensagem: 'Sistema de Ventilação Exaustora: em manutenção', data: '2026-02-22' },
  { id: '8', tipo: 'epi', severidade: 'danger', mensagem: 'Ana Paula Oliveira: EPI irregular', data: '2026-02-22' },
];

// Dashboard stats
export const dashboardStats = {
  estoqueBaixo: { total: 3, severidade: 'danger' as const },
  episVencendo: { total: 2, severidade: 'warning' as const },
  epcsPendentes: { total: 2, severidade: 'danger' as const },
  entregasMes: { total: 14, severidade: 'ok' as const },
  diasSemAcidente: 127,
  percentualEpiAtualizado: 75,
};
