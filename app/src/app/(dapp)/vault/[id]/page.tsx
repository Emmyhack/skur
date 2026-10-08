'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { Providers } from '@/app/providers';
import { Boundary } from '@/components/Boundary';

const VaultApp = dynamic(() => import('@/app/VaultApp'), {
  ssr: false,
  loading: () => <div className="shell"><div className="empty">Loading…</div></div>,
});

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return (
    <Boundary>
      <Providers>
      <VaultApp vaultId={id} />
      </Providers>
    </Boundary>
  );
}
