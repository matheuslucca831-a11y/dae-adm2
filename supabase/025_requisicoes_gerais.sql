-- =====================================================================
-- 025_requisicoes_gerais.sql — rodar depois do 024
-- Nova categoria "Requisições gerais": alteração de horário, cancelamento
-- de folga/férias e outros pedidos ao RH fora dos documentos padrão.
-- Segue o mesmo caminho dos pedidos: assinatura da Diretoria, Envios RH
-- e Aviso (seção "Requisições gerais").
-- =====================================================================
alter table public.lancamentos drop constraint if exists lancamentos_categoria_check;
alter table public.lancamentos add constraint lancamentos_categoria_check
  check (categoria in ('ferias_lp', 'folgas_abonos', 'he_bh', 'ponto_ausencias', 'avaliacoes', 'requisicoes'));

alter table public.lancamentos drop constraint if exists tipo_por_categoria_ck;
alter table public.lancamentos add constraint tipo_por_categoria_ck check (
     (categoria = 'ferias_lp' and tipo in ('Férias', 'Licença-Prêmio'))
  or (categoria = 'folgas_abonos' and tipo in ('Folga', 'Banco de Horas', 'Folga abonada', 'Abono', 'Abono natalício',
                                              'Serviço eleitoral', 'Trabalho eventual', 'Campanha de vacinação', 'Outro'))
  or (categoria = 'he_bh' and tipo in ('Hora Extra', 'Banco de Horas', 'Compensação de Horas', 'Outro'))
  or (categoria = 'ponto_ausencias' and tipo in ('Ocorrência de ponto', 'Atestado', 'Declaração',
                                                'Cartão/Espelho de Ponto + Justificativa', 'Outro'))
  or (categoria = 'avaliacoes' and tipo in ('Avaliação de desempenho', 'Avaliação de desempenho (promoção)'))
  or (categoria = 'requisicoes' and tipo in ('Alteração de horário', 'Cancelamento de folga', 'Cancelamento de férias', 'Outra requisição'))
);

-- requisição precisa dizer o que é
alter table public.lancamentos drop constraint if exists requisicao_descrita_ck;
alter table public.lancamentos add constraint requisicao_descrita_ck
  check (categoria <> 'requisicoes' or nullif(trim(obs), '') is not null);

-- como as demais, só a DAE lança (a unidade acompanha)
create or replace function public.categoria_so_dae(p_categoria text) returns boolean
language sql immutable set search_path = public as
$$ select p_categoria in ('folgas_abonos', 'ferias_lp', 'he_bh', 'ponto_ausencias', 'avaliacoes', 'requisicoes') $$;
