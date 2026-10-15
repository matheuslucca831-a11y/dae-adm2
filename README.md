# Gestão de Funcionários (DAE) — FSPSS

Next.js 15.4 + Supabase.

## Rodar
1. `npm install`
2. Crie `.env.local` a partir de `.env.example` (URL e chave anon do Supabase).
3. `npm run dev`

## Banco (Supabase > SQL Editor), nesta ordem
`supabase/001_estrutura.sql` até `supabase/012_unidade_acompanha.sql`.

## Edge Function
`supabase/functions/admin-usuarios/index.ts` — publicar com o nome `admin-usuarios`
e desligar "Verify JWT" nos Details da função.

## Vercel
Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
