'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Perfil } from '@/lib/types';

type Contexto = {
  perfil: Perfil;
  recarregar: () => Promise<void>;
};

const PerfilContext = createContext<Contexto | null>(null);

export function usePerfil(): Contexto {
  const ctx = useContext(PerfilContext);
  if (!ctx) {
    throw new Error('usePerfil deve ser utilizado dentro de um ProvedorPerfil');
  }
  return ctx;
}

export function ProvedorPerfil({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  async function carregar() {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome, email, perfil, unidade_id, is_diretora, ativo, unidade:unidades(nome, sigla)')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !data || !data.ativo) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      setPerfil(data as unknown as Perfil);
    } catch {
      router.replace('/login');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen bg-papel flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="SIGER DAE"
            width={80}
            height={90}
            className="h-16 w-auto object-contain"
            priority
          />
          <div className="flex items-center gap-2 text-xs font-semibold text-electric-cobalt">
            <Loader2 className="size-4 animate-spin" />
            <span>Carregando ambiente seguro...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!perfil) return null;

  return (
    <PerfilContext.Provider value={{ perfil, recarregar: carregar }}>
      {children}
    </PerfilContext.Provider>
  );
}
