import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Skur — a programmable authorization layer for Sui treasuries',
    template: '%s · Skur',
  },
  description:
    'Skur decides how much authorization a payment needs, and whether it may settle right now, from the amount, the destination, the recent outflow and the vault’s own security posture. Enforced in Move.',
};

/**
 * The root layout carries no stylesheet. The marketing pages and the vault interface are two
 * different design languages, each loaded only on its own routes, so neither has to fight the
 * other's base rules.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
