-- =====================================================================
-- 022_anotacao_movimento.sql — rodar depois do 021
-- Anotação ao encaminhar uma avaliação (ex.: "guia de remessa nº 1234").
-- O sistema manda a anotação junto com o movimento; ela fica gravada no
-- caminho da avaliação, ao lado da data e de quem registrou.
-- =====================================================================

-- campo de passagem: só leva a anotação até o caminho, não fica guardado
alter table public.lancamentos add column if not exists movimento_obs text;

create or replace function public.tg_lancamento_anotacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if nullif(trim(coalesce(new.movimento_obs, '')), '') is not null and new.categoria = 'avaliacoes' then
    n := jsonb_array_length(new.avaliacao_trilha);
    -- só anota se este update registrou um movimento novo no caminho
    if n > 0 and (tg_op = 'INSERT' or n > jsonb_array_length(old.avaliacao_trilha)) then
      new.avaliacao_trilha := jsonb_set(new.avaliacao_trilha, array[(n - 1)::text, 'obs'],
        to_jsonb(left(trim(new.movimento_obs), 200)));
    end if;
  end if;
  new.movimento_obs := null;
  return new;
end $$;

-- o nome começa com "zzz" para rodar depois das outras regras (que montam o caminho)
drop trigger if exists lancamentos_zzz_anotacao on public.lancamentos;
create trigger lancamentos_zzz_anotacao before insert or update on public.lancamentos
  for each row execute function public.tg_lancamento_anotacao();
