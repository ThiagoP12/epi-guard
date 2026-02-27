-- Update the trigger function to handle the expanded status flow
CREATE OR REPLACE FUNCTION public.notify_solicitacao_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NEW.status = 'EM_SEPARACAO' AND OLD.status = 'APROVADA' THEN
    INSERT INTO notificacoes (colaborador_id, titulo, mensagem, solicitacao_id)
    VALUES (
      NEW.colaborador_id,
      'EPI em separação',
      'Seu EPI está sendo separado pelo estoque. Solicitação #' || LEFT(NEW.id::text, 8) || '.',
      NEW.id
    );
  END IF;

  IF NEW.status = 'BAIXADA_NO_ESTOQUE' AND OLD.status = 'EM_SEPARACAO' THEN
    INSERT INTO notificacoes (colaborador_id, titulo, mensagem, solicitacao_id)
    VALUES (
      NEW.colaborador_id,
      'EPI separado / disponível',
      'Seu EPI foi baixado do estoque e está disponível para retirada. Solicitação #' || LEFT(NEW.id::text, 8) || '.',
      NEW.id
    );
  END IF;

  IF NEW.status = 'ENTREGUE' AND OLD.status = 'BAIXADA_NO_ESTOQUE' THEN
    INSERT INTO notificacoes (colaborador_id, titulo, mensagem, solicitacao_id)
    VALUES (
      NEW.colaborador_id,
      'EPI entregue',
      'Seu EPI da solicitação #' || LEFT(NEW.id::text, 8) || ' foi entregue. Confirme o recebimento no portal.',
      NEW.id
    );
  END IF;

  IF NEW.status = 'REPROVADA' AND OLD.status = 'ENVIADA' THEN
    INSERT INTO notificacoes (colaborador_id, titulo, mensagem, solicitacao_id)
    VALUES (
      NEW.colaborador_id,
      'Solicitação reprovada',
      'Sua solicitação #' || LEFT(NEW.id::text, 8) || ' foi reprovada. Verifique o motivo no portal.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Migrate existing SEPARADO records to BAIXADA_NO_ESTOQUE
UPDATE solicitacoes_epi SET status = 'BAIXADA_NO_ESTOQUE' WHERE status = 'SEPARADO';