
-- Grant existing admin users super_admin role too
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- Update handle_new_user to only create profile (no auto role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  RETURN NEW;
END;
$function$;

-- Update user_has_empresa_access: only super_admin bypasses
CREATE OR REPLACE FUNCTION public.user_has_empresa_access(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(_user_id, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_empresas
      WHERE user_id = _user_id AND empresa_id = _empresa_id
    )
$$;

-- ===== RLS POLICY UPDATES =====

-- COLABORADORES
DROP POLICY IF EXISTS "Admin almox manage colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Auth read colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Colaborador read own record" ON public.colaboradores;

CREATE POLICY "Manage colaboradores in own empresas"
ON public.colaboradores FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
  )
);

CREATE POLICY "Read colaboradores in own empresas"
ON public.colaboradores FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
  OR (user_id = auth.uid())
);

-- PRODUTOS
DROP POLICY IF EXISTS "Admin almox manage produtos" ON public.produtos;
DROP POLICY IF EXISTS "Auth read produtos" ON public.produtos;
DROP POLICY IF EXISTS "Colaborador read produtos" ON public.produtos;

CREATE POLICY "Manage produtos in own empresas"
ON public.produtos FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
  )
);

CREATE POLICY "Read produtos in own empresas"
ON public.produtos FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
);

-- ENTREGAS_EPI
DROP POLICY IF EXISTS "Admin almox insert entregas" ON public.entregas_epi;
DROP POLICY IF EXISTS "Admin almox update entregas" ON public.entregas_epi;
DROP POLICY IF EXISTS "Auth read entregas" ON public.entregas_epi;

CREATE POLICY "Insert entregas in own empresas"
ON public.entregas_epi FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
  )
);

CREATE POLICY "Update entregas in own empresas"
ON public.entregas_epi FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
  )
);

CREATE POLICY "Read entregas in own empresas"
ON public.entregas_epi FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
);

-- MOVIMENTACOES_ESTOQUE
DROP POLICY IF EXISTS "Admin almox insert movimentacoes" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "Auth read movimentacoes" ON public.movimentacoes_estoque;

CREATE POLICY "Insert movimentacoes in own empresas"
ON public.movimentacoes_estoque FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
  )
);

CREATE POLICY "Read movimentacoes in own empresas"
ON public.movimentacoes_estoque FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
);

-- SOLICITACOES_EPI
DROP POLICY IF EXISTS "Admin almox update solicitacoes" ON public.solicitacoes_epi;
DROP POLICY IF EXISTS "Colaborador insert own solicitacoes" ON public.solicitacoes_epi;
DROP POLICY IF EXISTS "Colaborador read own solicitacoes" ON public.solicitacoes_epi;

CREATE POLICY "Update solicitacoes in own empresas"
ON public.solicitacoes_epi FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
  )
);

CREATE POLICY "Colaborador insert own solicitacoes mt"
ON public.solicitacoes_epi FOR INSERT
WITH CHECK (
  colaborador_id IN (
    SELECT id FROM colaboradores WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Read solicitacoes in own empresas"
ON public.solicitacoes_epi FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
  OR (colaborador_id IN (SELECT id FROM colaboradores WHERE user_id = auth.uid()))
);

-- INSPECOES_EPC
DROP POLICY IF EXISTS "Admin almox manage inspecoes" ON public.inspecoes_epc;
DROP POLICY IF EXISTS "Auth read inspecoes" ON public.inspecoes_epc;

CREATE POLICY "Manage inspecoes in own empresas"
ON public.inspecoes_epc FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'almoxarifado'::app_role))
  )
);

CREATE POLICY "Read inspecoes in own empresas"
ON public.inspecoes_epc FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
);

-- FUNCOES
DROP POLICY IF EXISTS "Admin manage funcoes" ON public.funcoes;
DROP POLICY IF EXISTS "Auth read funcoes" ON public.funcoes;

CREATE POLICY "Admin manage funcoes in own empresas"
ON public.funcoes FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Read funcoes in own empresas"
ON public.funcoes FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
);

-- SETORES
DROP POLICY IF EXISTS "Admin manage setores" ON public.setores;
DROP POLICY IF EXISTS "Auth read setores" ON public.setores;

CREATE POLICY "Admin manage setores in own empresas"
ON public.setores FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    user_has_empresa_access(auth.uid(), empresa_id)
    AND has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Read setores in own empresas"
ON public.setores FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), empresa_id)
);

-- EMPRESAS
DROP POLICY IF EXISTS "Admin manage empresas" ON public.empresas;
DROP POLICY IF EXISTS "Auth read empresas" ON public.empresas;

CREATE POLICY "Super admin manage all empresas"
ON public.empresas FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin update own empresa"
ON public.empresas FOR UPDATE
USING (
  user_has_empresa_access(auth.uid(), id)
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Read own empresas"
ON public.empresas FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_has_empresa_access(auth.uid(), id)
);

-- ENTREGA_EPI_ITENS
DROP POLICY IF EXISTS "Admin almox insert entrega itens" ON public.entrega_epi_itens;
DROP POLICY IF EXISTS "Auth read entrega itens" ON public.entrega_epi_itens;

CREATE POLICY "Insert entrega itens with role"
ON public.entrega_epi_itens FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'almoxarifado'::app_role)
);

CREATE POLICY "Read entrega itens in own empresas"
ON public.entrega_epi_itens FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR entrega_id IN (
    SELECT id FROM entregas_epi WHERE user_has_empresa_access(auth.uid(), empresa_id)
  )
);

-- USER_EMPRESAS
DROP POLICY IF EXISTS "Admin manage user_empresas" ON public.user_empresas;
DROP POLICY IF EXISTS "Users read own empresas" ON public.user_empresas;

CREATE POLICY "Super admin manage user_empresas"
ON public.user_empresas FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin manage user_empresas in own empresas"
ON public.user_empresas FOR ALL
USING (
  user_has_empresa_access(auth.uid(), empresa_id)
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users read own empresa links"
ON public.user_empresas FOR SELECT
USING (auth.uid() = user_id);

-- USER_ROLES
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;

CREATE POLICY "Super admin manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users read own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- PROFILES
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;

CREATE POLICY "Super admin read all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- CONFIGURACOES
DROP POLICY IF EXISTS "Admins manage config" ON public.configuracoes;
DROP POLICY IF EXISTS "Auth read config" ON public.configuracoes;

CREATE POLICY "Admin or super manage config"
ON public.configuracoes FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth read config"
ON public.configuracoes FOR SELECT
USING (true);
