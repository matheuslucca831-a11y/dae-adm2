import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'SIGER DAE | Sistema Integrado de Gestão e Relatórios',
  description: 'Sistema Integrado de Gestão e Relatórios da Atenção Especializada | FSPSS e Secretaria de Saúde de São Sebastião',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'SIGER DAE | Gestão da Atenção Especializada',
    description: 'Sistema Integrado de Gestão e Relatórios da Atenção Especializada | Fundação de Saúde Pública de São Sebastião',
    images: [{ url: '/og-image.png', width: 512, height: 512, alt: 'SIGER DAE' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
