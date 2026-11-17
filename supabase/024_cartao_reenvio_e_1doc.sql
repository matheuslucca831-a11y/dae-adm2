-- =====================================================================
-- 024_cartao_reenvio_e_1doc.sql — rodar depois do 023
-- 1) Cartão/espelho de ponto pode ser lançado de novo no mesmo mês
--    (o RH devolveu ao funcionário e ele mandou outro).
-- 2) Pedido que a unidade já mandou ao RH pelo 1Doc: a DAE só registra
--    (para relatório e busca). Entra como "Enviado ao RH" e não vai
--    para a assinatura nem para o Aviso.
-- =====================================================================

-- 1) cartão: sem trava de um por mês (a tela avisa quando já existe)
drop index if exists public.cartao_ponto_mes_unico;
create index if not exists lancamentos_cartao_mes on public.lancamentos (funcionario_id, referencia)
  where tipo = 'Cartão/Espelho de Ponto + Justificativa';

-- 2) enviado pela unidade, pelo 1Doc
alter table public.lancamentos
  add column if not exists enviado_1doc boolean not null default false,
  add column if not exists numero_1doc text;

-- Roda depois das regras de inclusão/edição e do vínculo ("lancamentos_w..." vem depois
-- de "lancamentos_update" e "lancamentos_vinculo") e antes das regras de ponto ("lancamentos_zz...").
create or replace function public.tg_lancamento_envio_1doc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;            -- manutenção pelo SQL Editor

  -- só a Sede registra envio pelo 1Doc
  if not is_central() then
    if tg_op = 'INSERT' then
      new.enviado_1doc := false; new.numero_1doc := null;
    else
      new.enviado_1doc := old.enviado_1doc; new.numero_1doc := old.numero_1doc;
    end if;
    return new;
  end if;

  new.numero_1doc := nullif(trim(new.numero_1doc), '');
  if tg_op = 'UPDATE' and new.enviado_1doc = old.enviado_1doc then return new; end if;
  if tg_op = 'INSERT' and not new.enviado_1doc then return new; end if;

  if new.enviado_1doc then
    if new.categoria = 'avaliacoes' then
      raise exception 'Avaliação segue o caminho próprio (DAE, unidade, RH); não use o registro de 1Doc';
    end if;
    if tg_op = 'UPDATE' then
      if exists (select 1 from aviso_rh_itens where lancamento_id = new.id) then
        raise exception 'Este pedido já está num Aviso RH; tire do Aviso antes de marcar que foi pelo 1Doc';
      end if;
      if old.situacao_rh in ('Enviado ao RH', 'Concluído') then
        raise exception 'Este pedido já consta como enviado ao RH';
      end if;
    end if;
    new.diretora := 'Dispensado';
    new.diretora_obs := 'Enviado ao RH pela unidade, pelo 1Doc';
    new.diretor_id := null; new.diretor_nome := null; new.data_assinatura := null;
    new.diretora_em := now(); new.diretora_por := auth.uid();
    new.situacao_rh := 'Enviado ao RH';
    new.enviado_rh_em := coalesce((new.data_recebimento + time '12:00') at time zone 'America/Sao_Paulo', now());
  else
    -- desmarcou: volta a ser um pedido comum, aguardando a Diretoria
    if old.situacao_rh = 'Concluído' then raise exception 'Pedido já concluído pelo RH'; end if;
    new.diretora := 'Aguardando'; new.diretora_obs := null;
    new.diretora_em := null; new.diretora_por := null;
    new.situacao_rh := 'Aguardando autorização'; new.enviado_rh_em := null;
    new.numero_1doc := null;
  end if;
  return new;
end $$;

drop trigger if exists lancamentos_w_envio_1doc on public.lancamentos;
create trigger lancamentos_w_envio_1doc before insert or update on public.lancamentos
  for each row execute function public.tg_lancamento_envio_1doc();

-- funções de gatilho não precisam ser chamadas pela API (o gatilho roda sem essa permissão)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.fn);
  end loop;
end $$;
