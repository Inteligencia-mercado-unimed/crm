import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { MainLayout } from '@/components/MainLayout';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Gerador de Propostas Unimed Centro Rondônia',
  description: 'Gerador de propostas comerciais para planos de saúde Unimed Centro Rondônia.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="antialiased font-sans">
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
