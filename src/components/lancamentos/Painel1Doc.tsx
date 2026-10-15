'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro } from '@/lib/formato';
import type { Lancamento } from '@/lib/lancamentos';
import { Aviso, Botao, Campo, Selo, inputCls } from '@/components/ui';

type Comunicado = {
  id: string; destinatarios: string[]; numero_1doc: string | null; data_envio: string | null;
  situacao: 'Pendente' | 'Enviado'; obs: string | null;
};

const CENTRAL = 'Central de Regulação';
const caixa = 'size-4 accent-[var(--acento)]';

/** Comunicação 1Doc de um lançamento: destinatários, número e envio */
export default function Painel1Doc({
  lancamento, podeEditar, onFechar, onSalvo,
}: {
  lancamento: Lancamento; podeEditar: boolean; onFechar: () => void; onSalvo: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [c, setC] = useState<Comunicado | null>(null);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [mostraUnidades, setMostraUnidades] = useState(false);
  const [mostraOutro, setMostraOutro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [com, lot] = await Promise.all([
        supabase.from('comunicados_1doc').select('id, destinatarios, numero_1doc, data_envio, situacao, obs')
          .eq('lancamento_id', lancamento.id).maybeSingle(),
        supabase.from('lotacoes').select('unidade:unidades(nome)')
          .eq('funcionario_id', lancamento.funcionario_id).eq('situacao', 'Ativa'),
      ]);
      if (!vivo) return;
      const dados = com.data as Comunicado | null;
      const unidades = ((lot.data ?? []) as unknown as { unidade: { nome: string } | null }[])
        .map((x) => x.unidade?.nome).filter(Boolean) as string[];
      // unidades das lotações ativas + as que já estavam marcadas
      const todas = [...new Set([...unidades, ...(dados?.destinatarios ?? []).filter((d) => d !== CENTRAL && !d.startsWith('Outro'))])].sort();
      setC(dados);
      setUnidades(todas);
      setMostraUnidades((dados?.destinatarios ?? []).some((d) => todas.includes(d)));
      setMostraOutro((dados?.destinatarios ?? []).some((d) => d.startsWith('Outro')));
      setErro(com.error ? mensagemErro(com.error) : null);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, lancamento.id, lancamento.funcionario_id]);

  const editavel = podeEditar && c?.situacao === 'Pendente';

  async function salvar(situacao: 'Pendente' | 'Enviado') {
    if (!c) return;
    if (situacao === 'Enviado' && c.destinatarios.length === 0) return setErro('Marque pelo menos um destinatário.');
    if (c.destinatarios.some((d) => d.startsWith('Outro') && !d.replace(/^Outro:?\s*/, '').trim())) return setErro('Escreva quem é o destinatário "Outro".');
    setSalvando(true);
    const { error } = await supabase.from('comunicados_1doc').update({
      destinatarios: c.destinatarios, numero_1doc: c.numero_1doc?.trim() || null,
      data_envio: c.data_envio || null, obs: c.obs?.trim() || null, situacao,
    }).eq('id', c.id);
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    onSalvo();
  }

  // ---------- Editor de destinatários ----------
  const dests = c?.destinatarios ?? [];
  const definir = (lista: string[]) => c && setC({ ...c, destinatarios: lista });
  const marcar = (d: string, sim: boolean) => definir(sim ? [...new Set([...dests, d])] : dests.filter((x) => x !== d));
  const todasUnidades = unidades.length > 0 && unidades.every((u) => dests.includes(u));
  const outroTexto = (dests.find((d) => d.startsWith('Outro')) ?? '').replace(/^Outro:?\s*/, '');
  function alternarUnidades(sim: boolean) {
    setMostraUnidades(sim);
    if (!sim) definir(dests.filter((d) => !unidades.includes(d)));
  }
  function alternarOutro(sim: boolean) {
    setMostraOutro(sim);
    definir(sim ? [...dests.filter((d) => !d.startsWith('Outro')), 'Outro: '] : dests.filter((d) => !d.startsWith('Outro')));
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-tinta/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-1doc" className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-linha px-5 py-4">
          <div>
            <h2 id="titulo-1doc" className="text-lg font-bold">Comunicação 1Doc</h2>
            <p className="text-sm text-tinta-suave">{lancamento.protocolo_dae}, {lancamento.funcionario_nome}</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1.5 text-tinta-suave hover:bg-papel"><X className="size-5" /></button>
        </header>

        <div className="space-y-4 px-5 py-5">
          {carregando ? (
            <p className="text-sm text-tinta-suave" role="status">Carregando…</p>
          ) : !c ? (
            <p className="text-sm text-tinta-suave">
              Ainda não há comunicação. Ela é criada quando a Diretoria assina, se o funcionário exige 1Doc.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2"><span className="text-sm font-semibold">Situação:</span><Selo texto={c.situacao === 'Enviado' ? 'Enviada' : 'Em preparação'} /></div>
              <fieldset disabled={!editavel} className="space-y-2">
                <legend className="mb-1 text-xs font-semibold text-tinta-suave">Destinatários</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dests.includes(CENTRAL)} onChange={(e) => marcar(CENTRAL, e.target.checked)} className={caixa} />
                  Central de Regulação
                </label>
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={mostraUnidades} onChange={(e) => alternarUnidades(e.target.checked)} className={caixa} />
                    Unidades onde atende
                  </label>
                  {mostraUnidades && (
                    <div className="ml-6 mt-1.5 space-y-1 border-l-2 border-linha pl-3">
                      {unidades.length === 0 ? (
                        <p className="text-xs text-tinta-suave">O funcionário não tem lotação ativa.</p>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 text-xs font-semibold">
                            <input type="checkbox" checked={todasUnidades}
                              onChange={(e) => definir(e.target.checked ? [...new Set([...dests, ...unidades])] : dests.filter((d) => !unidades.includes(d)))}
                              className={caixa} />
                            Selecionar todas
                          </label>
                          {unidades.map((u) => (
                            <label key={u} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={dests.includes(u)} onChange={(e) => marcar(u, e.target.checked)} className={caixa} />
                              {u}
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={mostraOutro} onChange={(e) => alternarOutro(e.target.checked)} className={caixa} />
                    Outro
                  </label>
                  {mostraOutro && (
                    <input value={outroTexto} placeholder="Quem é o destinatário?" aria-label="Outro destinatário"
                      onChange={(e) => definir([...dests.filter((d) => !d.startsWith('Outro')), `Outro: ${e.target.value}`])}
                      className={`${inputCls} ml-6 mt-1.5 max-w-xs`} />
                  )}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Nº do 1Doc">
                  <input value={c.numero_1doc ?? ''} disabled={!editavel} onChange={(e) => setC({ ...c, numero_1doc: e.target.value })} className={inputCls} />
                </Campo>
                <Campo rotulo="Data de envio">
                  <input type="date" value={c.data_envio ?? ''} disabled={!editavel} onChange={(e) => setC({ ...c, data_envio: e.target.value })} className={inputCls} />
                </Campo>
              </div>
              <Campo rotulo="Observação">
                <textarea rows={2} value={c.obs ?? ''} disabled={!editavel} onChange={(e) => setC({ ...c, obs: e.target.value })} className={inputCls} />
              </Campo>
            </>
          )}
        </div>

        <footer className="border-t border-linha px-5 py-4">
          {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="discreto" onClick={onFechar}>Fechar</Botao>
            {podeEditar && c?.situacao === 'Pendente' && (
              <>
                <Botao variante="secundario" carregando={salvando} onClick={() => salvar('Pendente')}>Salvar</Botao>
                <Botao carregando={salvando} onClick={() => salvar('Enviado')}>Marcar como enviado</Botao>
              </>
            )}
            {podeEditar && c?.situacao === 'Enviado' && (
              <Botao variante="secundario" carregando={salvando} onClick={() => salvar('Pendente')}>Voltar para pendente</Botao>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
