
-- 1. Create notificacoes table
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  solicitacao_id uuid REFERENCES public.solicitacoes_epi(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Colaborador reads own notifications
CREATE POLICY "Colaborador read own notificacoes" ON public.notificacoes
  FOR SELECT USING (
    colaborador_id IN (SELECT id FROM public.colaboradores WHERE user_id = auth.uid())
  );

-- Colaborador updates own notifications (mark as read)
CREATE POLICY "Colaborador update own notificacoes" ON public.notificacoes
  FOR UPDATE USING (
    colaborador_id IN (SELECT id FROM public.colaboradores WHERE user_id = auth.uid())
  );

-- Admin/almoxarifado/tecnico can insert notifications
CREATE POLICY "Staff insert notificacoes" ON public.notificacoes
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'almoxarifado'::app_role) OR
    has_role(auth.uid(), 'tecnico'::app_role)
  );

-- Super admin full access
CREATE POLICY "Super admin manage notificacoes" ON public.notificacoes
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Add solicitacao_id to movimentacoes_estoque
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS solicitacao_id uuid REFERENCES public.solicitacoes_epi(id);

-- 3. Enable realtime for notificacoes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- 4. Trigger: auto-create notification on solicitacao status change
CREATE OR REPLACE FUNCTION public.notify_solicitacao_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'APROVADA' AND OLD.status = 'ENVIADA' THEN
    INSERT INTO notificacoes (colaborador_id, titulo, mensagem, solicitacao_id)
    VALUES (
      NEW.colaborador_id,
      'Solicitação aprovada',
      'Sua solicitação #' || LEFT(NEW.id::text, 8) || ' foi aprovada e será separada pelo estoque.',
      NEW.id
    );
  END IF;

  IF NEW.status = 'SEPARADO' AND OLD.status = 'APROVADA' THEN
    INSERT INTO notificacoes (colaborador_id, titulo, mensagem, solicitacao_id)
    VALUES (
      NEW.colaborador_id,
      'EPI separado / disponível',
      'Seu EPI foi baixado do estoque e está disponível para retirada. Solicitação #' || LEFT(NEW.id::text, 8) || '.',
      NEW.id
    );
  END IF;

  IF NEW.status = 'ENTREGUE' AND OLD.status = 'SEPARADO' THEN
    INSERT INTO notificacoes (colaborador_id, titulo, mensagem, solicitacao_id)
    VALUES (
      NEW.colaborador_id,
      'EPI entregue',
      'Seu EPI da solicitação #' || LEFT(NEW.id::text, 8) || ' foi entregue. Confirme o recebimento no portal.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_solicitacao_status
  AFTER UPDATE ON public.solicitacoes_epi
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_solicitacao_status_change();
