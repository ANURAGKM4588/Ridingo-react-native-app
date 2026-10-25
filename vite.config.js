import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * virtualHtmlPlugin
 * Dynamically provides virtual HTML for Vite dev server and generates dist/index.html
 * on build, allowing the physical root index.html file to be completely removed!
 */
function virtualHtmlPlugin() {
  const virtualHtmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FFFFFF" />
    <title>Ridingo - On-demand Driver Service</title>
    <link rel="icon" type="image/png" href="./app_icon.png" />
    <link rel="apple-touch-icon" href="./app_icon.png" />
  </head>
  <body class="standalone-app">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;

  return {
    name: 'virtual-html-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url === '/' || url === '/index.html') {
          res.setHeader('Content-Type', 'text/html');
          try {
            const html = await server.transformIndexHtml(req.url, virtualHtmlContent);
            res.statusCode = 200;
            return res.end(html);
          } catch (e) {
            return next(e);
          }
        }
        next();
      });
    },
    generateBundle(options, bundle) {
      let jsFile = '';
      let cssFile = '';
      for (const fileName in bundle) {
        if (fileName.endsWith('.js') && (fileName.includes('main') || fileName.includes('index'))) {
          jsFile = './' + fileName;
        }
        if (fileName.endsWith('.css') && (fileName.includes('main') || fileName.includes('index'))) {
          cssFile = './' + fileName;
        }
      }
      const finalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#FFFFFF" />
    <title>Ridingo - On-demand Driver Service</title>
    <link rel="icon" type="image/png" href="./app_icon.png" />
    <link rel="apple-touch-icon" href="./app_icon.png" />
    ${jsFile ? `<script type="module" crossorigin src="${jsFile}"></script>` : ''}
    ${cssFile ? `<link rel="stylesheet" crossorigin href="${cssFile}">` : ''}
  </head>
  <body class="standalone-app">
    <div id="root"></div>
  </body>
</html>`;
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: finalHtml
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), virtualHtmlPlugin()],
  define: {
    global: 'globalThis'
  },
  assetsInclude: ['**/*.json', '**/*.png', '**/*.svg'],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.jsx')
    }
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets')
    }
  }
});
