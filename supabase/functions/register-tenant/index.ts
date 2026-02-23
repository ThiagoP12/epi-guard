import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user's token to get user id
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Usuário não autenticado");

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { empresa_nome, empresa_cnpj } = await req.json();
    if (!empresa_nome || empresa_nome.trim().length < 2) {
      throw new Error("Nome da empresa é obrigatório");
    }

    // Check if user already has a tenant
    const { data: existingLinks } = await adminClient
      .from("user_empresas")
      .select("id")
      .eq("user_id", user.id);

    if (existingLinks && existingLinks.length > 0) {
      throw new Error("Você já possui uma empresa cadastrada");
    }

    // Create empresa (aprovado = false, needs super_admin approval)
    const { data: empresa, error: empresaError } = await adminClient
      .from("empresas")
      .insert({
        nome: empresa_nome.trim(),
        cnpj: empresa_cnpj?.trim() || null,
        aprovado: false,
      })
      .select("id")
      .single();

    if (empresaError) throw new Error("Erro ao criar empresa: " + empresaError.message);

    // Link user to empresa
    const { error: linkError } = await adminClient
      .from("user_empresas")
      .insert({ user_id: user.id, empresa_id: empresa.id });

    if (linkError) throw new Error("Erro ao vincular usuário: " + linkError.message);

    // Assign admin role to user for this empresa
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: user.id, role: "admin" });

    if (roleError) throw new Error("Erro ao atribuir papel: " + roleError.message);

    return new Response(
      JSON.stringify({ success: true, empresa_id: empresa.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
