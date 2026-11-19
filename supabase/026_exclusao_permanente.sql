-- =====================================================================
-- 026_exclusao_permanente.sql — rodar depois do 025
-- Exclusão permanente (com registro no histórico):
--  * cargo da lista: só se nenhum funcionário usa;
--  * funcionário inativo (ex.: cadastro duplicado): os pedidos, avaliações,
--    comunicações 1Doc e itens de relação dele passam antes para o cadastro
--    certo; lotações, horários e sugestões de horário vão junto.
-- =====================================================================

-- ---------- cargos ----------
create or replace function public.tg_cargo_excluir() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from funcionarios where cargo = old.nome;
  if n > 0 then
    raise exception '% funcionário(s) estão com o cargo "%". Troque o cargo deles antes de excluir.', n, old.nome;
  end if;
  insert into historico (tabela, registro_id, funcionario_id, acao, dados_antes, dados_depois, usuario_id, usuario_nome)
  values ('cargos', null, null, 'DELETE', to_jsonb(old), null, auth.uid(), (select nome from perfis where id = auth.uid()));
  return old;
end $$;

drop trigger if exists cargos_excluir on public.cargos;
create trigger cargos_excluir before delete on public.cargos
  for each row execute function public.tg_cargo_excluir();
revoke execute on function public.tg_cargo_excluir() from public, anon, authenticated;

-- ---------- funcionários ----------
create or replace function public.excluir_funcionario(p_funcionario uuid, p_destino uuid default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  f record; d record; v_para text;
  n_ped int; n_com int; n_rel int; n_sug int;
begin
  if not is_central() then raise exception 'Apenas o ADM-Central exclui funcionários'; end if;

  select id, nome, situacao into f from funcionarios where id = p_funcionario;
  if not found then raise exception 'Funcionário não encontrado'; end if;
  if f.situacao <> 'Inativo' then
    raise exception 'Inative o cadastro de % antes de excluir permanentemente', f.nome;
  end if;

  select count(*) into n_ped from lancamentos where funcionario_id = f.id;
  select count(*) into n_com from comunicados_1doc where funcionario_id = f.id;
  select count(*) into n_rel from relacao_itens where funcionario_id = f.id;
  select count(*) into n_sug from sugestoes_cadastro where funcionario_id = f.id;

  if n_ped + n_com + n_rel + n_sug > 0 then
    if p_destino is null then
      raise exception '% tem % pedido(s)/avaliação(ões). Escolha para qual cadastro eles vão antes de excluir.', f.nome, n_ped;
    end if;
    if p_destino = f.id then raise exception 'Escolha outro funcionário para receber os pedidos'; end if;
    select id, nome into d from funcionarios where id = p_destino;
    if not found then raise exception 'Funcionário de destino não encontrado'; end if;
    v_para := d.nome;

    -- cada pedido muda de dono pelas regras normais (nome, vínculo e RH do novo cadastro; fica no histórico)
    update lancamentos set funcionario_id = d.id where funcionario_id = f.id;
    update comunicados_1doc set funcionario_id = d.id where funcionario_id = f.id;
    -- na relação mensal: se o cadastro certo já está na mesma relação, o item duplicado sai
    delete from relacao_itens r where r.funcionario_id = f.id
       and exists (select 1 from relacao_itens x where x.relacao_id = r.relacao_id and x.funcionario_id = d.id);
    update relacao_itens set funcionario_id = d.id where funcionario_id = f.id;
    update sugestoes_cadastro set funcionario_id = d.id where funcionario_id = f.id;
  end if;

  -- lotações, horários, sugestões de horário e log de acessos saem junto (cascade);
  -- o cadastro apagado fica guardado no histórico (dados_antes)
  delete from funcionarios where id = f.id;

  return jsonb_build_object('excluido', f.nome, 'pedidos_movidos', n_ped, 'para', v_para);
end $$;

revoke execute on function public.excluir_funcionario(uuid, uuid) from public, anon;
grant execute on function public.excluir_funcionario(uuid, uuid) to authenticated;
