import type { ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/state/theme';

/**
 * The providers every screen assumes, and nothing else.
 *
 * `render` is asynchronous in React Native Testing Library 14 — it returns a promise, not the
 * queries. Forgetting to await it leaves `screen` insisting nothing has been rendered.
 */
export async function renderScreen(ui: ReactElement) {
  // Tear down anything still mounted before mounting the next tree. `render` is asynchronous in
  // RNTL 14, and the automatic cleanup that runs after a test can land in the middle of the next
  // one's render — which unmounts the tree the test is about to query and leaves it empty.
  await cleanup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{ui}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}
