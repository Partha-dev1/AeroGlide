import type { Metadata } from 'next';
import '../styles/globals.css';
import { NavbarHeader } from '../components/layout/NavbarHeader';
import { FooterSection } from '../components/layout/FooterSection';
import { NotificationToaster } from '../components/layout/NotificationToaster';
import { AuthProvider } from '../providers/AuthProvider';

export const metadata: Metadata = {
  title: 'AeroGlide',
  description: 'Book, reschedule, cancel flights in realtime with offline resilient database syncing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen text-white bg-slate-950 font-sans selection:bg-primary-500/30 selection:text-primary-300">
        <AuthProvider>
          <NavbarHeader />
          <main className="flex-grow flex flex-col justify-start">
            {children}
          </main>
          <FooterSection />
          <NotificationToaster />
        </AuthProvider>
      </body>
    </html>
  );
}

