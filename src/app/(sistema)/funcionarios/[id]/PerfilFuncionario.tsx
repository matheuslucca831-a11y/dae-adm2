'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mensagemErro } from '@/lib/formato';
import { registrarAcesso } from '@/lib/acessos';
import DadosFicha from '@/components/ficha/DadosFicha';
import { Aviso, Botao, Selo } from '@/components/ui';
import FormFuncionario, { type UnidadeOpcao } from '../FormFuncionario';
import LotacoesEscalas from './LotacoesEscalas';
import HistoricoFuncionario from './HistoricoFuncionario';
import AcessosFuncionario from './AcessosFuncionario';

type Funcionario = {
  id: string; nome: string; matricula: string | null; cpf: string | null; data_nascimento: string | null;
  cargo: string | null; vinculo: string | null; situacao: 'Ativo' | 'Inativo'; inativo_justificativa: string | null;
  exige_1doc: boolean; destino_1doc: string | null; obs: string | null;
  cns: string | null; rg?: string | null; sexo?: string | null; cbo: string | null; conselho: string | null;
  numero_conselho: string | null; conselho_uf?: string | null; forma_contratacao?: string | null; carga_horaria_semanal: number | null;
};

export default function PerfilFuncionario({ id }: { id: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState<Funcionario | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOpcao[]>([]);
  const [vinculos, setVinculos] = useState<string[]>([]);
  const [aba, setAba] = useState<'lotacoes' | 'historico' | 'acessos'>('lotacoes');
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  // log: quem abriu os dados deste funcionário
  useEffect(() => {
    registrarAcesso(supabase, id, 'Perfil (Sede)');
  }, [supabase, id]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [fu, un, vi] = await Promise.all([
        supabase.from('funcionarios').select('*')
          .eq('id', id).single(),
        supabase.from('unidades').select('*').eq('ativa', true).order('nome'),
        supabase.from('vinculos').select('nome').order('nome'),
      ]);
      if (!vivo) return;
      setF(fu.data as Funcionario | null);
      setUnidades((un.data as UnidadeOpcao[]) ?? []);
      setVinculos((vi.data ?? []).map((v) => v.nome));
      setErro(fu.error ? mensagemErro(fu.error) : null);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, id, versao]);

  const dado = (rotulo: string, valor?: string | null) => (
    <div>
      <dt className="text-xs font-semibold text-tinta-suave">{rotulo}</dt>
      <dd className="text-sm">{valor || '—'}</dd>
    </div>
  );

  return (
    <div className="w-full">
      <Link href="/funcionarios" className="inline-flex items-center gap-1.5 text-sm font-medium text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden /> Funcionários
      </Link>

      {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      {!f ? (
        !erro && <p className="mt-6 text-sm text-tinta-suave" role="status">Carregando…</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold">{f.nome} <Selo texto={f.situacao} /></h1>
              {f.situacao === 'Inativo' && f.inativo_justificativa && <p className="mt-1 text-sm text-tinta-suave">Inativo: {f.inativo_justificativa}</p>}
            </div>
            <Botao variante="secundario" onClick={() => setEditando(true)}><Pencil className="size-4" aria-hidden /> Editar dados</Botao>
          </div>

          <DadosFicha f={f} className="mt-4" />

          <div role="tablist" aria-label="Seções" className="mt-6 flex gap-1 border-b border-linha">
            {([['lotacoes', 'Lotações e escalas'], ['historico', 'Histórico'], ['acessos', 'Quem consultou']] as const).map(([v, r]) => (
              <button key={v} role="tab" type="button" aria-selected={aba === v} onClick={() => setAba(v)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${aba === v ? 'border-acento text-acento-escuro' : 'border-transparent text-tinta-suave hover:text-tinta'}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="mt-5">
            {aba === 'lotacoes' && <LotacoesEscalas funcionarioId={id} unidades={unidades} />}
            {aba === 'historico' && <HistoricoFuncionario funcionarioId={id} />}
            {aba === 'acessos' && <AcessosFuncionario funcionarioId={id} />}
          </div>
        </>
      )}

      {editando && (
        <FormFuncionario funcionarioId={id} unidades={unidades} vinculos={vinculos} mostrarLotacoes={false}
          onFechar={() => setEditando(false)} onSalvo={() => { setEditando(false); setVersao((v) => v + 1); }} />
      )}
    </div>
  );
}
