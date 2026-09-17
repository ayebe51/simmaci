import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const now = new Date();
const timestamp = now.toISOString();
const buildId = `${now.toISOString().replace(/[-:T.]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 8)}`;

const pkgPath = path.join(rootDir, 'package.json');
let version = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (pkg.version) version = pkg.version;
} catch {
  // fallback
}

const versionData = {
  version,
  buildId,
  timestamp,
  environment: process.env.NODE_ENV || 'production'
};

// Write to public folder (so Vite dev and build include it)
const publicDir = path.join(rootDir, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
const publicPath = path.join(publicDir, 'version.json');
fs.writeFileSync(publicPath, JSON.stringify(versionData, null, 2));

// Write to dist if dist exists (for build step completion)
const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionData, null, 2));
}

console.log(`[SIMMACI Build] Generated version.json: ${buildId} (${timestamp})`);
