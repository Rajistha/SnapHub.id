import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function nonBlockingCss() {
  return {
    name: 'non-blocking-css',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="([^"]+)">/g,
        '<link rel="stylesheet" crossorigin href="$1" media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" crossorigin href="$1"></noscript>'
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nonBlockingCss(),
  ],
})
