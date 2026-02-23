
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'almoxarifado', 'gestor');
CREATE TYPE public.tipo_produto AS ENUM ('EPI', 'EPC');
CREATE TYPE public.tipo_movimentacao AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');
CREATE TYPE public.ajuste_tipo AS ENUM ('AUMENTO', 'REDUCAO');
CREATE TYPE public.motivo_entrega AS ENUM ('Primeira entrega', 'Troca por desgaste', 'Perda', 'Danificado', 'Outro');

-- 1. User roles (needed by has_role function)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- 3. user_roles policies
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  setor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Trigger for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'almoxarifado');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Colaboradores
CREATE TABLE public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL, matricula TEXT NOT NULL UNIQUE, setor TEXT NOT NULL, funcao TEXT NOT NULL,
  data_admissao DATE NOT NULL DEFAULT CURRENT_DATE, tamanho_luva TEXT, tamanho_bota TEXT,
  tamanho_uniforme TEXT, email TEXT, ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read colaboradores" ON public.colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin almox manage colaboradores" ON public.colaboradores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'almoxarifado'));

-- 7. Produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, tipo tipo_produto NOT NULL, ca TEXT,
  marca TEXT, tamanho TEXT, fornecedor TEXT, data_validade DATE,
  estoque_minimo INTEGER NOT NULL DEFAULT 0, localizacao_fisica TEXT,
  custo_unitario NUMERIC(10,2) DEFAULT 0, ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin almox manage produtos" ON public.produtos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'almoxarifado'));

-- 8. Movimentacoes
CREATE TABLE public.movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) NOT NULL,
  tipo_movimentacao tipo_movimentacao NOT NULL, quantidade INTEGER NOT NULL,
  ajuste_tipo ajuste_tipo, motivo TEXT, data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID REFERENCES auth.users(id) NOT NULL,
  colaborador_id UUID REFERENCES public.colaboradores(id),
  referencia_nf TEXT, observacao TEXT, entrega_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read movimentacoes" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin almox insert movimentacoes" ON public.movimentacoes_estoque FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'almoxarifado'));

-- 9. Saldo function
CREATE OR REPLACE FUNCTION public.get_saldo_produto(p_produto_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE
    WHEN tipo_movimentacao = 'ENTRADA' THEN quantidade
    WHEN tipo_movimentacao = 'SAIDA' THEN -quantidade
    WHEN tipo_movimentacao = 'AJUSTE' AND ajuste_tipo = 'AUMENTO' THEN quantidade
    WHEN tipo_movimentacao = 'AJUSTE' AND ajuste_tipo = 'REDUCAO' THEN -quantidade
    ELSE 0 END), 0)::INTEGER
  FROM public.movimentacoes_estoque WHERE produto_id = p_produto_id
$$;

-- 10. Entregas
CREATE TABLE public.entregas_epi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES public.colaboradores(id) NOT NULL,
  usuario_id UUID REFERENCES auth.users(id) NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(), motivo motivo_entrega NOT NULL, observacao TEXT,
  assinatura_base64 TEXT NOT NULL, declaracao_aceita BOOLEAN NOT NULL DEFAULT true,
  ip_origem TEXT, user_agent TEXT, versao_termo TEXT DEFAULT '1.0', pdf_hash TEXT,
  email_enviado BOOLEAN DEFAULT false, email_enviado_em TIMESTAMPTZ, email_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entregas_epi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read entregas" ON public.entregas_epi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin almox insert entregas" ON public.entregas_epi FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'almoxarifado'));
CREATE POLICY "Admin almox update entregas" ON public.entregas_epi FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'almoxarifado'));

-- 11. Entrega itens
CREATE TABLE public.entrega_epi_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id UUID REFERENCES public.entregas_epi(id) NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) NOT NULL,
  quantidade INTEGER NOT NULL, nome_snapshot TEXT NOT NULL, ca_snapshot TEXT,
  validade_snapshot DATE, custo_unitario_snapshot NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entrega_epi_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read entrega itens" ON public.entrega_epi_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin almox insert entrega itens" ON public.entrega_epi_itens FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'almoxarifado'));

-- 12. Configuracoes
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE, valor TEXT NOT NULL, descricao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read config" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage config" ON public.configuracoes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('empresa_razao_social', 'Empresa Exemplo S.A.', 'Razão social'),
  ('empresa_cnpj', '12.345.678/0001-90', 'CNPJ'),
  ('empresa_endereco', 'Rua das Indústrias, 500 - São Paulo/SP', 'Endereço'),
  ('empresa_telefone', '(11) 3456-7890', 'Telefone'),
  ('dias_alerta_vencimento', '30', 'Dias para alerta de vencimento'),
  ('periodicidade_inspecao_epc', '60', 'Periodicidade inspeção EPC em dias'),
  ('criterio_epi_atualizado_meses', '6', 'Meses para EPI atualizado'),
  ('data_ultimo_acidente', '2025-10-18', 'Data último acidente'),
  ('termo_nr06_texto', 'Declaro que recebi os EPIs listados e me comprometo a utilizá-los conforme NR-06.', 'Texto termo NR-06');
