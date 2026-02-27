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
    const { colaborador_email, colaborador_nome, assunto, corpo, solicitacao_id } = await req.json();

    if (!colaborador_email) {
      console.log(`No email for collaborator, skipping notification for solicitacao ${solicitacao_id}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'no_email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a2744;color:white;padding:20px;text-align:center;">
          <h2 style="margin:0;">Gestão EPI & EPC</h2>
        </div>
        <div style="padding:20px;">
          <p>Prezado(a) <strong>${colaborador_nome}</strong>,</p>
          ${corpo}
          ${solicitacao_id ? `<p style="font-size:12px;color:#888;">Ref: #${solicitacao_id.slice(0, 8).toUpperCase()}</p>` : ''}
        </div>
        <div style="background:#f5f5f5;padding:15px;text-align:center;font-size:11px;color:#999;">
          Gestão de EPI & EPC — Sistema de Segurança do Trabalho
        </div>
      </div>
    `;

    // Log email (production: integrate with email service)
    console.log(`Email notification to: ${colaborador_email}`);
    console.log(`Subject: ${assunto}`);
    console.log(`Body HTML generated for solicitacao ${solicitacao_id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Notification email logged' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-colaborador:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
