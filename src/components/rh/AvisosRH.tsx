'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dataBR, dataHoraBR, hojeISO, mensagemErro } from '@/lib/formato';
import { Aviso, Botao, Selo, TabelaWrap, campoCls, tdCls, thCls } from '@/components/ui';
import DocumentoAviso from './DocumentoAviso';
import { Paginacao, usePaginacao } from '@/components/Paginacao';

type Linha = {
  id: string; numero: string; destino: string; data: string; situacao: 'Pendente' | 'Enviado';
  enviado_em: string | null; aviso_rh_itens: { count: number }[];
};

export default function AvisosRH({ avisoInicial, voltar }: { avisoInicial?: string; voltar: { href: string; titulo: string } }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(avisoInicial ?? null);
  const [ano, setAno] = useState(hojeISO().slice(0, 4));
  const [situacao, setSituacao] = useState('');
  const [lista, setLista] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    let q = supabase.from('avisos_rh').select('id, numero, destino, data, situacao, enviado_em, aviso_rh_itens(count)')
      .gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`);
    if (situacao) q = q.eq('situacao', situacao);
    q.order('criado_em', { ascending: false }).then(({ data, error }) => {
      if (!vivo) return;
      setLista((data as unknown as Linha[]) ?? []);
      setErro(error ? mensagemErro(error) : null);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [supabase, ano, situacao, versao]);

  function abrir(id: string | null, mudou = false) {
    setAberto(id);
    const v = `voltar=${encodeURIComponent(voltar.href)}`;
    router.replace(id ? `/avisos-rh?aviso=${id}&${v}` : `/avisos-rh?${v}`);
    if (mudou) setVersao((v) => v + 1);
  }

  const pag = usePaginacao(lista);

  const botaoVoltar = (
    <Link href={voltar.href}
      className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-linha bg-white px-3 py-2 text-sm font-semibold hover:bg-papel print:hidden">
      <ArrowLeft className="size-4" aria-hidden /> Voltar para {voltar.titulo}
    </Link>
  );

  if (aberto) return <div>{botaoVoltar}<DocumentoAviso key={aberto} avisoId={aberto} onVoltar={(mudou) => abrir(null, mudou)} /></div>;

  const anos = Array.from({ length: 4 }, (_, i) => String(Number(hojeISO().slice(0, 4)) - i));
  const pendentes = lista.filter((a) => a.situacao === 'Pendente').length;

  return (
    <div className="w-full">
      {botaoVoltar}
      <h1 className="text-2xl font-bold">Avisos RH</h1>
      <p className="mt-1 text-tinta-suave">Documentos de envio ao RH. Abra para imprimir e confirme quando forem entregues.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <select value={ano} onChange={(e) => { setCarregando(true); setAno(e.target.value); }} aria-label="Ano" className={campoCls}>
          {anos.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={situacao} onChange={(e) => { setCarregando(true); setSituacao(e.target.value); }} aria-label="Situação" className={campoCls}>
          <option value="">Todas as situações</option>
          <option value="Pendente">Aguardando entrega</option>
          <option value="Enviado">Entregues</option>
        </select>
        <Botao variante="secundario" className="ml-auto" onClick={() => router.push('/envios-rh')}>Gerar novo aviso</Botao>
      </div>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      <p className="mt-4 mb-2 text-sm text-tinta-suave" aria-live="polite">
        {carregando ? 'Carregando…' : `${lista.length} avisos${pendentes ? `, ${pendentes} aguardando entrega` : ''}`}
      </p>

      <TabelaWrap>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thCls}>Aviso</th>
              <th className={thCls}>Destino</th>
              <th className={thCls}>Data</th>
              <th className={thCls}>Pedidos</th>
              <th className={thCls}>Situação</th>
              <th className={thCls}><span className="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {!carregando && lista.length === 0 && (
              <tr><td colSpan={6} className={`${tdCls} py-8 text-center text-tinta-suave`}>Nenhum aviso neste ano. Gere um em Envios RH.</td></tr>
            )}
            {pag.visiveis.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-acento-claro/40" onClick={() => abrir(a.id)}>
                <td className={`${tdCls} font-mono font-semibold`}>{a.numero}</td>
                <td className={tdCls}>{a.destino}</td>
                <td className={tdCls}>{dataBR(a.data)}</td>
                <td className={tdCls}>{a.aviso_rh_itens[0]?.count ?? 0}</td>
                <td className={tdCls}>
                  <Selo texto={a.situacao === 'Enviado' ? 'Entregue' : 'Aguardando entrega'} />
                  {a.enviado_em && <span className="mt-0.5 block text-xs text-tinta-suave">entregue em {dataHoraBR(a.enviado_em)}</span>}
                </td>
                <td className={`${tdCls} text-right`}>
                  <Botao variante="secundario" className="px-2.5 py-1.5 text-xs" onClick={(e) => { e.stopPropagation(); abrir(a.id); }}>Abrir documento</Botao>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaWrap>
      <Paginacao p={pag} rotulo="avisos" />
    </div>
  );
}
