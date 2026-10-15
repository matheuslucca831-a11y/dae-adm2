'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { deslocarCompetencia, fimDoMes, hojeISO, mensagemErro, normalizar, somarDias } from '@/lib/formato';
import {
  CAMPOS_LANCAMENTO, CATEGORIAS, MOTIVOS_OCORRENCIA, TIPO_CARTAO, TIPO_OCORRENCIA, VINCULO_EXIGIDO, modoPonto,
  type Categoria, type Lancamento,
} from '@/lib/lancamentos';
import type { Perfil } from '@/lib/types';
import { Aviso, Botao, Campo, inputCls } from '@/components/ui';

type Opcao = {
  id: string; nome: string; matricula: string | null; cargo: string | null; vinculo: string | null;
  lotacoes: { situacao: string; unidade_id: string }[];
};
type Unidade = { id: string; nome: string };

export default function FormLancamento({
  categoria, opcoesCategoria = [], perfil, lancamento, onFechar, onSalvo,
}: {
  categoria: Categoria; opcoesCategoria?: Categoria[]; perfil: Perfil; lancamento: Lancamento | null;
  onFechar: () => void; onSalvo: (l: Lancamento) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cat, setCat] = useState<Categoria>(lancamento?.categoria ?? categoria);
  const cfg = CATEGORIAS[cat];
  const central = perfil.perfil === 'central';
  const tem = (c: string) => cfg.campos.includes(c as never);
  const l = lancamento;

  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  // Funcionário escolhido (no editar, vem do próprio pedido)
  const [escolhido, setEscolhido] = useState<Opcao | null>(
    lancamento ? { id: lancamento.funcionario_id, nome: lancamento.funcionario_nome, matricula: null, cargo: null, vinculo: lancamento.vinculo, lotacoes: [] } : null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [busca, setBusca] = useState(l?.funcionario_nome ?? '');
  const [listaAberta, setListaAberta] = useState(false);
  const [f, setF] = useState({
    funcionario_id: l?.funcionario_id ?? '',
    unidade_id: l?.unidade_id ?? '',
    tipo: l?.tipo ?? cfg.tipos[0],
    data_recebimento: l?.data_recebimento ?? hojeISO(),
    data_inicio: l?.data_inicio ?? '',
    qtd_dias: l?.qtd_dias ? String(l.qtd_dias) : '',
    data_retorno: l?.data_retorno ?? '',
    venda_terco: l?.venda_terco ?? false,
    referencia: l?.referencia ?? '',
    quantidade: l?.quantidade ?? '',
    obs: l?.obs ?? '',
    // Ocorrência de ponto
    motivo_ocorrencia: l?.motivo_ocorrencia ?? '',
    testemunha: l?.testemunha ?? '',
    horario_entrada: l?.horario_entrada?.slice(0, 5) ?? '',
    horario_saida_almoco: l?.horario_saida_almoco?.slice(0, 5) ?? '',
    horario_retorno_almoco: l?.horario_retorno_almoco?.slice(0, 5) ?? '',
    horario_saida: l?.horario_saida?.slice(0, 5) ?? '',
    // Cartão de ponto: 'AAAA-MM' (vem de 'MM/AAAA')
    mes_ref: l?.referencia && /^\d{2}\/\d{4}$/.test(l.referencia) ? `${l.referencia.slice(3)}-${l.referencia.slice(0, 2)}` : hojeISO().slice(0, 7),
  });
  const [esquecimentos, setEsquecimentos] = useState<{ chave: string; n: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  useEffect(() => {
    if (!central) return;
    supabase.from('unidades').select('id, nome').eq('ativa', true).order('nome')
      .then(({ data }) => setUnidades((data as Unidade[]) ?? []));
  }, [supabase, central]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  // Retorno = saída + quantidade de dias (pode ser ajustado à mão)
  function atualizarPeriodo(inicio: string, dias: string) {
    setF((x) => ({
      ...x, data_inicio: inicio, qtd_dias: dias,
      data_retorno: inicio && Number(dias) > 0 ? somarDias(inicio, Number(dias)) : x.data_retorno,
    }));
  }

  function escolher(o: Opcao) {
    const ativas = o.lotacoes.filter((x) => x.situacao === 'Ativa');
    setF((x) => ({ ...x, funcionario_id: o.id, unidade_id: ativas.length === 1 ? ativas[0].unidade_id : x.unidade_id }));
    setBusca(o.nome);
    setEscolhido(o);
    setListaAberta(false);
  }

  const modo = modoPonto(cat, f.tipo);
  const vinculoExigido = cat === 'ponto_ausencias' ? VINCULO_EXIGIDO[f.tipo] : undefined;
  const vinculoErrado = !!(vinculoExigido && escolhido && escolhido.vinculo !== vinculoExigido);

  // Busca no banco enquanto digita (funciona com qualquer quantidade de funcionários).
  // O banco já limita ao que este usuário pode ver.
  useEffect(() => {
    const t = normalizar(busca.trim()).replace(/[,()%]/g, ' ').trim();
    if (l || t.length < 2) {
      setOpcoes([]);
      return;
    }
    let vivo = true;
    const timer = setTimeout(async () => {
      // "_" casa qualquer letra: assim "jose" encontra "José"
      const padrao = `%${t.replace(/[aeiouc]/g, '_')}%`;
      let q = supabase.from('funcionarios').select('id, nome, matricula, cargo, vinculo, lotacoes(situacao, unidade_id)')
        .eq('situacao', 'Ativo').or(`nome.ilike.${padrao},matricula.ilike.${padrao}`).order('nome').limit(40);
      if (vinculoExigido) q = q.eq('vinculo', vinculoExigido);
      const { data } = await q;
      if (!vivo) return;
      setOpcoes(((data as Opcao[]) ?? []).filter((o) => normalizar(`${o.nome} ${o.matricula ?? ''}`).includes(t)).slice(0, 8));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [supabase, busca, vinculoExigido, l]);
  const filtradas = opcoes;

  // Quantos esquecimentos o funcionário já tem no mês da ocorrência (limite: 5)
  const chaveEsq = modo === 'ocorrencia' && f.motivo_ocorrencia === 'Esquecimento' && f.funcionario_id && f.data_inicio
    ? `${f.funcionario_id}|${f.data_inicio.slice(0, 7)}` : '';
  useEffect(() => {
    if (!chaveEsq) return;
    let vivo = true;
    const [func, mes] = chaveEsq.split('|');
    let q = supabase.from('lancamentos').select('id', { count: 'exact', head: true })
      .eq('funcionario_id', func).eq('tipo', TIPO_OCORRENCIA).eq('motivo_ocorrencia', 'Esquecimento')
      .gte('data_inicio', `${mes}-01`).lte('data_inicio', fimDoMes(`${mes}-01`)).neq('diretora', 'Não autorizado');
    if (l) q = q.neq('id', l.id);
    q.then(({ count }) => vivo && setEsquecimentos({ chave: chaveEsq, n: count ?? 0 }));
    return () => {
      vivo = false;
    };
  }, [supabase, chaveEsq, l]);
  const nEsq = esquecimentos?.chave === chaveEsq ? esquecimentos.n : null;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!f.funcionario_id) return setErro('Escolha o funcionário na lista.');
    if (vinculoErrado) return setErro(`Este tipo é só para funcionários com vínculo ${vinculoExigido}.`);
    if (modo === 'ocorrencia') {
      if (!f.motivo_ocorrencia) return setErro('Escolha a justificativa da ocorrência.');
      if (!f.data_inicio) return setErro('Informe a data da ocorrência.');
      if (f.motivo_ocorrencia === 'Anomalia no funcionamento do REP' && !f.testemunha.trim()) return setErro('Anomalia no REP exige o nome da testemunha.');
      if (f.motivo_ocorrencia === 'Outros' && !f.obs.trim()) return setErro('Descreva a ocorrência.');
    }
    if (modo === 'cartao' && !f.mes_ref) return setErro('Informe o mês de referência do cartão.');
    if (tem('periodo') && !cfg.periodoOpcional && (!f.data_inicio || !(Number(f.qtd_dias) > 0))) return setErro('Informe a data de saída e a quantidade de dias.');
    if (f.data_retorno && f.data_inicio && f.data_retorno < f.data_inicio) return setErro('O retorno não pode ser antes da saída.');
    setErro(null);
    setSalvando(true);

    const v = (s: string) => s.trim() || null;
    const dados = {
      categoria: cat, tipo: f.tipo, funcionario_id: f.funcionario_id, data_recebimento: f.data_recebimento || hojeISO(),
      data_inicio: tem('periodo') ? f.data_inicio || null : null,
      qtd_dias: tem('periodo') ? Number(f.qtd_dias) || (f.data_inicio ? 1 : null) : null,
      data_retorno: tem('periodo') ? f.data_retorno || null : null,
      venda_terco: tem('venda_terco') ? f.venda_terco : false,
      referencia: tem('referencia') ? v(f.referencia) : null,
      quantidade: tem('quantidade') ? v(f.quantidade) : null,
      obs: v(f.obs),
      motivo_ocorrencia: modo === 'ocorrencia' ? f.motivo_ocorrencia : null,
      testemunha: modo === 'ocorrencia' ? v(f.testemunha) : null,
      horario_entrada: modo === 'ocorrencia' ? f.horario_entrada || null : null,
      horario_saida_almoco: modo === 'ocorrencia' ? f.horario_saida_almoco || null : null,
      horario_retorno_almoco: modo === 'ocorrencia' ? f.horario_retorno_almoco || null : null,
      horario_saida: modo === 'ocorrencia' ? f.horario_saida || null : null,
      ...(modo === 'ocorrencia' ? { data_retorno: null, referencia: null } : {}),
      ...(modo === 'cartao' ? { referencia: `${f.mes_ref.slice(5, 7)}/${f.mes_ref.slice(0, 4)}`, data_inicio: null, qtd_dias: null, data_retorno: null } : {}),
      ...(central ? { unidade_id: f.unidade_id || null } : {}),
      // Pedido devolvido e corrigido volta para a Diretoria
      ...(central && l?.diretora === 'Devolvido' ? { diretora: 'Aguardando' } : {}),
    };

    const q = l
      ? supabase.from('lancamentos').update(dados).eq('id', l.id)
      : supabase.from('lancamentos').insert(dados);
    const { data, error } = await q.select(CAMPOS_LANCAMENTO).single();
    setSalvando(false);
    if (error) {
      return setErro(error.code === '23505' && modo === 'cartao'
        ? 'Já existe cartão de ponto deste funcionário para este mês.' : mensagemErro(error));
    }
    onSalvo(data as unknown as Lancamento);
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-tinta/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form role="dialog" aria-modal="true" aria-labelledby="titulo-lanc" onSubmit={salvar}
        className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-linha px-5 py-4">
          <div>
            <h2 id="titulo-lanc" className="text-lg font-bold">{l ? `Lançamento ${l.protocolo_dae}` : `Novo lançamento: ${cfg.titulo}`}</h2>
            {l?.diretora === 'Devolvido' && <p className="text-sm text-erro">Devolvido: {l.diretora_obs}. Ao salvar, volta para a assinatura da Diretoria.</p>}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1.5 text-tinta-suave hover:bg-papel">
            <X className="size-5" />
          </button>
        </header>

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          {!l && opcoesCategoria.length > 1 && (
            <Campo rotulo="Pedido de *" className="sm:col-span-2">
              <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-md border border-linha bg-papel p-1">
                {opcoesCategoria.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={cat === c}
                    onClick={() => { setCat(c); setF((x) => ({ ...x, tipo: CATEGORIAS[c].tipos[0] })); }}
                    className={`rounded px-2 py-1.5 text-sm font-semibold ${cat === c ? 'bg-acento text-white' : 'text-tinta-suave hover:text-tinta'}`}>
                    {CATEGORIAS[c].titulo}
                  </button>
                ))}
              </div>
            </Campo>
          )}
          <div className="relative sm:col-span-2">
            <Campo rotulo="Funcionário *">
              <input
                value={busca}
                disabled={!!l}
                autoFocus={!l}
                onChange={(e) => { setBusca(e.target.value); set('funcionario_id', ''); setEscolhido(null); setListaAberta(true); }}
                onFocus={() => setListaAberta(true)}
                onBlur={() => setTimeout(() => setListaAberta(false), 150)}
                placeholder="Digite o nome ou a matrícula"
                autoComplete="off"
                className={inputCls}
              />
            </Campo>
            {listaAberta && !l && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-linha bg-white shadow-lg">
                {filtradas.length === 0 && (
                  <li className="px-3 py-2 text-sm text-tinta-suave">
                    {busca.trim().length < 2 ? 'Digite ao menos 2 letras do nome ou a matrícula.' : central ? 'Ninguém encontrado no cadastro.' : 'Ninguém encontrado. O funcionário precisa estar lotado na unidade ou na relação do mês.'}
                  </li>
                )}
                {filtradas.map((o) => (
                  <li key={o.id}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o)}
                      className="w-full px-3 py-2 text-left hover:bg-acento-claro">
                      <span className="block text-sm font-medium">{o.nome}</span>
                      <span className="block text-xs text-tinta-suave">{[o.matricula && `Matrícula ${o.matricula}`, o.cargo].filter(Boolean).join(', ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {vinculoExigido && (
              <p className={`mt-1 text-xs ${vinculoErrado ? 'font-semibold text-erro' : 'text-tinta-suave'}`}>
                {vinculoErrado ? `${escolhido?.nome} é ${escolhido?.vinculo ?? 'sem vínculo'}. ` : ''}
                {f.tipo === TIPO_CARTAO ? 'Cartão de ponto mensal: só Estatutários.' : 'Ocorrência de ponto: só funcionários FSPSS.'}
              </p>
            )}
          </div>

          {central && (
            <Campo rotulo="Unidade" className="sm:col-span-2">
              <select value={f.unidade_id} onChange={(e) => set('unidade_id', e.target.value)} className={inputCls}>
                <option value="">Sem unidade</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </Campo>
          )}

          <Campo rotulo="Tipo *">
            <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)} className={inputCls}>
              {cfg.tipos.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Recebido em">
            <input type="date" value={f.data_recebimento} onChange={(e) => set('data_recebimento', e.target.value)} className={inputCls} />
          </Campo>

          {modo === 'ocorrencia' && (
            <>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-xs font-semibold text-tinta-suave">Justificativa *</legend>
                <div className="space-y-1 rounded-md border border-linha p-2">
                  {MOTIVOS_OCORRENCIA.map((m, i) => (
                    <label key={m.valor} className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm ${f.motivo_ocorrencia === m.valor ? 'bg-acento-claro' : 'hover:bg-papel'}`}>
                      <input type="radio" name="motivo" checked={f.motivo_ocorrencia === m.valor} onChange={() => set('motivo_ocorrencia', m.valor)}
                        className="mt-0.5 size-4 accent-[var(--acento)]" />
                      <span><strong>{i + 1}. {m.valor}</strong>{m.ajuda && <span className="text-tinta-suave"> ({m.ajuda})</span>}</span>
                    </label>
                  ))}
                </div>
                {nEsq !== null && (
                  <p className={`mt-1 text-xs ${nEsq >= 5 ? 'font-semibold text-erro' : 'text-tinta-suave'}`}>
                    {nEsq >= 5
                      ? `Atenção: este funcionário já tem ${nEsq} esquecimentos neste mês. O limite é 5.`
                      : `Este funcionário tem ${nEsq} ${nEsq === 1 ? 'esquecimento registrado' : 'esquecimentos registrados'} neste mês (limite: 5).`}
                  </p>
                )}
              </fieldset>
              <Campo rotulo="Data da ocorrência *">
                <input type="date" value={f.data_inicio} onChange={(e) => atualizarPeriodo(e.target.value, f.qtd_dias || '1')} className={inputCls} />
              </Campo>
              <Campo rotulo="Dias (se for um período)">
                <input type="number" min={1} value={f.qtd_dias} placeholder="1" onChange={(e) => atualizarPeriodo(f.data_inicio, e.target.value)} className={inputCls} />
              </Campo>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-xs font-semibold text-tinta-suave">Horário da ocorrência</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([['horario_entrada', 'Entrada'], ['horario_saida_almoco', 'Saída almoço'], ['horario_retorno_almoco', 'Retorno almoço'], ['horario_saida', 'Saída']] as const).map(([k, r]) => (
                    <Campo key={k} rotulo={r}>
                      <input type="time" value={f[k]} onChange={(e) => set(k, e.target.value)} className={inputCls} />
                    </Campo>
                  ))}
                </div>
              </fieldset>
              {f.motivo_ocorrencia === 'Anomalia no funcionamento do REP' && (
                <Campo rotulo="Testemunha *" className="sm:col-span-2" dica="Na anomalia, o formulário precisa vir assinado por pelo menos 1 testemunha.">
                  <input value={f.testemunha} onChange={(e) => set('testemunha', e.target.value)} className={inputCls} />
                </Campo>
              )}
            </>
          )}

          {modo === 'cartao' && (
            <Campo rotulo="Mês de referência *" dica="Justificativa do mês inteiro (Estatutário).">
              <input type="month" value={f.mes_ref} max={deslocarCompetencia(hojeISO().slice(0, 8) + '01', 1).slice(0, 7)}
                onChange={(e) => set('mes_ref', e.target.value)} className={inputCls} />
            </Campo>
          )}

          {modo === 'padrao' && tem('periodo') && (
            <>
              <Campo rotulo={cfg.periodoOpcional ? 'Data (ou início)' : 'Saída *'}>
                <input type="date" value={f.data_inicio} onChange={(e) => atualizarPeriodo(e.target.value, f.qtd_dias)} className={inputCls} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo={cfg.periodoOpcional ? 'Dias' : 'Dias *'}>
                  <input type="number" min={1} value={f.qtd_dias} onChange={(e) => atualizarPeriodo(f.data_inicio, e.target.value)} className={inputCls} />
                </Campo>
                <Campo rotulo="Retorno">
                  <input type="date" value={f.data_retorno} onChange={(e) => set('data_retorno', e.target.value)} className={inputCls} />
                </Campo>
              </div>
            </>
          )}

          {tem('venda_terco') && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={f.venda_terco} onChange={(e) => set('venda_terco', e.target.checked)} className="size-4 accent-[var(--acento)]" />
              Venda de 1/3 das férias
            </label>
          )}
          {modo === 'padrao' && tem('referencia') && (
            <Campo rotulo="Referência">
              <input value={f.referencia} placeholder={cat === 'avaliacoes' ? 'Período avaliado. Ex.: 2026 ou 1º sem./2026' : 'Ex.: 25, 26 e 27/08/2026 ou 02/09/2026 a 04/09/2026'} onChange={(e) => set('referencia', e.target.value)} className={inputCls} />
            </Campo>
          )}
          {tem('quantidade') && (
            <Campo rotulo="Quantidade">
              <input value={f.quantidade} placeholder="Ex.: 42h, 54h10, 03h11" onChange={(e) => set('quantidade', e.target.value)} className={inputCls} />
            </Campo>
          )}

          <Campo className="sm:col-span-2" rotulo={
            modo === 'ocorrencia' ? `Descreva a ocorrência e os documentos anexos${f.motivo_ocorrencia === 'Outros' ? ' *' : ''}`
              : modo === 'cartao' ? 'Justificativas do mês' : 'Observação'}>
            <textarea rows={modo === 'padrao' ? 2 : 3} value={f.obs} onChange={(e) => set('obs', e.target.value)} className={inputCls} />
          </Campo>
        </div>

        <footer className="border-t border-linha px-5 py-4">
          {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
          <div className="flex justify-end gap-2">
            <Botao variante="discreto" onClick={onFechar}>Cancelar</Botao>
            <Botao type="submit" carregando={salvando}>{l ? 'Salvar alterações' : 'Lançar'}</Botao>
          </div>
        </footer>
      </form>
    </div>
  );
}
