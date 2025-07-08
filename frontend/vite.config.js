import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite';
import path from 'path'


export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, path.resolve(__dirname, '..'));

  return {
    plugins: [react()],
    base: '/configure/',
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html')
        },
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    },
    // // Add this new section
    define: {
      'import.meta.env.VITE_HOME_BLURB': JSON.stringify(env.VITE_HOME_BLURB || ''),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.BACKEND_URL || '')
    }
  }
});


// export default defineConfig({
//   plugins: [react()],
//   base: '/configure/',
//   build: {
//     outDir: path.resolve(__dirname, 'dist'),
//     assetsDir: 'assets',
//     emptyOutDir: true,
//     rollupOptions: {
//       input: {
//         main: path.resolve(__dirname, 'index.html')
//       },
//       output: {
//         assetFileNames: 'assets/[name]-[hash][extname]'
//       }
//     }
//   }
// })