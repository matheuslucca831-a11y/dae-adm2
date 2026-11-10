-- =====================================================================
-- 023_segundo_vinculo.sql — rodar depois do 022
-- Funcionário com dois vínculos ativos (ex.: médico Estatutário e FSPSS,
-- ou duas matrículas na Prefeitura) num cadastro só.
-- Cada pedido diz de qual vínculo é: o RH de destino, as regras de ponto
-- e o Aviso seguem o vínculo escolhido.
-- =====================================================================

-- 2º vínculo no cadastro
alter table public.funcionarios
  add column if not exists vinculo_2 text references public.vinculos(nome) on update cascade,
  add column if not exists forma_contratacao_2 text,
  add column if not exists matricula_2 text;

-- de qual vínculo é o pedido (e a matrícula daquele vínculo, para o Aviso)
alter table public.lancamentos
  add column if not exists segundo_vinculo boolean not null default false,
  add column if not exists matricula text;

-- Roda depois das regras de inclusão/edição (nome "lancamentos_v..." vem depois de
-- "lancamentos_update") e antes das regras de ponto ("lancamentos_zz_..."),
-- que assim já conferem o vínculo certo.
create or replace function public.tg_lancamento_vinculo() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if tg_op = 'UPDATE' then
    -- já enviado ao RH: o vínculo do pedido não muda mais
    if old.situacao_rh = 'Enviado ao RH' then
      new.segundo_vinculo := old.segundo_vinculo; new.matricula := coalesce(old.matricula, new.matricula);
      return new;
    end if;
    if new.segundo_vinculo is not distinct from old.segundo_vinculo
       and new.funcionario_id is not distinct from old.funcionario_id then
      return new;
    end if;
  end if;

  select vinculo, matricula, vinculo_2, matricula_2 into f from funcionarios where id = new.funcionario_id;
  if new.segundo_vinculo and f.vinculo_2 is null then new.segundo_vinculo := false; end if;

  if new.segundo_vinculo then
    new.vinculo    := f.vinculo_2;
    new.matricula  := f.matricula_2;
    new.destino_rh := coalesce((select destino from destinos_rh where vinculo = f.vinculo_2), new.destino_rh);
  else
    new.vinculo    := f.vinculo;
    new.matricula  := f.matricula;
    if tg_op = 'UPDATE' then
      new.destino_rh := coalesce((select destino from destinos_rh where vinculo = f.vinculo), new.destino_rh);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists lancamentos_vinculo on public.lancamentos;
create trigger lancamentos_vinculo before insert or update on public.lancamentos
  for each row execute function public.tg_lancamento_vinculo();

-- quem tem dois vínculos de Estatutário entrega dois cartões de ponto no mês
drop index if exists public.cartao_ponto_mes_unico;
create unique index cartao_ponto_mes_unico on public.lancamentos (funcionario_id, referencia, segundo_vinculo)
  where tipo = 'Cartão/Espelho de Ponto + Justificativa' and diretora <> 'Não autorizado';

-- cadastro novo pela Sede já grava o 2º vínculo
create or replace function public.criar_funcionario(p_funcionario jsonb, p_lotacoes jsonb default '[]'::jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; l jsonb; h jsonb; v_lot uuid;
begin
  if not is_central() then raise exception 'Apenas o ADM-Central cadastra funcionários'; end if;

  begin
    insert into funcionarios (nome, matricula, cpf, cns, rg, sexo, data_nascimento, cargo, cbo, conselho,
                              numero_conselho, conselho_uf, vinculo, forma_contratacao, carga_horaria_semanal,
                              obs, exige_1doc, destino_1doc, vinculo_2, forma_contratacao_2, matricula_2)
    select trim(x.nome), x.matricula, nullif(regexp_replace(coalesce(x.cpf, ''), '\D', '', 'g'), ''),
           nullif(regexp_replace(coalesce(x.cns, ''), '\D', '', 'g'), ''), x.rg, x.sexo, x.data_nascimento,
           x.cargo, x.cbo, x.conselho, x.numero_conselho, x.conselho_uf, x.vinculo, x.forma_contratacao,
           x.carga_horaria_semanal, x.obs, coalesce(x.exige_1doc, false), x.destino_1doc,
           x.vinculo_2, x.forma_contratacao_2, x.matricula_2
      from jsonb_populate_record(null::funcionarios, p_funcionario) x
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um funcionário cadastrado com este CPF';
  end;

  for l in select * from jsonb_array_elements(coalesce(p_lotacoes, '[]'::jsonb)) loop
    insert into lotacoes (funcionario_id, unidade_id, carga_horaria, data_inicio, obs)
    values (v_id, (l->>'unidade_id')::uuid, nullif(l->>'carga_horaria', '')::int,
            coalesce(nullif(l->>'data_inicio', '')::date, current_date), nullif(l->>'obs', ''))
    returning id into v_lot;

    for h in select * from jsonb_array_elements(coalesce(l->'horarios', '[]'::jsonb)) loop
      insert into horarios (lotacao_id, dia_semana, frequencia, entrada, saida, data_referencia, obs)
      values (v_lot, nullif(h->>'dia_semana', ''), coalesce(nullif(h->>'frequencia', ''), 'Semanal'),
              nullif(h->>'entrada', '')::time, nullif(h->>'saida', '')::time,
              nullif(h->>'data_referencia', '')::date, nullif(h->>'obs', ''));
    end loop;
  end loop;

  return v_id;
end $$;
