'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Building2, Landmark } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { TipoAcesso } from '@/lib/types';

const MODOS: Record<TipoAcesso, { rotulo: string; subtitulo: string; sigla: string; texto: string; icone: typeof Building2 }> = {
  central: {
    rotulo: 'Sistema Integrado da Atenção Especializada',
    subtitulo: 'Sede DAE',
    sigla: 'ADM Central',
    texto: 'Equipe da DAE na sede: cadastro de funcionários, autorização da Diretora e envios ao RH.',
    icone: Landmark,
  },
  unidade: {
    rotulo: 'Gestão Descentralizada das Unidades',
    subtitulo: 'Unidades de Saúde',
    sigla: 'ADM Unidade',
    texto: 'Administrativo das unidades: lançamentos e acompanhamento dos funcionários lotados na sua unidade.',
    icone: Building2,
  },
};

export default function LoginForm() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoAcesso>('central');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const modo = MODOS[tipo];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const msg = await entrar();
    if (msg) {
      setErro(msg);
      setEnviando(false);
    } else {
      router.replace('/');
      router.refresh();
    }
  }

  async function entrar(): Promise<string | null> {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error || !data.user) {
      return error?.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
    }

    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      return 'O navegador bloqueou o login nesta janela. Abra o site em uma nova aba e entre de novo.';
    }

    const { data: p, error: erroPerfil } = await supabase
      .from('perfis')
      .select('perfil, ativo')
      .eq('id', data.user.id)
      .maybeSingle();

    if (erroPerfil) {
      console.error(erroPerfil);
      return `Erro ao verificar o acesso: ${erroPerfil.message}`;
    }

    if (!p || !p.ativo) {
      await supabase.auth.signOut();
      return 'Este usuário ainda não tem acesso liberado. Peça a liberação à DAE.';
    }
    if (p.perfil !== tipo) {
      await supabase.auth.signOut();
      return p.perfil === 'unidade'
        ? 'Este é um acesso de unidade. Selecione Unidade e entre novamente.'
        : 'Este é um acesso da sede. Selecione Sede e entre novamente.';
    }
    return null;
  }

  return (
    <div className="min-h-dvh lg:h-dvh w-full grid lg:grid-cols-[minmax(0,5.5fr)_minmax(0,6.5fr)] bg-papel overflow-y-auto lg:overflow-hidden">
      {/* Painel Institucional */}
      <section className="bg-electric-cobalt text-white flex flex-col justify-between p-10 sm:p-14 lg:p-16 relative overflow-hidden h-full">
        <div className="relative z-10 flex items-center justify-between pb-4">
          <div>
            <p className="text-sm font-bold text-white tracking-tight">Fundação de Saúde Pública de São Sebastião</p>
            <p className="text-xs text-powder-blue">Diretoria de Atenção Especializada | SESAU</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-deep-cobalt px-3.5 py-1 text-[11px] font-semibold text-powder-blue shadow-xs">
            <ShieldCheck className="size-3.5" />
            Portal Seguro
          </div>
        </div>

        <div className="relative z-10 my-auto py-6 max-w-lg flex flex-col items-start text-left">
          <Image
            src="/logo-transparent.png"
            alt="SIGER DAE"
            width={556}
            height={887}
            className="h-28 sm:h-32 w-auto object-contain mb-5"
            priority
          />
          <p className="text-xs font-bold uppercase tracking-wider text-powder-blue">Gestão de Funcionários</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-white" aria-live="polite">
            {modo.rotulo}
          </p>
          <p className="mt-3.5 max-w-md text-sm leading-relaxed text-powder-blue">
            {modo.texto}
          </p>
        </div>

        <div className="relative z-10 border-t border-white/15 pt-5 text-xs text-white/70">
          <p>Lançar, autorizar e enviar ao RH em um só lugar.</p>
        </div>

        {/* Efeito sutil de luz institucional */}
        <div className="pointer-events-none absolute -right-20 -bottom-20 size-96 rounded-full bg-deep-cobalt/60 blur-3xl" />
      </section>

      {/* Formulário de Acesso */}
      <main className="flex items-center justify-center p-8 sm:p-12 lg:p-16 h-full overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-lg border border-linha my-auto">
          <div className="mb-6 flex justify-center">
            <Image
              src="/header-siger-dae.png"
              alt="Logos FSPSS e Governo Municipal"
              width={260}
              height={42}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-ink-charcoal">Entrar</h1>
          <p className="mt-1 text-sm text-slate-gray">Escolha de onde você acessa.</p>

          <form onSubmit={onSubmit} className="mt-6" noValidate>
            <label className="block text-xs font-semibold text-slate-gray mb-2">Perfil de Acesso</label>
            <div role="radiogroup" aria-label="Tipo de acesso" className="grid grid-cols-2 gap-2 rounded-2xl border border-linha bg-faint-gray p-1.5 mb-5">
              {(Object.keys(MODOS) as TipoAcesso[]).map((t) => {
                const ativo = tipo === t;
                const Icone = MODOS[t].icone;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => {
                      setTipo(t);
                      setErro(null);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all min-h-[48px] ${
                      ativo
                        ? 'bg-white text-electric-cobalt font-bold shadow-xs border border-linha'
                        : 'text-slate-gray hover:text-ink-charcoal'
                    }`}
                  >
                    <Icone className={`size-4.5 shrink-0 ${ativo ? 'text-electric-cobalt' : 'text-slate-gray'}`} />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold leading-tight">{MODOS[t].sigla}</span>
                      <span className="block text-[11px] opacity-80 truncate">{MODOS[t].subtitulo}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-gray mb-1.5" htmlFor="email">E-mail Institucional</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="seu.email@fspss.sp.gov.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-linha bg-white px-3.5 py-2.5 text-sm text-ink-charcoal outline-none transition-all focus:border-electric-cobalt focus:ring-2 focus:ring-electric-cobalt/20 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-gray mb-1.5" htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-linha bg-white px-3.5 py-2.5 text-sm text-ink-charcoal outline-none transition-all focus:border-electric-cobalt focus:ring-2 focus:ring-electric-cobalt/20 min-h-[44px]"
                />
              </div>
            </div>

            {erro && (
              <p role="alert" className="mt-4 rounded-xl bg-[#fde8e8] px-4 py-2.5 text-xs font-medium text-[#c94a4a] border border-[#c94a4a]/20">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando || !email || !senha}
              className="mt-6 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-electric-cobalt px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-deep-cobalt active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Entrar como {modo.sigla}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
