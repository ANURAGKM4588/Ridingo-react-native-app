/**
 * scripts/generate-android-icons.js
 * 
 * Pixel-perfect Android Adaptive Icon generator for Ridingo (User) & Ridingo Driver.
 * Strictly adheres to Android Adaptive Icon Safe-Zone Specifications:
 * - Canvas size: 108dp x 108dp (mdpi: 108px, hdpi: 162px, xhdpi: 216px, xxhdpi: 324px, xxxhdpi: 432px)
 * - Visible mask: Inner 72dp (66.6% of canvas)
 * - Safe zone: Inner 66dp (61.1% of canvas)
 * - Brand yellow: #FBD605 (R: 251, G: 214, B: 5)
 * - Eliminates excessive zoom / edge clipping on Android launchers.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BG_COLOR = { r: 251, g: 214, b: 5, alpha: 1 }; // #FBD605

const DENSITIES = [
  { folder: 'mipmap-mdpi', fgSize: 108, legacySize: 48, notifSize: 24, notifFolder: 'drawable-mdpi' },
  { folder: 'mipmap-hdpi', fgSize: 162, legacySize: 72, notifSize: 36, notifFolder: 'drawable-hdpi' },
  { folder: 'mipmap-xhdpi', fgSize: 216, legacySize: 96, notifSize: 48, notifFolder: 'drawable-xhdpi' },
  { folder: 'mipmap-xxhdpi', fgSize: 324, legacySize: 144, notifSize: 72, notifFolder: 'drawable-xxhdpi' },
  { folder: 'mipmap-xxxhdpi', fgSize: 432, legacySize: 192, notifSize: 96, notifFolder: 'drawable-xxxhdpi' }
];

const APPS = [
  {
    name: 'User App (Ridingo)',
    srcFile: path.join(rootDir, 'public', 'App icon.png'),
    resDir: path.join(rootDir, 'packages', 'user', 'android', 'app', 'src', 'main', 'res'),
    iosDir: path.join(rootDir, 'packages', 'user', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset'),
    webIcons: [
      { file: path.join(rootDir, 'public', 'app-icon-128.png'), size: 128 },
      { file: path.join(rootDir, 'public', 'app-icon-192.png'), size: 192 },
      { file: path.join(rootDir, 'public', 'app-icon-512.png'), size: 512 }
    ],
    // Ratio of logo height to adaptive canvas (165px out of 432px = ~38.2% canvas / 57.3% circle)
    fgRatio: 165 / 432,
    legacyRatio: 165 / 288
  },
  {
    name: 'Driver App (Ridingo Driver)',
    srcFile: path.join(rootDir, 'public', 'Drivers', 'Drivers App icon.png'),
    resDir: path.join(rootDir, 'packages', 'driver', 'android', 'app', 'src', 'main', 'res'),
    iosDir: path.join(rootDir, 'packages', 'driver', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset'),
    webIcons: [
      { file: path.join(rootDir, 'public', 'Drivers', 'app-icon-128.png'), size: 128 },
      { file: path.join(rootDir, 'public', 'Drivers', 'app-icon-192.png'), size: 192 },
      { file: path.join(rootDir, 'public', 'Drivers', 'app-icon-512.png'), size: 512 }
    ],
    // Ratio of logo height to adaptive canvas (180px out of 432px = ~41.7% canvas / 62.5% circle)
    fgRatio: 180 / 432,
    legacyRatio: 180 / 288
  }
];

/**
 * Extracts a high-res transparent PNG of only the black logo marks
 */
async function extractTransparentLogo(srcPath) {
  const img = sharp(srcPath);
  const { width, height } = await img.metadata();
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });

  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      // Dark logo mark
      if (a > 128 && r < 60 && g < 60 && b < 60) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Extract cropped region
  const cropBuffer = await img.extract({ left: minX, top: minY, width: cropW, height: cropH }).raw().toBuffer();

  // Create clean transparent black image
  const transparentBuffer = Buffer.alloc(cropW * cropH * 4);
  const whiteSilhouetteBuffer = Buffer.alloc(cropW * cropH * 4);

  for (let i = 0; i < cropW * cropH; i++) {
    const r = cropBuffer[i * 4];
    const g = cropBuffer[i * 4 + 1];
    const b = cropBuffer[i * 4 + 2];
    const a = cropBuffer[i * 4 + 3];

    // Dark logo pixel -> crisp black
    if (a > 100 && r < 75 && g < 75 && b < 75) {
      transparentBuffer[i * 4] = 0;
      transparentBuffer[i * 4 + 1] = 0;
      transparentBuffer[i * 4 + 2] = 0;
      transparentBuffer[i * 4 + 3] = 255;

      whiteSilhouetteBuffer[i * 4] = 255;
      whiteSilhouetteBuffer[i * 4 + 1] = 255;
      whiteSilhouetteBuffer[i * 4 + 2] = 255;
      whiteSilhouetteBuffer[i * 4 + 3] = 255;
    } else {
      transparentBuffer[i * 4] = 0;
      transparentBuffer[i * 4 + 1] = 0;
      transparentBuffer[i * 4 + 2] = 0;
      transparentBuffer[i * 4 + 3] = 0;

      whiteSilhouetteBuffer[i * 4] = 255;
      whiteSilhouetteBuffer[i * 4 + 1] = 255;
      whiteSilhouetteBuffer[i * 4 + 2] = 255;
      whiteSilhouetteBuffer[i * 4 + 3] = 0;
    }
  }

  const logoSharp = sharp(transparentBuffer, { raw: { width: cropW, height: cropH, channels: 4 } });
  const whiteSharp = sharp(whiteSilhouetteBuffer, { raw: { width: cropW, height: cropH, channels: 4 } });

  return { logoSharp, whiteSharp, cropW, cropH };
}

async function generateAppIcons(app) {
  console.log(`\n======================================================`);
  console.log(`🎨 Processing ${app.name}...`);
  console.log(`======================================================`);

  if (!fs.existsSync(app.srcFile)) {
    console.error(`Source file not found: ${app.srcFile}`);
    return;
  }

  const { logoSharp, whiteSharp, cropW, cropH } = await extractTransparentLogo(app.srcFile);
  console.log(`   Extracted logo bounds: ${cropW}x${cropH} px`);

  // Ensure background color is #FBD605 in colors/values
  const bgXmlPath = path.join(app.resDir, 'values', 'ic_launcher_background.xml');
  if (fs.existsSync(path.dirname(bgXmlPath))) {
    fs.writeFileSync(bgXmlPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FBD605</color>\n</resources>\n`, 'utf8');
    console.log(`   Updated ic_launcher_background.xml -> #FBD605`);
  }

  // 1. Android Mipmap Densities
  for (const d of DENSITIES) {
    const targetFolder = path.join(app.resDir, d.folder);
    fs.mkdirSync(targetFolder, { recursive: true });

    // A) Adaptive Foreground (108dp canvas: 108, 162, 216, 324, 432 px)
    const fgLogoH = Math.round(d.fgSize * app.fgRatio);
    const fgLogo = await logoSharp.clone().resize({ height: fgLogoH }).png().toBuffer();
    const fgMeta = await sharp(fgLogo).metadata();

    const fgCanvas = await sharp({
      create: { width: d.fgSize, height: d.fgSize, channels: 4, background: BG_COLOR }
    }).composite([{
      input: fgLogo,
      top: Math.round((d.fgSize - fgMeta.height) / 2),
      left: Math.round((d.fgSize - fgMeta.width) / 2)
    }]).png().toBuffer();

    const fgPath = path.join(targetFolder, 'ic_launcher_foreground.png');
    fs.writeFileSync(fgPath, fgCanvas);

    // B) Legacy Round Launcher Icon (48, 72, 96, 144, 192 px)
    const roundLogoH = Math.round(d.legacySize * app.legacyRatio);
    const roundLogo = await logoSharp.clone().resize({ height: roundLogoH }).png().toBuffer();
    const roundMeta = await sharp(roundLogo).metadata();

    // Create yellow circular disk
    const circleSvg = `<svg width="${d.legacySize}" height="${d.legacySize}">
      <circle cx="${d.legacySize / 2}" cy="${d.legacySize / 2}" r="${d.legacySize / 2}" fill="#FBD605" />
    </svg>`;
    const circleBg = await sharp(Buffer.from(circleSvg)).png().toBuffer();

    const roundCanvas = await sharp(circleBg).composite([{
      input: roundLogo,
      top: Math.round((d.legacySize - roundMeta.height) / 2),
      left: Math.round((d.legacySize - roundMeta.width) / 2)
    }]).png().toBuffer();

    const roundPath = path.join(targetFolder, 'ic_launcher_round.png');
    fs.writeFileSync(roundPath, roundCanvas);

    // C) Legacy Square Launcher Icon (48, 72, 96, 144, 192 px)
    const cornerR = Math.round(d.legacySize * 0.20);
    const squircleSvg = `<svg width="${d.legacySize}" height="${d.legacySize}">
      <rect x="0" y="0" width="${d.legacySize}" height="${d.legacySize}" rx="${cornerR}" ry="${cornerR}" fill="#FBD605" />
    </svg>`;
    const squircleBg = await sharp(Buffer.from(squircleSvg)).png().toBuffer();

    const squareCanvas = await sharp(squircleBg).composite([{
      input: roundLogo,
      top: Math.round((d.legacySize - roundMeta.height) / 2),
      left: Math.round((d.legacySize - roundMeta.width) / 2)
    }]).png().toBuffer();

    const squarePath = path.join(targetFolder, 'ic_launcher.png');
    fs.writeFileSync(squarePath, squareCanvas);

    // D) Android Notification Small Icon (Monochrome Silhouette in drawable-*)
    const notifFolder = path.join(app.resDir, d.notifFolder);
    fs.mkdirSync(notifFolder, { recursive: true });

    const notifLogoH = Math.round(d.notifSize * 0.75);
    const notifLogo = await whiteSharp.clone().resize({ height: notifLogoH }).png().toBuffer();
    const notifMeta = await sharp(notifLogo).metadata();

    const notifCanvas = await sharp({
      create: { width: d.notifSize, height: d.notifSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite([{
      input: notifLogo,
      top: Math.round((d.notifSize - notifMeta.height) / 2),
      left: Math.round((d.notifSize - notifMeta.width) / 2)
    }]).png().toBuffer();

    fs.writeFileSync(path.join(notifFolder, 'ic_stat_ridingo.png'), notifCanvas);
    fs.writeFileSync(path.join(notifFolder, 'ic_stat_icon_config_sample.png'), notifCanvas);

    console.log(`   ✓ ${d.folder}: Foreground (${d.fgSize}x${d.fgSize}), Round (${d.legacySize}x${d.legacySize}), Square (${d.legacySize}x${d.legacySize})`);
  }

  // Large Notification Icon in drawable/
  const baseDrawable = path.join(app.resDir, 'drawable');
  fs.mkdirSync(baseDrawable, { recursive: true });
  const appIcon192 = await sharp(path.join(app.resDir, 'mipmap-xxxhdpi', 'ic_launcher_round.png')).toBuffer();
  fs.writeFileSync(path.join(baseDrawable, 'app_icon.png'), appIcon192);

  const notif96 = await sharp(path.join(app.resDir, 'drawable-xxxhdpi', 'ic_stat_ridingo.png')).toBuffer();
  fs.writeFileSync(path.join(baseDrawable, 'ic_notification.png'), notif96);
  fs.writeFileSync(path.join(baseDrawable, 'ic_stat_ridingo.png'), notif96);
  fs.writeFileSync(path.join(baseDrawable, 'ic_stat_icon_config_sample.png'), notif96);

  // 2. iOS AppIcon (Keep exactly as user confirmed: "ios app is perfecct")
  if (fs.existsSync(app.iosDir)) {
    const iosDest = path.join(app.iosDir, 'AppIcon-512@2x.png');
    await sharp(app.srcFile).resize(1024, 1024).png().toFile(iosDest);
    console.log(`   ✓ iOS AppIcon maintained at 1024x1024`);
  }

  // 3. Web PWA Icons
  for (const w of app.webIcons) {
    if (fs.existsSync(path.dirname(w.file))) {
      await sharp(path.join(app.resDir, 'mipmap-xxxhdpi', 'ic_launcher_round.png'))
        .resize(w.size, w.size)
        .png()
        .toFile(w.file);
      console.log(`   ✓ Web icon: ${path.basename(w.file)} (${w.size}x${w.size})`);
    }
  }
}

async function run() {
  for (const app of APPS) {
    await generateAppIcons(app);
  }
  console.log(`\n🎉 All Android icons generated with perfect adaptive safe-zone proportions!`);
}

run().catch(console.error);
