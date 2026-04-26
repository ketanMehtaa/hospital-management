import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import AppHeader from './components/AppHeader';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Hospital Management',
  description: 'Patient, medicine, and billing management dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 text-zinc-950 overflow-y-scroll">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-6 sm:px-6 lg:px-8">
          <AppHeader />
          <div className="mt-6 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
