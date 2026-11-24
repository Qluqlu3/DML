import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 大きなライブラリは別のファイルにして、アプリ側の更新でキャッシュが無駄にならないようにする
        codeSplitting: {
          groups: [
            {
              name: 'chakra',
              test: /node_modules[\\/](@chakra-ui|@ark-ui|@zag-js|@emotion|@pandacss|@floating-ui|@internationalized|@swc)[\\/]/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            { name: 'xyflow', test: /node_modules[\\/](@xyflow|d3-[a-z-]+|classcat)[\\/]/ },
          ],
        },
      },
    },
  },
});
