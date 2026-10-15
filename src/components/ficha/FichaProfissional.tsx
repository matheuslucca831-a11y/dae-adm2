'use client';

import { useId, type ReactNode } from 'react';
import { formatarCNS, formatarCPF, mascaraCNS, mascaraCPF, soDigitos } from '@/lib/formato';
import { Campo, inputCls } from '@/components/ui';
import CampoCargo, { useCargosInfo } from '@/components/CampoCargo';

/** Campos da ficha "Cadastro de Profissionais em Estabelecimentos de Saúde" (CNES) */
export type FichaDados = {
  nome: string; cpf: string; cns: string; data_nascimento: string; rg: string; sexo: string;
  matricula: string; cargo: string; cbo: string; vinculo: string; forma_contratacao: string;
  carga_horaria_semanal: string; conselho: string; numero_conselho: string; conselho_uf: string;
};

export const FICHA_VAZIA: FichaDados = {
  nome: '', cpf: '', cns: '', data_nascimento: '', rg: '', sexo: '',
  matricula: '', cargo: '', cbo: '', vinculo: '', forma_contratacao: '',
  carga_horaria_semanal: '', conselho: '', numero_conselho: '', conselho_uf: '',
};

export const FORMAS_CONTRATACAO = [
  'Concurso FSPSS', 'Concurso PMSS', 'Comissionado FSPSS', 'Comissionado PMSS', 'Pessoa Jurídica - PJ', 'Contrato Temporário - FSPSS',
];
/** Forma de contratação → vínculo usado nas regras do sistema */
const VINCULO_DA_FORMA: Record<string, string> = {
  'Concurso FSPSS': 'FSPSS', 'Comissionado FSPSS': 'FSPSS', 'Contrato Temporário - FSPSS': 'FSPSS',
  'Concurso PMSS': 'Estatutário', 'Comissionado PMSS': 'Estatutário', 'Pessoa Jurídica - PJ': 'Outros',
};
const CONSELHOS = ['COREN', 'CRM', 'CRO', 'CRF', 'CRP', 'CRESS', 'CREFITO', 'CRN', 'CRFa', 'CRBM', 'CRTR', 'CRC', 'OAB'];
export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

/** Dados vindos do banco → formulário */
export function fichaDoBanco(d: Record<string, unknown>): FichaDados {
  const f = { ...FICHA_VAZIA };
  (Object.keys(FICHA_VAZIA) as (keyof FichaDados)[]).forEach((k) => {
    const v = d[k];
    if (v !== null && v !== undefined) f[k] = String(v);
  });
  f.cpf = formatarCPF(f.cpf);
  f.cns = formatarCNS(f.cns);
  return f;
}

/** Formulário → banco ('' vira null) */
export function fichaParaBanco(f: FichaDados) {
  const t = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    nome: f.nome.trim(), matricula: t(f.matricula), cpf: t(soDigitos(f.cpf)), cns: t(soDigitos(f.cns)),
    data_nascimento: t(f.data_nascimento), rg: t(f.rg), sexo: t(f.sexo),
    cargo: t(f.cargo), cbo: t(f.cbo), vinculo: t(f.vinculo), forma_contratacao: t(f.forma_contratacao),
    carga_horaria_semanal: f.carga_horaria_semanal ? Number(f.carga_horaria_semanal) : null,
    conselho: t(f.conselho), numero_conselho: t(f.numero_conselho), conselho_uf: t(f.conselho_uf),
  };
}

/**
 * Confere a ficha. `completa` = cadastro novo ou sugestão (exige os campos com *);
 * ao editar um cadastro antigo só confere o formato.
 */
export function validarFicha(f: FichaDados, { completa, matricula }: { completa: boolean; matricula?: boolean }) {
  const cpf = soDigitos(f.cpf);
  const cns = soDigitos(f.cns);
  if (!f.nome.trim()) return 'Informe o nome do profissional.';
  if (matricula && !f.matricula.trim()) return 'Informe a matrícula.';
  if (cpf && cpf.length !== 11) return 'O CPF precisa ter 11 dígitos.';
  if (cns && cns.length !== 15) return 'O Cartão SUS precisa ter 15 dígitos.';
  if (f.numero_conselho.trim() && !f.conselho.trim()) return 'Informe o órgão do conselho de classe (ex.: COREN).';
  if (!completa) return null;
  const faltam = [
    !cpf && 'CPF', !f.data_nascimento && 'data de nascimento', !f.sexo && 'sexo',
    !f.cargo.trim() && 'cargo', !f.vinculo && 'vínculo', !f.forma_contratacao && 'forma de contratação',
  ].filter(Boolean);
  return faltam.length ? `Preencha: ${faltam.join(', ')}.` : null;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-linha bg-white p-4">
      <legend className="px-1 text-sm font-bold">{titulo}</legend>
      {children}
    </fieldset>
  );
}

type Props = {
  valor: FichaDados;
  onChange: (patch: Partial<FichaDados>) => void;
  vinculos: string[];
  /** obrigatoriedade mostrada nos rótulos */
  completa?: boolean;
  matriculaObrigatoria?: boolean;
  /** ao sair da matrícula ou do CPF (a unidade usa para ver se já existe) */
  onIdentificacao?: () => void;
  numeroSecao?: number;
};

/** Seções "Dados do Profissional" e "Dados Profissionais" da ficha */
export default function FichaProfissional({ valor: f, onChange, vinculos, completa = true, matriculaObrigatoria, onIdentificacao, numeroSecao = 1 }: Props) {
  const cargos = useCargosInfo();
  const listaConselhos = useId();
  const ob = (r: string) => (completa ? `${r} *` : r);

  function mudarCargo(cargo: string) {
    const novo = cargos.find((c) => c.nome === cargo);
    const antigo = cargos.find((c) => c.nome === f.cargo);
    // CBO acompanha o cargo, a menos que tenha sido digitado à mão
    const cboAutomatico = !f.cbo || f.cbo === antigo?.cbo;
    onChange({ cargo, ...(novo?.cbo && cboAutomatico ? { cbo: novo.cbo } : {}) });
  }

  function mudarForma(forma: string) {
    const v = VINCULO_DA_FORMA[forma];
    onChange({ forma_contratacao: forma, ...(v && vinculos.includes(v) ? { vinculo: v } : {}) });
  }

  return (
    <>
      <Secao titulo={`${numeroSecao} - Dados do Profissional`}>
        <div className="grid gap-3 sm:grid-cols-6">
          <Campo rotulo="Nome do profissional *" className="sm:col-span-6">
            <input value={f.nome} onChange={(e) => onChange({ nome: e.target.value })} className={inputCls} />
          </Campo>
          <Campo rotulo={ob('CPF')} className="sm:col-span-2">
            <input value={f.cpf} inputMode="numeric" maxLength={14} placeholder="000.000.000-00"
              onChange={(e) => onChange({ cpf: mascaraCPF(e.target.value) })} onBlur={onIdentificacao} className={inputCls} />
          </Campo>
          <Campo rotulo="Cartão SUS" className="sm:col-span-2">
            <input value={f.cns} inputMode="numeric" maxLength={18} placeholder="000 0000 0000 0000"
              onChange={(e) => onChange({ cns: mascaraCNS(e.target.value) })} className={inputCls} />
          </Campo>
          <Campo rotulo={ob('Data de nascimento')} className="sm:col-span-2">
            <input type="date" value={f.data_nascimento} onChange={(e) => onChange({ data_nascimento: e.target.value })} className={inputCls} />
          </Campo>
          <Campo rotulo="RG" className="sm:col-span-3">
            <input value={f.rg} onChange={(e) => onChange({ rg: e.target.value })} className={inputCls} />
          </Campo>
          <div className="sm:col-span-3">
            <span className="mb-1 block text-xs font-semibold text-tinta-suave">{ob('Sexo')}</span>
            <div className="flex h-[38px] items-center gap-4 text-sm" role="radiogroup" aria-label="Sexo">
              {['Feminino', 'Masculino'].map((s) => (
                <label key={s} className="flex items-center gap-1.5">
                  <input type="radio" name={`sexo-${listaConselhos}`} checked={f.sexo === s} onChange={() => onChange({ sexo: s })}
                    className="size-4 accent-[var(--acento)]" />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo={`${numeroSecao + 1} - Dados Profissionais`}>
        <div className="grid gap-3 sm:grid-cols-6">
          <Campo rotulo={matriculaObrigatoria ? 'Matrícula *' : 'Matrícula'} className="sm:col-span-2">
            <input value={f.matricula} onChange={(e) => onChange({ matricula: e.target.value })} onBlur={onIdentificacao} className={inputCls} />
          </Campo>
          <Campo rotulo={ob('Cargo')} className="sm:col-span-4">
            <CampoCargo value={f.cargo} onChange={mudarCargo} />
          </Campo>

          <div className="sm:col-span-6">
            <span className="mb-1 block text-xs font-semibold text-tinta-suave">{ob('Forma de contratação do profissional')}</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm" role="radiogroup" aria-label="Forma de contratação">
              {FORMAS_CONTRATACAO.map((fc) => (
                <label key={fc} className="flex items-center gap-1.5">
                  <input type="radio" name={`forma-${listaConselhos}`} checked={f.forma_contratacao === fc} onChange={() => mudarForma(fc)}
                    className="size-4 accent-[var(--acento)]" />
                  {fc}
                </label>
              ))}
            </div>
          </div>

          <Campo rotulo={ob('Vínculo')} className="sm:col-span-2" dica="Preenchido pela forma de contratação; pode trocar.">
            <select value={f.vinculo} onChange={(e) => onChange({ vinculo: e.target.value })} className={inputCls}>
              <option value="">Selecione</option>
              {vinculos.map((v) => <option key={v}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Carga horária semanal" className="sm:col-span-2">
            <input type="number" min={0} max={80} value={f.carga_horaria_semanal} placeholder="ex.: 40"
              onChange={(e) => onChange({ carga_horaria_semanal: e.target.value })} className={inputCls} />
          </Campo>
          <Campo rotulo="CBO" className="sm:col-span-2" dica="Vem do cargo quando cadastrado em Administração.">
            <input value={f.cbo} onChange={(e) => onChange({ cbo: e.target.value })} placeholder="ex.: 2235-05" className={inputCls} />
          </Campo>

          <Campo rotulo="Nº de registro no conselho de classe" className="sm:col-span-3">
            <input value={f.numero_conselho} onChange={(e) => onChange({ numero_conselho: e.target.value })} className={inputCls} />
          </Campo>
          <Campo rotulo="Órgão" className="sm:col-span-2">
            <input list={listaConselhos} value={f.conselho} placeholder="ex.: COREN"
              onChange={(e) => onChange({ conselho: e.target.value.toUpperCase(), ...(e.target.value && !f.conselho_uf ? { conselho_uf: 'SP' } : {}) })}
              className={inputCls} />
            <datalist id={listaConselhos}>{CONSELHOS.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo rotulo="UF" className="sm:col-span-1">
            <select value={f.conselho_uf} onChange={(e) => onChange({ conselho_uf: e.target.value })} className={inputCls}>
              <option value="">–</option>
              {UFS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Campo>
        </div>
      </Secao>
    </>
  );
}
