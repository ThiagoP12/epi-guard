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

    // Check caller is admin or super_admin
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const callerRoles = roleData?.map(r => r.role) || [];
    if (!callerRoles.includes('admin') && !callerRoles.includes('super_admin')) {
      throw new Error('Acesso negado');
    }

    // Get all auth users
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 500 });
    if (listErr) throw listErr;

    // Get all profiles, roles, and user_empresas
    const [profilesRes, rolesRes, empresasRes, userEmpresasRes] = await Promise.all([
      adminClient.from('profiles').select('*'),
      adminClient.from('user_roles').select('*'),
      adminClient.from('empresas').select('id, nome'),
      adminClient.from('user_empresas').select('*'),
    ]);

    const profiles = profilesRes.data || [];
    const allRoles = rolesRes.data || [];
    const allEmpresas = empresasRes.data || [];
    const allUserEmpresas = userEmpresasRes.data || [];

    const result = users.map(u => {
      const profile = profiles.find(p => p.id === u.id);
      const userRoles = allRoles.filter(r => r.user_id === u.id).map(r => r.role);
      const userEmpIds = allUserEmpresas.filter(ue => ue.user_id === u.id).map(ue => ue.empresa_id);
      const userEmpresas = allEmpresas.filter(e => userEmpIds.includes(e.id));

      return {
        id: u.id,
        email: u.email,
        nome: profile?.nome || u.user_metadata?.nome || u.email,
        avatar_url: profile?.avatar_url,
        roles: userRoles,
        empresas: userEmpresas,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    return new Response(JSON.stringify({ users: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
