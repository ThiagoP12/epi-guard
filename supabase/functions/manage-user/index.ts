import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error('Não autorizado');

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const callerRoles = roleData?.map(r => r.role) || [];
    if (!callerRoles.includes('admin') && !callerRoles.includes('super_admin')) {
      throw new Error('Acesso negado');
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create_user') {
      const { email, password, nome, role, empresa_ids } = body;
      if (!email || !password || !nome) throw new Error('email, password e nome são obrigatórios');
      if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (createErr) throw new Error(createErr.message);

      // Set role
      if (role) {
        // The trigger creates a default role, update it
        const { data: existingRole } = await adminClient
          .from('user_roles')
          .select('id')
          .eq('user_id', newUser.user.id)
          .single();

        if (existingRole) {
          await adminClient.from('user_roles').update({ role }).eq('id', existingRole.id);
        } else {
          await adminClient.from('user_roles').insert({ user_id: newUser.user.id, role });
        }
      }

      // Link empresas
      if (empresa_ids?.length > 0) {
        await adminClient.from('user_empresas').insert(
          empresa_ids.map((eid: string) => ({ user_id: newUser.user.id, empresa_id: eid }))
        );
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_role') {
      const { user_id, role } = body;
      if (!user_id || !role) throw new Error('user_id e role são obrigatórios');

      const { data: existingRole } = await adminClient
        .from('user_roles')
        .select('id')
        .eq('user_id', user_id)
        .single();

      if (existingRole) {
        await adminClient.from('user_roles').update({ role }).eq('id', existingRole.id);
      } else {
        await adminClient.from('user_roles').insert({ user_id, role });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_empresas') {
      const { user_id, empresa_ids } = body;
      if (!user_id) throw new Error('user_id é obrigatório');

      // Remove all current links
      await adminClient.from('user_empresas').delete().eq('user_id', user_id);

      // Add new links
      if (empresa_ids?.length > 0) {
        await adminClient.from('user_empresas').insert(
          empresa_ids.map((eid: string) => ({ user_id, empresa_id: eid }))
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset_password') {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) throw new Error('user_id e new_password são obrigatórios');
      if (new_password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');

      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Ação inválida');
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
