import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Les deux seuls modules d'Expo qu'atteignent le domaine et les use
      // cases. En les substituant, on peut exécuter l'orchestration ET la
      // persistence en Node, sans émulateur ni changement de code.
      'expo-sqlite': new URL('./test/fake-expo-sqlite.ts', import.meta.url).pathname,
      'expo-crypto': new URL('./test/fake-expo-crypto.ts', import.meta.url).pathname,
    },
  },
});
