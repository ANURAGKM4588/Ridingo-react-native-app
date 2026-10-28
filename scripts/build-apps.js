/**
 * scripts/build-apps.js
 * Generates standalone, clean production web distributions for:
 * 1. User App   -> packages/user/www/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const reactDistDir = path.join(rootDir, 'dist');

console.log('🔨 Building fresh production bundle in root...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const sourceHtmlPath = path.join(reactDistDir, 'index.html');
console.log(`📦 Using source React production bundle from: ${path.relative(rootDir, sourceHtmlPath)}`);
const originalHtml = fs.readFileSync(sourceHtmlPath, 'utf8');

const targets = [
  {
    type: 'user',
    name: 'Ridingo',
    appId: 'com.ridingo.user',
    distDirs: [
      path.join(rootDir, 'packages', 'user', 'www')
    ]
  },
  {
    type: 'driver',
    name: 'Ridingo Driver',
    appId: 'com.ridingo.driver',
    distDirs: [
      path.join(rootDir, 'packages', 'driver', 'www')
    ]
  }
];

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(source)) return;
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  const items = fs.readdirSync(source);
  for (const item of items) {
    if (item === 'user' || item === 'driver') continue; // Prevent self-referencing loops
    const srcPath = path.join(source, item);
    const destPath = path.join(target, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyFolderRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function compileStandaloneHtml(appType, appName) {
  const isUser = appType === 'user';
  const targetClass = isUser ? 'standalone-user' : 'standalone-driver';
  const oppositeClass = isUser ? 'standalone-driver' : 'standalone-user';

  let html = originalHtml;

  // Set accurate native title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${appName}</title>`);

  // Strip conflicting legacy class additions from original index.html
  html = html.replace(/document\.documentElement\.classList\.add\(isDriver\s*\?\s*['"]standalone-driver['"]\s*:\s*['"]standalone-user['"]\);?/g, `document.documentElement.classList.add('standalone-${appType}');`);
  html = html.replace(new RegExp(oppositeClass, 'g'), targetClass);

  // Inject target definition immediately after <head> so it runs BEFORE any module or theme script
  const topHeadInjection = `
  <script>
    window.RIDINGO_TARGET = '${appType}';
    try {
      document.documentElement.classList.add('standalone-app', 'standalone-${appType}');
      document.documentElement.classList.remove('standalone-${isUser ? 'driver' : 'user'}');
    } catch (_) {}
  </script>`;
  html = html.replace(/<head>/i, `<head>${topHeadInjection}`);

  // Inject dynamic native status bar configuration early in head
  const headInjection = `
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="${isUser ? '#F2F2F7' : '#0D0E12'}">
  <script>
    (function configureNativeBars(){
      function applyStatus(){
        try {
          var saved = null;
          try { saved = localStorage.getItem('ridingo_${appType}_theme'); } catch(e){}
          if (!saved) {
            try { saved = localStorage.getItem('ridingo_theme_pref'); } catch(e){}
          }
          var isDark = false;
          if (saved === 'dark') {
            isDark = true;
          } else if (saved === 'light') {
            isDark = false;
          } else {
            var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            isDark = ('${appType}' === 'driver') ? false : sysDark;
          }
          var bgColor = isDark ? '#0D0E12' : '#F2F2F7';
          var barStyle = isDark ? 'black-translucent' : 'default';

          var metaTheme = document.querySelector('meta[name="theme-color"]');
          if (metaTheme) metaTheme.content = bgColor;
          var metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
          if (metaApple) metaApple.content = barStyle;

          if (saved === 'light' || saved === 'dark') {
            document.documentElement.setAttribute('data-theme', saved);
            if (document.body) document.body.setAttribute('data-theme', saved);
          }

          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
            var SB = window.Capacitor.Plugins.StatusBar;
            SB.setStyle({ style: isDark ? 'DARK' : 'LIGHT' }).catch(function(){});
            SB.setBackgroundColor({ color: bgColor }).catch(function(){});
            SB.setOverlaysWebView({ overlay: true }).catch(function(){});
          }
        } catch(e){}
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStatus);
      } else {
        applyStatus();
      }
      setTimeout(applyStatus, 250);
      setTimeout(applyStatus, 800);
    })();
  </script>
`;
  html = html.replace('</head>', `${headInjection}\n</head>`);

  // Cleanly isolate splash logos: Driver app gets ONLY driver logos, User app gets ONLY user logos
  if (!isUser) {
    // Completely remove user app splash logos from driver app HTML
    html = html.replace(/<img[^>]*class="[^"]*splash-user[^"]*"[^>]*\/?>/gi, '');
    html = html.replace(/href="\/App icon\.png"/g, 'href="/Drivers/Drivers App icon.png"');
    html = html.replace(/href="\.\/App icon\.png"/g, 'href="./Drivers/Drivers App icon.png"');
    html = html.replace(/src="\/Ridingo White\.png"/g, 'src="/Drivers/Logo Drivers-01.png"');
    html = html.replace(/src="\/Ridingo Black\.png"/g, 'src="/Drivers/Logo Drivers-02.png"');
    html = html.replace(/src="\.\/Ridingo White\.png"/g, 'src="./Drivers/Logo Drivers-01.png"');
    html = html.replace(/src="\.\/Ridingo Black\.png"/g, 'src="./Drivers/Logo Drivers-02.png"');
  } else {
    // Completely remove driver app splash logos from user app HTML
    html = html.replace(/<img[^>]*class="[^"]*splash-driver[^"]*"[^>]*\/?>/gi, '');
  }

  // Pre-apply standalone class cleanly to html and body tags (avoiding duplicate class attributes)
  html = html.replace(/<html([^>]*)class="([^"]*)"([^>]*)>/i, `<html$1class="$2 standalone-app standalone-${appType}"$3>`);
  if (!html.includes(`standalone-${appType}`)) {
    html = html.replace(/<html([^>]*)>/i, `<html$1 class="standalone-app standalone-${appType}">`);
  }

  html = html.replace(/<body([^>]*)class="([^"]*)"([^>]*)>/i, `<body$1class="$2 standalone-${appType}"$3>`);
  if (!html.includes(`class="standalone-app standalone-${appType}"`)) {
    html = html.replace(/<body([^>]*)>/i, `<body$1 class="standalone-app standalone-${appType}">`);
  }

  return html;
}

targets.forEach(t => {
  const compiledHtml = compileStandaloneHtml(t.type, t.name);
  const manifest = {
    name: t.name,
    short_name: t.name,
    start_url: './index.html',
    display: 'standalone',
    background_color: t.type === 'user' ? '#FFFFFF' : '#0B0B0C',
    theme_color: t.type === 'user' ? '#FFC70A' : '#0B0B0C',
    orientation: 'portrait',
    icons: t.type === 'driver' ? [
      { src: './Drivers/Drivers App icon.png', sizes: '512x512', type: 'image/png' },
      { src: './Drivers/app-icon-192.png', sizes: '192x192', type: 'image/png' }
    ] : [
      { src: './app-icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: './app-icon-192.png', sizes: '192x192', type: 'image/png' }
    ]
  };

  t.distDirs.forEach(dir => {
    // Clean target dir and re-populate
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });

    // Copy reactDist files into target directory
    copyFolderRecursiveSync(reactDistDir, dir);

    fs.writeFileSync(path.join(dir, 'index.html'), compiledHtml, 'utf8');
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  });

  console.log(`✅ Compiled production assets for ${t.name} -> ${t.distDirs.map(d => path.relative(rootDir, d)).join(', ')}`);
});

// Automatically synchronize native notification icons and app icons from public/App icon.png
try {
  const psScript = path.join(rootDir, 'scripts', 'generate-notification-icons.ps1');
  if (fs.existsSync(psScript)) {
    console.log('🔔 Synchronizing native notification icons from public/App icon.png...');
    execSync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, { cwd: rootDir, stdio: 'inherit' });
  }
} catch (e) {
  console.warn('Note: Could not run generate-notification-icons.ps1:', e.message);
}

