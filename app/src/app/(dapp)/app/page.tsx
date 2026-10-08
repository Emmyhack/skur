'use client';

import dynamic from 'next/dynamic';
import { Providers } from '@/app/providers';
import { Boundary } from '@/components/Boundary';

// Wallet detection needs a browser, so nothing in the app tree is server-rendered.
const HomeApp = dynamic(() => import('@/app/HomeApp'), {
  ssr: false,
  loading: () => <div className="shell"><div className="empty">Loading…</div></div>,
});

export default function Page() {
  return (
    <Boundary>
      <Providers>
      <HomeApp />
      </Providers>
    </Boundary>
  );
}
