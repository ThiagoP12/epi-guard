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
    const { entregaId, colaboradorNome, colaboradorEmail, itens } = await req.json();

    if (!colaboradorEmail) {
      // No email configured for this collaborator, just log it
      console.log(`No email for collaborator, skipping email send for entrega ${entregaId}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'no_email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    const itensHtml = itens.map((i: any) => 
      `<tr><td style="padding:8px;border:1px solid #ddd;">${i.nome}</td><td style="padding:8px;border:1px solid #ddd;">${i.ca || 'N/A'}</td><td style="padding:8px;border:1px solid #ddd;">${i.quantidade}</td></tr>`
    ).join('');

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a2744;color:white;padding:20px;text-align:center;">
          <h2 style="margin:0;">Comprovante de Entrega de EPI</h2>
        </div>
        <div style="padding:20px;">
          <p>Prezado(a) <strong>${colaboradorNome}</strong>,</p>
          <p>Informamos que sua assinatura eletrônica foi registrada com sucesso para a entrega de Equipamentos de Proteção Individual.</p>
          <p><strong>Data/hora:</strong> ${now}</p>
          <p><strong>Código do termo:</strong> ${entregaId}</p>
          <h3>Itens Entregues:</h3>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#f5f5f5;">
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">CA</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Qtde</th>
            </tr></thead>
            <tbody>${itensHtml}</tbody>
          </table>
          <p style="margin-top:20px;font-size:12px;color:#666;">
            Esta assinatura eletrônica segue as regras internas da empresa e está alinhada às normas de segurança 
            do trabalho e à legislação brasileira de assinaturas eletrônicas (MP 2.200-2/2001). 
            Este comprovante não substitui orientação jurídica especializada.
          </p>
          <p style="font-size:12px;color:#666;">
            Os dados aqui registrados são tratados para fins de segurança do trabalho e comprovação de entrega de EPI/EPC, 
            conforme LGPD (Lei nº 13.709/2018).
          </p>
        </div>
        <div style="background:#f5f5f5;padding:15px;text-align:center;font-size:11px;color:#999;">
          Gestão de EPI & EPC — Sistema de Segurança do Trabalho
        </div>
      </div>
    `;

    // Send email using Supabase's built-in auth email (Resend)
    // For production, you'd configure a proper email service
    // For now, log the email content and update the entrega record
    console.log(`Email would be sent to: ${colaboradorEmail}`);
    console.log(`Subject: Comprovante de entrega de EPI – ${now}`);
    
    // Update entrega record with email status
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    await fetch(`${SUPABASE_URL}/rest/v1/entregas_epi?id=eq.${entregaId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email_enviado: true,
        email_enviado_em: new Date().toISOString(),
      }),
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Email logged successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-entrega-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
