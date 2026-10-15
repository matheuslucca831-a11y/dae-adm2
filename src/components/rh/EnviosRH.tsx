'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, mensagemErro } from '@/lib/formato';
import { CAMPOS_TABELA, CATEGORIAS, DESTINOS_RH, detalhe, primeiro, type Lancamento } from '@/lib/lancamentos';
import { Aviso, Botao, TabelaWrap, campoCls, tdCls, thCls } from '@/components/ui';

const SEM_DESTINO = 'Sem destino';

/** Pedidos assinados, agrupados por RH, para gerar o Aviso numerado */
export default function EnviosRH() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    supabase.from('lancamentos').select(CAMPOS_TABELA)
      .eq('situacao_rh', 'Autorizado / Aguardando envio')
      .order('funcionario_nome')
      .then(({ data, error }) => {
        if (!vivo) return;
        const ls = (data as unknown as Lancamento[]) ?? [];
        setLista(ls);
        // já marca todos que ainda não estão em nenhum aviso
        setSelecionados(new Set(ls.filter((l) => !primeiro(l.aviso_rh_itens)?.aviso).map((l) => l.id)));
        setErro(error ? mensagemErro(error) : null);
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  const grupos = useMemo(() => {
    const g = new Map<string, Lancamento[]>();
    for (const d of [...DESTINOS_RH, SEM_DESTINO]) g.set(d, []);
    for (const l of lista) {
      const d = l.destino_rh ?? SEM_DESTINO;
      if (!g.has(d)) g.set(d, []);
      g.get(d)!.push(l);
    }
    return [...g.entries()].filter(([, ls]) => ls.length > 0);
  }, [lista]);

  function alternar(ids: string[], marcar: boolean) {
    setSelecionados((s) => {
      const n = new Set(s);
      ids.forEach((id) => (marcar ? n.add(id) : n.delete(id)));
      return n;
    });
  }

  async function definirDestino(l: Lancamento, destino: string) {
    setOcupado(l.id);
    const { error } = await supabase.from('lancamentos').update({ destino_rh: destino }).eq('id', l.id);
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
  }

  async function gerar(destino: string, ids: string[]) {
    setOcupado(destino);
    const { data, error } = await supabase.rpc('gerar_aviso_rh', { p_lancamentos: ids });
    setOcupado(null);
    if (error) return setErro(mensagemErro(error));
    router.push(`/avisos-rh?aviso=${data}&voltar=%2Fenvios-rh`);
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold">Envios RH</h1>
      <p className="mt-1 text-tinta-suave">
        Pedidos já assinados pela Diretoria, separados por RH. Marque os que vão juntos e gere o Aviso numerado para imprimir.
      </p>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      {carregando && <p className="mt-6 text-sm text-tinta-suave" role="status">Carregando…</p>}
      {!carregando && lista.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-linha bg-white p-8 text-sm text-tinta-suave">
          Nenhum pedido assinado aguardando envio. Os pedidos aparecem aqui depois que a Diretoria assina.
        </div>
      )}

      {grupos.map(([destino, ls]) => {
        const semDestino = destino === SEM_DESTINO;
        const livres = ls.filter((l) => !primeiro(l.aviso_rh_itens)?.aviso);
        const marcados = livres.filter((l) => selecionados.has(l.id)).map((l) => l.id);
        const todos = livres.length > 0 && marcados.length === livres.length;
        return (
          <section key={destino} className="mt-8">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{semDestino ? 'Sem destino definido' : destino}</h2>
                <p className="text-sm text-tinta-suave">
                  {semDestino
                    ? 'Vínculo sem RH definido. Escolha para onde cada pedido vai.'
                    : `${ls.length} ${ls.length === 1 ? 'pedido' : 'pedidos'}, ${marcados.length} ${marcados.length === 1 ? 'marcado' : 'marcados'}`}
                </p>
              </div>
              {!semDestino && (
                <Botao disabled={marcados.length === 0} carregando={ocupado === destino} onClick={() => gerar(destino, marcados)}>
                  <Send className="size-4" aria-hidden /> Gerar aviso ao {destino} ({marcados.length})
                </Botao>
              )}
            </div>
            <TabelaWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={`${thCls} w-10`}>
                      {!semDestino && livres.length > 0 && (
                        <input type="checkbox" checked={todos} aria-label="Marcar todos" onChange={(e) => alternar(livres.map((l) => l.id), e.target.checked)}
                          className="size-4 accent-[var(--acento)]" />
                      )}
                    </th>
                    <th className={thCls}>Protocolo</th>
                    <th className={thCls}>Funcionário</th>
                    <th className={thCls}>Unidade</th>
                    <th className={thCls}>Pedido</th>
                    <th className={thCls}>Período / Detalhe</th>
                    <th className={thCls}>Assinado por</th>
                    {semDestino && <th className={thCls}>Enviar para</th>}
                  </tr>
                </thead>
                <tbody>
                  {ls.map((l) => {
                    const aviso = primeiro(l.aviso_rh_itens)?.aviso;
                    return (
                      <tr key={l.id} className="align-top hover:bg-papel/50">
                        <td className={tdCls}>
                          {!semDestino && !aviso && (
                            <input type="checkbox" checked={selecionados.has(l.id)} aria-label={`Marcar ${l.protocolo_dae}`}
                              onChange={(e) => alternar([l.id], e.target.checked)} className="size-4 accent-[var(--acento)]" />
                          )}
                        </td>
                        <td className={`${tdCls} whitespace-nowrap font-mono text-xs`}>{l.protocolo_dae}</td>
                        <td className={`${tdCls} font-medium`}>
                          {l.funcionario_nome}
                          {aviso && (
                            <Link href={`/avisos-rh?aviso=${aviso.id}`} className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-azul hover:underline">
                              <FileText className="size-3" aria-hidden /> já está no Aviso {aviso.numero}
                            </Link>
                          )}
                        </td>
                        <td className={tdCls}>{l.unidade_nome}</td>
                        <td className={tdCls}>{l.tipo}<span className="block text-xs text-tinta-suave">{CATEGORIAS[l.categoria].titulo}</span></td>
                        <td className={`${tdCls} whitespace-nowrap`}>{detalhe(l)}</td>
                        <td className={tdCls}>
                          {l.diretora === 'Dispensado' ? 'Sem assinatura (promoção)' : l.diretor_nome}
                          {l.data_assinatura && <span className="block text-xs text-tinta-suave">em {dataBR(l.data_assinatura)}</span>}
                        </td>
                        {semDestino && (
                          <td className={tdCls}>
                            <select defaultValue="" disabled={ocupado === l.id} onChange={(e) => e.target.value && definirDestino(l, e.target.value)}
                              aria-label="Enviar para" className={campoCls}>
                              <option value="">Escolher…</option>
                              {DESTINOS_RH.map((d) => <option key={d}>{d}</option>)}
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TabelaWrap>
          </section>
        );
      })}
    </div>
  );
}
