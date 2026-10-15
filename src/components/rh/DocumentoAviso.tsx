'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer, Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, dataHoraBR, mensagemErro } from '@/lib/formato';
import { CAMPOS_LANCAMENTO, type Lancamento } from '@/lib/lancamentos';
import { SECOES_DOC, celulas, secaoDocumento } from '@/lib/documentoRH';
import { Aviso, Botao, Selo } from '@/components/ui';

type AvisoRH = {
  id: string; numero: string; destino: string; data: string; situacao: 'Pendente' | 'Enviado'; enviado_em: string | null;
  aviso_rh_itens: { lancamento: Lancamento | null }[];
};

/** Documento A4 de envio ao RH, com impressão e confirmação do envio */
export default function DocumentoAviso({ avisoId, onVoltar }: { avisoId: string; onVoltar: (mudou: boolean) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [aviso, setAviso] = useState<AvisoRH | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    supabase.from('avisos_rh')
      .select(`id, numero, destino, data, situacao, enviado_em, aviso_rh_itens(lancamento:lancamentos(${CAMPOS_LANCAMENTO}))`)
      .eq('id', avisoId).single()
      .then(({ data, error }) => {
        if (!vivo) return;
        setAviso(data as unknown as AvisoRH | null);
        setErro(error ? mensagemErro(error) : null);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, avisoId, versao]);

  const grupos = useMemo(() => {
    const g: Record<string, Lancamento[]> = {};
    for (const it of aviso?.aviso_rh_itens ?? []) {
      if (!it.lancamento) continue;
      (g[secaoDocumento(it.lancamento)] ??= []).push(it.lancamento);
    }
    Object.values(g).forEach((ls) => ls.sort((a, b) => a.funcionario_nome.localeCompare(b.funcionario_nome, 'pt-BR')));
    return g;
  }, [aviso]);

  async function confirmarEnvio() {
    if (!window.confirm(`Confirmar que o Aviso ${aviso?.numero} foi entregue ao ${aviso?.destino}? Os pedidos passam para "No RH".`)) return;
    setOcupado(true);
    const { error } = await supabase.rpc('confirmar_envio_aviso', { p_aviso: avisoId });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setVersao((v) => v + 1);
  }

  async function cancelar() {
    if (!window.confirm(`Cancelar o Aviso ${aviso?.numero}? Os pedidos voltam para a lista de envio.`)) return;
    setOcupado(true);
    const { error } = await supabase.from('avisos_rh').delete().eq('id', avisoId);
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    onVoltar(true);
  }

  const qtd = aviso?.aviso_rh_itens.length ?? 0;

  return (
    <div>
      {/* Barra de ações (não sai na impressão) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button type="button" onClick={() => onVoltar(versao > 0)} className="inline-flex items-center gap-1.5 text-sm font-medium text-tinta-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Todos os avisos
        </button>
        {aviso && (
          <div className="flex flex-wrap items-center gap-2">
            <Selo texto={aviso.situacao === 'Enviado' ? 'Entregue' : 'Aguardando entrega'} />
            {aviso.enviado_em && <span className="text-xs text-tinta-suave">entregue em {dataHoraBR(aviso.enviado_em)}</span>}
            <Botao variante="secundario" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Imprimir / PDF</Botao>
            {aviso.situacao === 'Pendente' && (
              <>
                <Botao variante="discreto" carregando={ocupado} onClick={cancelar}><Trash2 className="size-4" aria-hidden /> Cancelar aviso</Botao>
                <Botao carregando={ocupado} onClick={confirmarEnvio}><Send className="size-4" aria-hidden /> Confirmar envio ao RH</Botao>
              </>
            )}
          </div>
        )}
      </div>
      {erro && <div className="mt-4 print:hidden"><Aviso>{erro}</Aviso></div>}

      {!aviso ? (
        <p className="mt-6 text-sm text-tinta-suave" role="status">Carregando o aviso…</p>
      ) : (
        <div className="mt-6 overflow-x-auto print:mt-0 print:overflow-visible">
          <article className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[18mm] text-black shadow-md print:min-h-0 print:w-full print:p-0 print:shadow-none">
            <div className="border-b-2 border-black pb-3 text-center">
              <p className="text-[15px] font-bold uppercase tracking-wide">Fundação de Saúde Pública de São Sebastião</p>
              <p className="mt-0.5 text-[13px] font-semibold uppercase tracking-wider">Diretoria de Atenção Especializada</p>
            </div>

            <div className="mt-5 flex justify-between text-[12.5px]">
              <span><strong>Aviso nº:</strong> {aviso.numero}</span>
              <span><strong>Data:</strong> {dataBR(aviso.data)}</span>
            </div>
            <p className="mt-3 text-[13px]"><strong>Ao:</strong> {aviso.destino}</p>
            <p className="mt-4 text-[12.5px] leading-relaxed">
              Encaminhamos, para as providências cabíveis, os lançamentos administrativos abaixo relacionados,
              devidamente autorizados pela Diretoria de Atenção Especializada. Total: {qtd} {qtd === 1 ? 'registro' : 'registros'}.
            </p>

            {SECOES_DOC.filter((s) => grupos[s.id]?.length).map((s) => (
              <section key={s.id} className="mt-6 break-inside-avoid">
                <h3 className="mb-1.5 border-b border-black/40 pb-1 text-[12px] font-bold uppercase tracking-wide">{s.titulo}</h3>
                <table className="w-full border-collapse text-[11.5px]">
                  <thead>
                    <tr className="bg-black/5">
                      {s.colunas.map((c) => <th key={c} className="border border-black/40 px-2 py-1 text-left font-semibold">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos[s.id].map((l) => {
                      const cs = celulas(s.id, l);
                      return (
                        <tr key={l.id}>
                          {s.colunas.map((c, i) => <td key={c} className="border border-black/40 px-2 py-1 align-top">{cs[i] || '—'}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}

            <div className="mt-20 text-center text-[12px]">
              <div className="inline-block border-t border-black px-14 pt-1">Diretoria de Atenção Especializada</div>
            </div>
            <p className="mt-10 border-t border-black/20 pt-2 text-center text-[9px] text-black/50">
              Documento gerado pelo sistema Gestão de Funcionários (DAE), Aviso nº {aviso.numero}
            </p>
          </article>
        </div>
      )}
    </div>
  );
}
