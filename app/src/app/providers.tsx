'use client';

import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { dAppKit } from '@/dapp-kit';

/**
 * Client-only. Wallet detection needs a browser, so every page that renders this is loaded with
 * `ssr: false`.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A vault is a shared object: a write by anyone changes it, so reads stay fresh for
            // only a few seconds. `refetchOnWindowFocus` is off because it made the old build
            // look like it was constantly reloading.
            staleTime: 5_000,
            refetchInterval: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
    </QueryClientProvider>
  );
}
