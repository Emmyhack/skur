'use client';

import dynamic from 'next/dynamic';
import { Providers } from '@/app/providers';

// Wallet detection needs a browser, so nothing in the app tree is server-rendered.
const HomeApp = dynamic(() => import('@/app/HomeApp'), {
  ssr: false,
  loading: () => <div className="shell"><div className="empty">Loading…</div></div>,
});

export default function Page() {
  return (
    <Providers>
      <HomeApp />
    </Providers>
  );
}
