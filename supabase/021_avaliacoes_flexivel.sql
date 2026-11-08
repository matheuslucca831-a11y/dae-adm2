-- =====================================================================
-- 021_avaliacoes_flexivel.sql — rodar depois do 020
-- Avaliações sem caminho fixo: a DAE escolhe para onde cada uma vai.
--   • "Encaminhar": para a unidade, de volta para a DAE, para o RH
--   • a assinatura pode ser antes OU depois de passar pela unidade
--   • a unidade pode mandar direto ao RH (quando já está assinada)
--   • o mesmo papel pode voltar do RH para a 2ª, 3ª... avaliação
--   • cada movimento fica registrado na "trilha" (data, quem, o quê)
-- =====================================================================

-- ---------- Novas colunas ----------
alter table public.lancamentos
  add column if not exists avaliacao_rodada    int  not null default 1,      -- 1ª, 2ª avaliação...
  add column if not exists avaliacao_chegou_de text,                          -- 'RH' ou 'Unidade'
  add column if not exists avaliacao_anterior  uuid references public.lancamentos(id) on delete set null,
  add column if not exists avaliacao_trilha    jsonb not null default '[]'::jsonb;

alter table public.lancamentos drop constraint if exists avaliacao_rodada_ck;
alter table public.lancamentos add constraint avaliacao_rodada_ck check (avaliacao_rodada between 1 and 20);
alter table public.lancamentos drop constraint if exists avaliacao_chegou_de_ck;
alter table public.lancamentos add constraint avaliacao_chegou_de_ck check (avaliacao_chegou_de is null or avaliacao_chegou_de in ('RH','Unidade'));
create index if not exists lancamentos_aval_anterior_idx on public.lancamentos (avaliacao_anterior);

-- "Devolvida" deixa de ser uma etapa: é "Na DAE" com a data em que voltou da unidade
alter table public.lancamentos disable trigger user;
update public.lancamentos set avaliacao_etapa = 'Na DAE' where avaliacao_etapa = 'Devolvida';
update public.lancamentos set avaliacao_chegou_de = 'RH' where categoria = 'avaliacoes' and avaliacao_chegou_de is null;
-- trilha das avaliações que já existiam, montada com as datas que havia
update public.lancamentos l set avaliacao_trilha = (
  select coalesce(jsonb_agg(e order by e->>'em'), '[]'::jsonb) from (
    select jsonb_build_object('em', l.data_recebimento::text, 'evento', 'Recebida do RH') e
    union all select jsonb_build_object('em', l.avaliacao_unidade_em::text, 'evento', 'Enviada à unidade') where l.avaliacao_unidade_em is not null
    union all select jsonb_build_object('em', l.avaliacao_devolvida_em::text, 'evento', 'Voltou da unidade') where l.avaliacao_devolvida_em is not null
    union all select jsonb_build_object('em', coalesce(l.data_assinatura, l.diretora_em::date)::text,
                                        'evento', case when l.diretora = 'Dispensado' then 'Liberada sem assinatura' else 'Assinada' end)
      where l.diretora in ('Autorizado','Dispensado')
    union all select jsonb_build_object('em', l.enviado_rh_em::date::text, 'evento', 'Enviada ao RH') where l.enviado_rh_em is not null
  ) x)
 where l.categoria = 'avaliacoes' and l.avaliacao_trilha = '[]'::jsonb;
alter table public.lancamentos enable trigger user;

alter table public.lancamentos drop constraint if exists avaliacao_etapa_ck;
alter table public.lancamentos add constraint avaliacao_etapa_ck check (
  (categoria <> 'avaliacoes' and avaliacao_etapa is null)
  or (categoria = 'avaliacoes' and avaliacao_etapa in ('Na DAE', 'Na unidade'))
);

-- registra um movimento na trilha (data de hoje no fuso de SP, nome de quem fez)
create or replace function public.trilha_evento(p_evento text, p_obs text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'em', ((now() at time zone 'America/Sao_Paulo')::date)::text,
    'evento', p_evento,
    'por', (select nome from perfis where id = auth.uid()),
    'obs', nullif(trim(p_obs), '')));
$$;

-- ---------- Inserção ----------
create or replace function public.tg_lancamento_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record; v_ano int := ano_atual();
begin
  if not usuario_ativo() then raise exception 'Usuário sem acesso liberado'; end if;

  select nome, vinculo, situacao into f from funcionarios where id = new.funcionario_id;
  if not found then raise exception 'Funcionário não encontrado'; end if;
  if f.situacao = 'Inativo' then raise exception 'Funcionário inativo não recebe lançamentos'; end if;

  if not is_central() then
    new.unidade_id := minha_unidade();
    if not funcionario_na_minha_unidade(new.funcionario_id) then
      raise exception 'Funcionário sem lotação ativa nesta unidade';
    end if;
  end if;

  new.diretora := 'Aguardando';  new.diretora_obs := null;
  new.diretora_em := null;       new.diretora_por := null;
  new.diretor_id := null;        new.diretor_nome := null;  new.data_assinatura := null;
  new.situacao_rh := 'Aguardando autorização';

  if new.categoria = 'avaliacoes' then
    -- chega na DAE (vinda do RH ou da unidade); daí a DAE decide para onde vai
    new.avaliacao_etapa := 'Na DAE'; new.avaliacao_unidade_em := null; new.avaliacao_devolvida_em := null;
    new.avaliacao_chegou_de := coalesce(new.avaliacao_chegou_de, 'RH');
    new.avaliacao_rodada := coalesce(new.avaliacao_rodada, 1);
    new.avaliacao_trilha := jsonb_build_array(trilha_evento(
      case when new.avaliacao_rodada > 1 then new.avaliacao_rodada || 'ª avaliação: ' else '' end
      || 'Recebida ' || case new.avaliacao_chegou_de when 'Unidade' then 'da unidade' else 'do RH' end));
    -- a data da trilha é a do recebimento informado
    new.avaliacao_trilha := jsonb_set(new.avaliacao_trilha, '{0,em}', to_jsonb(coalesce(new.data_recebimento, current_date)::text));
  else
    new.avaliacao_etapa := null; new.avaliacao_unidade_em := null; new.avaliacao_devolvida_em := null;
    new.avaliacao_chegou_de := null; new.avaliacao_rodada := 1; new.avaliacao_anterior := null;
    new.avaliacao_trilha := '[]'::jsonb;
  end if;

  new.funcionario_nome := f.nome;
  new.vinculo          := f.vinculo;
  new.unidade_nome     := (select nome from unidades where id = new.unidade_id);
  new.destino_rh       := coalesce(new.destino_rh, (select destino from destinos_rh where vinculo = f.vinculo));
  new.protocolo_dae    := v_ano || '-' || lpad(proximo_numero('protocolo_dae', v_ano)::text, 4, '0');
  new.criado_por       := auth.uid();
  new.criado_em        := now();
  return new;
end $$;

-- ---------- Mudanças ----------
create or replace function public.tg_lancamento_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then
    new.atualizado_em := now();
    return new;
  end if;

  new.protocolo_dae := old.protocolo_dae;
  new.criado_por    := old.criado_por;
  new.criado_em     := old.criado_em;
  new.categoria     := old.categoria;

  if is_central() then
    if new.categoria = 'avaliacoes' then
      new.avaliacao_trilha    := old.avaliacao_trilha;        -- só o banco escreve a trilha
      new.avaliacao_rodada    := old.avaliacao_rodada;
      new.avaliacao_anterior  := old.avaliacao_anterior;
    end if;

    -- Avaliação: vai e volta da unidade quantas vezes precisar, antes ou depois da assinatura
    if new.categoria = 'avaliacoes' and new.avaliacao_etapa is distinct from old.avaliacao_etapa then
      if old.situacao_rh in ('Enviado ao RH','Concluído') then
        raise exception 'A avaliação já foi enviada ao RH; desfaça o envio antes de mudar onde ela está';
      end if;
      if new.avaliacao_etapa = 'Na unidade' then
        new.avaliacao_unidade_em := v_hoje;
        new.avaliacao_trilha := new.avaliacao_trilha || trilha_evento('Enviada à unidade');
      elsif new.avaliacao_etapa = 'Na DAE' then
        new.avaliacao_devolvida_em := v_hoje;
        new.avaliacao_trilha := new.avaliacao_trilha || trilha_evento('Voltou da unidade');
      else
        raise exception 'Local da avaliação inválido: %', new.avaliacao_etapa;
      end if;
    end if;

    if new.diretora is distinct from old.diretora then
      if new.categoria = 'avaliacoes' and new.diretora <> 'Aguardando' and new.avaliacao_etapa <> 'Na DAE' then
        raise exception 'A avaliação está com a unidade; registre que ela voltou para a DAE antes da assinatura';
      end if;

      if new.diretora = 'Aguardando' then
        new.diretora_em := null; new.diretora_por := null;
        new.diretor_id := null;  new.diretor_nome := null; new.data_assinatura := null;
      elsif new.diretora = 'Dispensado' then
        if new.categoria <> 'avaliacoes' or new.tipo <> 'Avaliação de desempenho (promoção)' then
          raise exception 'Só a avaliação de promoção segue sem assinatura da Diretoria';
        end if;
        new.diretora_em := now(); new.diretora_por := auth.uid();
        new.diretor_id := null; new.diretor_nome := null; new.data_assinatura := null; new.diretora_obs := null;
      else
        if new.diretor_id is null then raise exception 'Informe qual diretor(a) assinou'; end if;
        new.diretora_em := now(); new.diretora_por := auth.uid();
        new.data_assinatura := coalesce(new.data_assinatura, v_hoje);
      end if;
      new.situacao_rh := case new.diretora
        when 'Autorizado'     then 'Autorizado / Aguardando envio'
        when 'Dispensado'     then 'Autorizado / Aguardando envio'
        when 'Devolvido'      then 'Devolvido'
        when 'Não autorizado' then 'Não autorizado'
        else 'Aguardando autorização' end;
      new.enviado_rh_em := null; new.baixa_em := null; new.baixa_por := null;

      if new.categoria = 'avaliacoes' then
        new.avaliacao_trilha := new.avaliacao_trilha || trilha_evento(case new.diretora
          when 'Autorizado'     then 'Assinada'
          when 'Dispensado'     then 'Liberada sem assinatura'
          when 'Aguardando'     then 'Assinatura desfeita'
          else new.diretora end, new.diretora_obs);
      end if;

    elsif new.situacao_rh is distinct from old.situacao_rh then
      if old.situacao_rh = 'Autorizado / Aguardando envio' and new.situacao_rh = 'Enviado ao RH' then
        new.enviado_rh_em := now();
        if new.categoria = 'avaliacoes' then
          new.avaliacao_trilha := new.avaliacao_trilha || trilha_evento(
            case when new.avaliacao_etapa = 'Na unidade' then 'Enviada ao RH pela unidade' else 'Enviada ao RH' end);
        end if;
      elsif old.situacao_rh = 'Enviado ao RH' and new.situacao_rh = 'Autorizado / Aguardando envio' then
        new.enviado_rh_em := null;                         -- desfazer envio
        if new.categoria = 'avaliacoes' then
          new.avaliacao_trilha := new.avaliacao_trilha || trilha_evento('Envio ao RH desfeito');
        end if;
      elsif old.situacao_rh = 'Enviado ao RH' and new.situacao_rh = 'Concluído' then
        new.baixa_em := now(); new.baixa_por := auth.uid();
      elsif old.situacao_rh = 'Concluído' and new.situacao_rh = 'Enviado ao RH' then
        new.baixa_em := null; new.baixa_por := null;
      else
        raise exception 'Mudança de etapa inválida: % para %', old.situacao_rh, new.situacao_rh;
      end if;
    end if;

    if new.diretor_id is not null and (new.diretor_id is distinct from old.diretor_id or new.diretor_nome is null) then
      select nome into new.diretor_nome from diretores where id = new.diretor_id;
      if not found then raise exception 'Diretor(a) não encontrado(a)'; end if;
    end if;

    if new.funcionario_id is distinct from old.funcionario_id then
      select nome, vinculo into new.funcionario_nome, new.vinculo from funcionarios where id = new.funcionario_id;
    end if;
    if new.unidade_id is distinct from old.unidade_id then
      new.unidade_nome := (select nome from unidades where id = new.unidade_id);
    end if;
  else
    if old.diretora not in ('Aguardando','Devolvido') then
      raise exception 'Lançamento já analisado; não pode ser alterado pela unidade';
    end if;
    new.funcionario_id   := old.funcionario_id;   new.funcionario_nome := old.funcionario_nome;
    new.unidade_id       := old.unidade_id;       new.unidade_nome     := old.unidade_nome;
    new.vinculo          := old.vinculo;          new.destino_rh       := old.destino_rh;
    new.diretora         := 'Aguardando';         new.diretora_obs     := old.diretora_obs;
    new.diretora_em      := old.diretora_em;      new.diretora_por     := old.diretora_por;
    new.diretor_id       := old.diretor_id;       new.diretor_nome     := old.diretor_nome;
    new.data_assinatura  := old.data_assinatura;
    new.situacao_rh      := 'Aguardando autorização';
    new.enviado_rh_em    := old.enviado_rh_em;    new.baixa_em := old.baixa_em; new.baixa_por := old.baixa_por;
    new.avaliacao_etapa  := old.avaliacao_etapa;
    new.avaliacao_unidade_em := old.avaliacao_unidade_em; new.avaliacao_devolvida_em := old.avaliacao_devolvida_em;
    new.avaliacao_rodada := old.avaliacao_rodada; new.avaliacao_chegou_de := old.avaliacao_chegou_de;
    new.avaliacao_anterior := old.avaliacao_anterior; new.avaliacao_trilha := old.avaliacao_trilha;
  end if;

  if new.situacao_rh in ('Enviado ao RH','Concluído','Autorizado / Aguardando envio')
     and new.diretora not in ('Autorizado','Dispensado') then
    raise exception 'Só pedidos assinados podem seguir para o RH';
  end if;
  if new.situacao_rh = 'Enviado ao RH' and new.destino_rh is null then
    raise exception 'Escolha para qual RH o pedido vai';
  end if;

  new.atualizado_em := now();
  return new;
end $$;

-- ---------- O mesmo papel voltou do RH: próxima avaliação ----------
create or replace function public.proxima_avaliacao(p_lancamento uuid, p_data date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a record; v_id uuid;
begin
  if not is_central() then raise exception 'Apenas o ADM-Central registra avaliações'; end if;
  select * into a from lancamentos where id = p_lancamento for update;
  if not found or a.categoria <> 'avaliacoes' then raise exception 'Avaliação não encontrada'; end if;
  if a.situacao_rh not in ('Enviado ao RH','Concluído') then
    raise exception 'A % avaliação ainda não foi enviada ao RH', a.avaliacao_rodada || 'ª';
  end if;
  if exists (select 1 from lancamentos where avaliacao_anterior = a.id) then
    raise exception 'A próxima avaliação deste papel já foi registrada';
  end if;
  insert into lancamentos (categoria, tipo, funcionario_id, unidade_id, data_recebimento, referencia, obs,
                           avaliacao_rodada, avaliacao_chegou_de, avaliacao_anterior)
  values ('avaliacoes', a.tipo, a.funcionario_id, a.unidade_id, coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date),
          a.referencia, a.obs, a.avaliacao_rodada + 1, 'RH', a.id)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.proxima_avaliacao(uuid, date) from public, anon;
grant  execute on function public.proxima_avaliacao(uuid, date) to authenticated;
revoke execute on function public.trilha_evento(text, text) from public, anon;
grant  execute on function public.trilha_evento(text, text) to authenticated;
