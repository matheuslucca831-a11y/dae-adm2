'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro, normalizar } from '@/lib/formato';
import { buscarTudo } from '@/lib/buscarTudo';
import { carregarCargos } from '@/components/CampoCargo';
import { Paginacao, usePaginacao } from '@/components/Paginacao';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, tdCls, thCls } from '@/components/ui';

type Cargo = { nome: string; cbo: string | null; ativo: boolean; funcionarios: number };

export default function AdminCargos() {
  const supabase = useMemo(() => createClient(), []);
  const [cargos, setCargos] = useState<Cargo[] | null>(null);
  const [fora, setFora] = useState<{ nome: string; funcionarios: number }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState('');
  const [busca, setBusca] = useState('');
  const [ed, setEd] = useState<{ antigo: string; nome: string; cbo: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      supabase.from('cargos').select('*').order('nome'),
      buscarTudo<{ cargo: string | null }>((de, ate) =>
        supabase.from('funcionarios').select('cargo').eq('situacao', 'Ativo').order('id').range(de, ate)),
    ]).then(([c, f]) => {
      if (!vivo) return;
      const qtd = new Map<string, number>();
      (f.data ?? []).forEach((x) => {
        const n = x.cargo?.trim();
        if (n) qtd.set(n, (qtd.get(n) ?? 0) + 1);
      });
      const lista = (c.data ?? []).map((x) => ({ nome: x.nome, cbo: x.cbo ?? null, ativo: x.ativo, funcionarios: qtd.get(x.nome) ?? 0 }));
      const chaves = new Set(lista.map((x) => normalizar(x.nome)));
      setCargos(lista);
      setFora([...qtd].filter(([n]) => !chaves.has(normalizar(n)))
        .map(([nome, funcionarios]) => ({ nome, funcionarios }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      setErro(c.error ? mensagemErro(c.error) : null);
    });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  async function executar(q: PromiseLike<{ error: { message?: string; code?: string } | null }>, depois?: () => void) {
    const { error } = await q;
    if (error) return setErro(error.code === '23505' ? 'Esse cargo já está na lista.' : mensagemErro(error));
    setErro(null);
    depois?.();
    carregarCargos(true);
    setVersao((v) => v + 1);
  }

  const filtrados = useMemo(() => {
    const b = normalizar(busca.trim());
    return b ? (cargos ?? []).filter((c) => normalizar(c.nome).includes(b)) : (cargos ?? []);
  }, [cargos, busca]);
  const pag = usePaginacao(filtrados, 50);

  return (
    <>
      <p className="text-sm text-tinta-suave">
        Esta lista aparece no campo Cargo do cadastro e na sugestão das unidades. Em Editar dá para renomear e informar o CBO (ele preenche sozinho no cadastro). Renomear um cargo atualiza os funcionários que estão com ele.
        Desativar tira o cargo da lista sem mexer em quem já o tem.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-linha bg-white p-3">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nome do novo cargo" aria-label="Novo cargo" className={`${campoCls} min-w-64 flex-1`} />
        <Botao onClick={() => {
          if (!novo.trim()) return setErro('Digite o nome do cargo e clique em Adicionar cargo.');
          executar(supabase.from('cargos').insert({ nome: novo.trim().toUpperCase() }), () => setNovo(''));
        }}>
          <Plus className="size-4" aria-hidden /> Adicionar cargo
        </Botao>
      </div>
      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}

      {fora.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold">Cargos usados nos cadastros que não estão na lista</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {fora.map((c) => (
              <li key={c.nome} className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-2 py-1">
                {c.nome} <span className="text-xs text-tinta-suave">({c.funcionarios})</span>
                <button type="button" className="text-xs font-semibold text-acento-escuro underline"
                  onClick={() => executar(supabase.from('cargos').insert({ nome: c.nome.trim() }))}>
                  pôr na lista
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cargo" aria-label="Buscar cargo" className={`${campoCls} min-w-64`} />
        {cargos && <span className="text-sm text-tinta-suave">{filtrados.length} de {cargos.length} cargos</span>}
      </div>

      <div className="mt-3">
        <TabelaWrap>
          <table className="w-full text-sm">
            <thead><tr><th className={thCls}>Cargo</th><th className={thCls}>CBO</th><th className={thCls}>Funcionários ativos</th><th className={thCls}>Situação</th><th className={thCls}><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {!cargos && <tr><td colSpan={5} className={`${tdCls} text-tinta-suave`}>Carregando…</td></tr>}
              {pag.visiveis.map((c) => (
                <tr key={c.nome} className={`hover:bg-papel/50 ${c.ativo ? '' : 'text-tinta-suave'}`}>
                  <td className={`${tdCls} font-medium`}>
                    {ed?.antigo === c.nome
                      ? <input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} aria-label="Nome" className={`${campoCls} w-full`} />
                      : c.nome}
                  </td>
                  <td className={tdCls}>
                    {ed?.antigo === c.nome
                      ? <input value={ed.cbo} onChange={(e) => setEd({ ...ed, cbo: e.target.value })} placeholder="ex.: 2235-05" aria-label="CBO" className={`${campoCls} w-28`} />
                      : c.cbo || <span className="text-xs text-tinta-suave">–</span>}
                  </td>
                  <td className={tdCls}>{c.funcionarios}</td>
                  <td className={tdCls}><Selo texto={c.ativo ? 'Ativo' : 'Inativo'} /></td>
                  <td className={`${tdCls} whitespace-nowrap text-right`}>
                    {ed?.antigo === c.nome ? (
                      <>
                        <Botao className="px-2.5 py-1.5 text-xs" disabled={!ed.nome.trim()}
                          onClick={() => executar(supabase.from('cargos').update({ nome: ed.nome.trim(), cbo: ed.cbo.trim() || null }).eq('nome', c.nome), () => setEd(null))}>Salvar</Botao>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd(null)}>Cancelar</Botao>
                      </>
                    ) : (
                      <>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs" onClick={() => setEd({ antigo: c.nome, nome: c.nome, cbo: c.cbo ?? '' })}>Editar</Botao>
                        <Botao variante="discreto" className="px-2.5 py-1.5 text-xs"
                          onClick={() => executar(supabase.from('cargos').update({ ativo: !c.ativo }).eq('nome', c.nome))}>
                          {c.ativo ? 'Desativar' : 'Reativar'}
                        </Botao>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaWrap>
        <Paginacao p={pag} rotulo="cargos" />
      </div>
    </>
  );
}
