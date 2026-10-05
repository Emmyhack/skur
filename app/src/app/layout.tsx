import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skur',
  description: 'A programmable authorization and treasury security layer for Sui organizations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
