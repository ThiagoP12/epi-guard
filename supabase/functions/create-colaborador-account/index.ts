import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error('Não autorizado');

    // Check caller is admin
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    if (roleData?.role !== 'admin' && roleData?.role !== 'super_admin') {
      throw new Error('Apenas administradores podem criar contas de colaboradores');
    }

    const { colaboradorId, email, password } = await req.json();
    if (!colaboradorId || !email || !password) {
      throw new Error('colaboradorId, email e password são obrigatórios');
    }
    if (password.length < 6) {
      throw new Error('Senha deve ter no mínimo 6 caracteres');
    }

    // Get colaborador
    const { data: colab, error: colabErr } = await adminClient
      .from('colaboradores')
      .select('id, nome, user_id, empresa_id')
      .eq('id', colaboradorId)
      .single();

    if (colabErr || !colab) throw new Error('Colaborador não encontrado');
    if (colab.user_id) throw new Error('Colaborador já possui conta de acesso');

    // Create auth user with service role (bypasses email confirmation)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: colab.nome },
    });

    if (createErr) throw new Error(`Erro ao criar conta: ${createErr.message}`);

    // Set role as 'colaborador'
    await adminClient.from('user_roles')
      .upsert({ user_id: newUser.user.id, role: 'colaborador' }, { onConflict: 'user_id,role' });

    // Link colaborador to auth user
    await adminClient
      .from('colaboradores')
      .update({ user_id: newUser.user.id, email })
      .eq('id', colaboradorId);

    // If colaborador has empresa_id, add to user_empresas
    if (colab.empresa_id) {
      await adminClient.from('user_empresas').insert({
        user_id: newUser.user.id,
        empresa_id: colab.empresa_id,
      });
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
