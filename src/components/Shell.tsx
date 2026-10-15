'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link, { useLinkStatus } from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Building2, CheckCircle2, HardDrive, Loader2, LogOut, Menu, Search, WifiOff, X } from 'lucide-react';
import { definirDonoCache, limparCacheTelas } from '@/lib/cacheTela';
import { createClient } from '@/lib/supabase/client';
import { ROTAS } from '@/lib/rotas';
import type { Perfil } from '@/lib/types';

export default function Shell({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [online, setOnline] = useState(true);
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [pendentes, setPendentes] = useState({ cadastro: 0, horario: 0 });
  const areaAvisos = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const central = perfil.perfil === 'central';
  const itens = ROTAS.filter((r) => (central ? !r.somenteUnidade : !r.somenteCentral));
  const local = central ? 'Sede DAE' : perfil.unidade?.nome ?? 'Unidade';
  const siglaPerfil = central ? 'Gestão Central DAE' : 'Gestão Unidade';

  definirDonoCache(perfil.id);

  // Situação da conexão (selo "Base Sincronizada")
  useEffect(() => {
    setOnline(navigator.onLine);
    const ligar = () => setOnline(true);
    const desligar = () => setOnline(false);
    window.addEventListener('online', ligar);
    window.addEventListener('offline', desligar);
    return () => {
      window.removeEventListener('online', ligar);
      window.removeEventListener('offline', desligar);
    };
  }, []);

  // Sino: sugestões das unidades que aguardam análise da Sede
  useEffect(() => {
    if (!central) return;
    let vivo = true;
    async function contar() {
      const [c, h] = await Promise.all([
        supabase.from('sugestoes_cadastro').select('id', { count: 'exact', head: true }).eq('situacao', 'Pendente'),
        supabase.from('sugestoes_horario').select('id', { count: 'exact', head: true }).eq('situacao', 'Pendente'),
      ]);
      if (vivo) setPendentes({ cadastro: c.count ?? 0, horario: h.count ?? 0 });
    }
    contar();
    const t = setInterval(contar, 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [central, supabase, pathname]);

  // Fecha o painel do sino ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!avisosAbertos) return;
    const fora = (e: MouseEvent) => {
      if (areaAvisos.current && !areaAvisos.current.contains(e.target as Node)) setAvisosAbertos(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAvisosAbertos(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [avisosAbertos]);

  // Busca da barra superior: abre a lista de funcionários já filtrada
  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = buscaGlobal.trim();
    const destino = central ? '/funcionarios' : '/equipe';
    router.push(q ? `${destino}?q=${encodeURIComponent(q)}` : destino);
  }

  const totalPendentes = pendentes.cadastro + pendentes.horario;

  async function sair() {
    limparCacheTelas();
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const iniciaisPerfil = (() => {
    const p = perfil.nome.trim().split(/\s+/).filter(Boolean);
    if (p.length === 0) return 'US';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase();
  })();

  // Rotas primárias para a barra inferior mobile (Thumb Zone)
  const itensMobileBase = itens.slice(0, 4);

  return (
    <div data-perfil={perfil.perfil} className="min-h-dvh bg-papel lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Barra superior no mobile */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-electric-cobalt px-4 text-white shadow-md lg:hidden">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-transparent.png"
            alt="SIGER DAE"
            width={38}
            height={60}
            className="h-10 w-auto object-contain"
            priority
          />
          <div>
            <span className="block text-sm font-extrabold tracking-tight text-white">SIGER DAE</span>
            <span className="block text-[11px] font-medium text-powder-blue">{local}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="menu-lateral"
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
        >
          {aberto ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </header>

      {/* Backdrop overlay para mobile */}
      {aberto && (
        <div
          role="presentation"
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-40 bg-ink-charcoal/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Menu lateral (Desktop fixo e Mobile slide-over com padrão SIGER APS) */}
      <aside
        id="menu-lateral"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-electric-cobalt text-white transition-transform duration-200 ease-in-out lg:static lg:w-auto lg:translate-x-0 ${
          aberto ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none'
        } lg:sticky lg:top-0 lg:h-dvh border-r border-white/15`}
      >
        {/* Cabeçalho institucional do Menu Lateral */}
        <div className="border-b border-white/10 p-5 flex items-center justify-between lg:justify-center">
          <Link href="/" className="flex items-center justify-center" onClick={() => setAberto(false)}>
            <Image
              src="/logo-transparent.png"
              alt="SIGER DAE"
              width={160}
              height={220}
              className="h-22 w-auto object-contain drop-shadow-sm"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 lg:hidden self-start"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Lista de navegação com estilo de pílula ativa do SIGER APS */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4" aria-label="Menu principal">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-powder-blue/70">Módulos</p>
          <ul className="space-y-1.5">
            {itens.map(({ path, titulo, icone: Icone }) => {
              const ativo = pathname === path || pathname.startsWith(path + '/');
              return (
                <li key={path}>
                  <Link
                    href={path}
                    onClick={() => setAberto(false)}
                    aria-current={ativo ? 'page' : undefined}
                    className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all ${
                      ativo
                        ? 'bg-white text-electric-cobalt font-bold shadow-md'
                        : 'text-white/85 hover:bg-white/10 hover:text-white font-medium'
                    }`}
                  >
                    <Icone className={`size-4.5 shrink-0 ${ativo ? 'text-electric-cobalt' : 'text-powder-blue'}`} aria-hidden />
                    <span className="flex-1 truncate">{titulo}</span>
                    <IndicadorClique ativo={ativo} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Rodapé institucional com Pílulas e Perfil (Padrão SIGER APS) */}
        <div className="border-t border-white/15 bg-electric-cobalt p-3.5 space-y-2">
          {/* Pílula 1: Salvo no Aparelho */}
          <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-1.5 text-xs text-white/90 border border-white/10 shadow-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="size-3.5 text-powder-blue" />
              <span className="text-[11px] font-medium text-white/90">Salvo no Aparelho</span>
            </div>
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-powder-blue">
              0 local
            </span>
          </div>

          {/* Pílula 2: Gestão Central DAE ou Unidade */}
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white border border-white/10 shadow-xs">
            <Building2 className="size-3.5 text-powder-blue shrink-0" />
            <span className="truncate text-[11px] font-bold">{siglaPerfil}</span>
          </div>

          {/* Usuário logado */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-electric-cobalt shadow-xs">
              {iniciaisPerfil}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{perfil.nome}</p>
              <p className="truncate text-[11px] text-powder-blue">
                {perfil.is_diretora ? 'Diretora Executiva' : `Matrícula: ${perfil.id.slice(0, 6)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={sair}
              aria-label="Sair do sistema"
              title="Sair do sistema"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-powder-blue hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex flex-col min-w-0">
        {/* Barra superior Desktop institucional com padrão SIGER APS */}
        <header className="hidden lg:flex h-16 items-center justify-between bg-electric-cobalt px-8 text-white shadow-md sticky top-0 z-20 border-b border-white/15">
          {/* Campo de Busca Global */}
          <form
            role="search"
            onSubmit={buscar}
            className="flex items-center gap-2.5 bg-white/15 border border-white/20 rounded-full px-4 py-2 w-80 lg:w-96 text-xs backdrop-blur-xs focus-within:bg-white/25 focus-within:border-white transition-all"
          >
            <button type="submit" aria-label="Buscar" className="shrink-0 text-white/80 hover:text-white">
              <Search className="size-4" />
            </button>
            <input
              type="search"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
              placeholder={central ? 'Buscar funcionário por nome, matrícula ou CPF...' : 'Buscar funcionário da unidade...'}
              aria-label="Buscar funcionário"
              className="bg-transparent outline-none text-white placeholder-white/70 text-xs w-full"
            />
          </form>

          {/* Ações e Brasões Oficiais no canto direito */}
          <div className="flex items-center gap-3.5">
            {/* Status de conexão */}
            {online ? (
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white shadow-xs">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>Conectado</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-erro/90 border border-white/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white shadow-xs">
                <WifiOff className="size-3.5" />
                <span>Sem conexão</span>
              </div>
            )}

            {/* Notificações */}
            <div className="relative" ref={areaAvisos}>
              <button
                type="button"
                title="Notificações"
                aria-label={totalPendentes > 0 ? `Notificações: ${totalPendentes} pendentes` : 'Notificações'}
                aria-expanded={avisosAbertos}
                onClick={() => setAvisosAbertos((v) => !v)}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors shadow-xs"
              >
                <Bell className="size-4" />
              </button>
              {totalPendentes > 0 && (
                <span className="pointer-events-none absolute -top-1 -right-1 flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-erro text-[10px] font-bold text-white shadow-xs">
                  {totalPendentes}
                </span>
              )}
              {avisosAbertos && (
                <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-linha bg-white p-2 text-ink-charcoal shadow-xl">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-gray">Notificações</p>
                  {totalPendentes === 0 ? (
                    <p className="px-3 pb-3 pt-1 text-xs text-slate-gray">Nenhuma novidade no momento.</p>
                  ) : (
                    <ul>
                      {pendentes.cadastro > 0 && (
                        <li>
                          <Link href="/funcionarios?aba=sugestoes" onClick={() => setAvisosAbertos(false)} className="block rounded-xl px-3 py-2 text-xs hover:bg-faint-gray">
                            <strong>{pendentes.cadastro}</strong> {pendentes.cadastro === 1 ? 'sugestão de cadastro aguarda' : 'sugestões de cadastro aguardam'} análise
                          </Link>
                        </li>
                      )}
                      {pendentes.horario > 0 && (
                        <li>
                          <Link href="/funcionarios?aba=sugestoes" onClick={() => setAvisosAbertos(false)} className="block rounded-xl px-3 py-2 text-xs hover:bg-faint-gray">
                            <strong>{pendentes.horario}</strong> {pendentes.horario === 1 ? 'mudança de horário aguarda' : 'mudanças de horário aguardam'} análise
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Header de Brasões Oficiais SESAU / FSPSS / São Sebastião */}
            <div className="bg-white px-3 py-1.5 rounded-xl border border-white/25 shadow-xs flex items-center ml-1">
              <Image
                src="/header-siger-dae.png"
                alt="Brasões Oficiais FSPSS SESAU São Sebastião"
                width={200}
                height={32}
                className="h-6 w-auto object-contain"
                priority
              />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 pb-20 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">{children}</main>

        {/* Barra de navegação inferior Mobile (Thumb Zone) */}
        <nav
          aria-label="Navegação rápida móvel"
          className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center justify-around border-t border-linha bg-white/95 px-2 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden shadow-lg"
        >
          {itensMobileBase.map(({ path, titulo, icone: Icone }) => {
            const ativo = pathname === path || pathname.startsWith(path + '/');
            return (
              <Link
                key={path}
                href={path}
                aria-current={ativo ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  ativo ? 'text-electric-cobalt font-semibold' : 'text-slate-gray hover:text-ink-charcoal'
                }`}
              >
                <Icone className="size-5" />
                <span className="truncate max-w-[4.5rem]">{titulo}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-gray hover:text-ink-charcoal"
          >
            <Menu className="size-5" />
            <span>Mais</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

/** Rodinha no item do menu clicado enquanto a tela abre */
function IndicadorClique({ ativo }: { ativo: boolean }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2
      className={`size-3.5 shrink-0 animate-spin ${ativo ? 'text-electric-cobalt' : 'text-white'}`}
      aria-label="Abrindo"
    />
  ) : null;
}
