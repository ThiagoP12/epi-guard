import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entregaId } = await req.json();
    if (!entregaId) throw new Error('entregaId is required');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Fetch entrega
    const entregaRes = await fetch(
      `${SUPABASE_URL}/rest/v1/entregas_epi?id=eq.${entregaId}&select=*`,
      { headers }
    );
    const [entrega] = await entregaRes.json();
    if (!entrega) throw new Error('Entrega not found');

    // Fetch colaborador
    const colabRes = await fetch(
      `${SUPABASE_URL}/rest/v1/colaboradores?id=eq.${entrega.colaborador_id}&select=*`,
      { headers }
    );
    const [colab] = await colabRes.json();

    // Fetch itens
    const itensRes = await fetch(
      `${SUPABASE_URL}/rest/v1/entrega_epi_itens?entrega_id=eq.${entregaId}&select=*`,
      { headers }
    );
    const itens = await itensRes.json();

    // Fetch empresa config
    const configRes = await fetch(
      `${SUPABASE_URL}/rest/v1/configuracoes?select=chave,valor`,
      { headers }
    );
    const configs = await configRes.json();
    const cfg = (key: string) => configs.find((c: any) => c.chave === key)?.valor || '';

    const empresaNome = cfg('empresa_nome') || 'Empresa';
    const empresaCnpj = cfg('empresa_cnpj') || '';
    const empresaEndereco = cfg('empresa_endereco') || '';

    const dataEntrega = new Date(entrega.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dataAdmissao = colab?.data_admissao
      ? new Date(colab.data_admissao + 'T12:00:00').toLocaleDateString('pt-BR')
      : '—';

    // Build itens table rows
    const itensRows = itens.map((item: any, i: number) => {
      const validade = item.validade_snapshot
        ? new Date(item.validade_snapshot + 'T12:00:00').toLocaleDateString('pt-BR')
        : '—';
      return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #bbb;text-align:center;font-size:11px;">${i + 1}</td>
          <td style="padding:6px 10px;border:1px solid #bbb;font-size:11px;">${item.nome_snapshot}</td>
          <td style="padding:6px 10px;border:1px solid #bbb;text-align:center;font-size:11px;">${item.ca_snapshot || 'N/A'}</td>
          <td style="padding:6px 10px;border:1px solid #bbb;text-align:center;font-size:11px;">${item.quantidade}</td>
          <td style="padding:6px 10px;border:1px solid #bbb;text-align:center;font-size:11px;">${validade}</td>
        </tr>`;
    }).join('');

    // Signature image
    const assinaturaImg = entrega.assinatura_base64
      ? `<img src="${entrega.assinatura_base64}" style="max-width:280px;max-height:100px;" />`
      : '<span style="color:#999;font-size:11px;">Sem assinatura</span>';

    // Build full NR-06 Term HTML
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px solid #1a2744; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 16px; color: #1a2744; margin-bottom: 2px; letter-spacing: 1px; }
    .header h2 { font-size: 13px; font-weight: normal; color: #444; }
    .empresa { font-size: 11px; color: #555; margin-top: 6px; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 12px; font-weight: bold; color: #1a2744; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 11px; }
    .info-grid .label { font-weight: bold; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #1a2744; color: white; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1a2744; }
    .declaracao { background: #f7f8fa; border: 1px solid #ddd; border-radius: 4px; padding: 12px 14px; font-size: 10.5px; color: #333; line-height: 1.6; margin-top: 6px; }
    .assinatura-box { margin-top: 16px; display: flex; gap: 40px; }
    .assinatura-col { flex: 1; text-align: center; }
    .assinatura-col .line { border-top: 1px solid #333; margin-top: 8px; padding-top: 4px; font-size: 10px; color: #555; }
    .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9px; color: #999; text-align: center; }
    .meta { font-size: 9px; color: #aaa; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>FICHA DE ENTREGA DE EPI</h1>
    <h2>Norma Regulamentadora NR-06 — Equipamento de Proteção Individual</h2>
    <div class="empresa">
      <strong>${empresaNome}</strong>
      ${empresaCnpj ? ` — CNPJ: ${empresaCnpj}` : ''}
      ${empresaEndereco ? `<br/>${empresaEndereco}` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Colaborador</div>
    <div class="info-grid">
      <div><span class="label">Nome:</span> ${colab?.nome || '—'}</div>
      <div><span class="label">Matrícula:</span> ${colab?.matricula || '—'}</div>
      <div><span class="label">Função:</span> ${colab?.funcao || '—'}</div>
      <div><span class="label">Setor:</span> ${colab?.setor || '—'}</div>
      <div><span class="label">Admissão:</span> ${dataAdmissao}</div>
      <div><span class="label">E-mail:</span> ${colab?.email || '—'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Entrega</div>
    <div class="info-grid">
      <div><span class="label">Data/Hora:</span> ${dataEntrega}</div>
      <div><span class="label">Motivo:</span> ${entrega.motivo}</div>
      <div><span class="label">Código:</span> ${entregaId.substring(0, 8).toUpperCase()}</div>
      <div><span class="label">Versão Termo:</span> ${entrega.versao_termo || '1.0'}</div>
    </div>
    ${entrega.observacao ? `<div style="margin-top:6px;font-size:11px;"><span class="label">Observação:</span> ${entrega.observacao}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Equipamentos Entregues</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Descrição do EPI</th>
          <th style="width:70px;">C.A.</th>
          <th style="width:50px;">Qtde</th>
          <th style="width:80px;">Validade</th>
        </tr>
      </thead>
      <tbody>
        ${itensRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Termo de Responsabilidade</div>
    <div class="declaracao">
      <strong>DECLARO</strong> que recebi da empresa <strong>${empresaNome}</strong> os Equipamentos de Proteção Individual (EPI) 
      acima descritos, adequados ao risco da atividade, em perfeito estado de conservação e funcionamento, e que fui 
      devidamente orientado e treinado sobre o uso correto, guarda, conservação e higienização dos mesmos, conforme 
      determina a Norma Regulamentadora NR-06 (Portaria MTb nº 3.214/78 e suas atualizações).
      <br/><br/>
      <strong>COMPROMETO-ME</strong> a: (a) utilizar os EPIs exclusivamente para a finalidade a que se destinam; 
      (b) responsabilizar-me pela guarda e conservação; (c) comunicar ao empregador qualquer alteração que os torne 
      impróprios para uso; (d) cumprir as determinações do empregador sobre o uso adequado.
      <br/><br/>
      Estou ciente de que o uso é obrigatório conforme Art. 158 da CLT e NR-06, e que o descumprimento poderá 
      acarretar as sanções previstas na legislação trabalhista.
    </div>
  </div>

  <div class="section">
    <div class="section-title">Assinaturas</div>
    <div class="assinatura-box">
      <div class="assinatura-col">
        ${assinaturaImg}
        <div class="line"><strong>${colab?.nome || '—'}</strong><br/>Colaborador</div>
      </div>
      <div class="assinatura-col">
        <div style="height:60px;"></div>
        <div class="line">Responsável pela entrega</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Documento gerado eletronicamente em ${dataEntrega} — Sistema de Gestão EPI & EPC<br/>
    <span class="meta">
      IP: ${entrega.ip_origem || '—'} | User-Agent: ${(entrega.user_agent || '—').substring(0, 80)} | 
      Declaração aceita: ${entrega.declaracao_aceita ? 'Sim' : 'Não'} | 
      Hash: ${entrega.pdf_hash || '—'}
    </span>
    <br/>
    <span class="meta">
      Este documento possui validade jurídica conforme MP 2.200-2/2001 e LGPD (Lei nº 13.709/2018).
    </span>
  </div>
</body>
</html>`;

    // Return the HTML — the frontend will use browser print/PDF functionality
    return new Response(
      JSON.stringify({ success: true, html, filename: `NR06_${colab?.nome?.replace(/\\s+/g, '_') || 'termo'}_${entregaId.substring(0, 8)}.pdf` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating NR-06 PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
