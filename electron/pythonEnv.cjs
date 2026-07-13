// Manages an isolated Python environment for background removal, provisioned on
// first run. Uses `uv` (a single static binary) to download a standalone CPython
// and install transparent-background + torch into the app's data folder - nothing
// touches the user's system Python.
//
// If an NVIDIA GPU is detected, the CUDA build of torch is installed so InSPyReNet
// runs on the GPU; otherwise the CPU build is used. Set SPRITE_STUDIO_FORCE_CPU=1
// to force CPU.

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const extract = require('extract-zip');

const IS_WIN = process.platform === 'win32';
const CUDA_INDEX = 'https://download.pytorch.org/whl/cu124';
const PYPI_INDEX = 'https://pypi.org/simple';

const runtimeDir = () => path.join(app.getPath('userData'), 'runtime');
const uvExe = () => path.join(runtimeDir(), IS_WIN ? 'uv.exe' : 'uv');
const venvDir = () => path.join(runtimeDir(), 'pyenv');
const venvPython = () => path.join(venvDir(), IS_WIN ? path.join('Scripts', 'python.exe') : path.join('bin', 'python'));
const readyMarker = () => path.join(runtimeDir(), '.ready');

let _gpu = null;
function hasGpu() {
  if (_gpu === null) {
    try {
      const r = spawnSync('nvidia-smi', ['-L'], { windowsHide: true });
      _gpu = r.status === 0;
    } catch {
      _gpu = false;
    }
  }
  return _gpu;
}

// The torch flavor we want on this machine.
function desiredFlavor() {
  if (process.env.SPRITE_STUDIO_FORCE_CPU === '1') return 'cpu';
  return hasGpu() ? 'gpu' : 'cpu';
}

function installedFlavor() {
  try {
    return fs.readFileSync(readyMarker(), 'utf8').trim();
  } catch {
    return null;
  }
}

function isReady() {
  return fs.existsSync(venvPython()) && installedFlavor() === desiredFlavor();
}

function ready() {
  return Boolean(process.env.SPRITE_STUDIO_PYTHON) || isReady();
}

function download(url, dest, onLog) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'VoxtaSpriteStudio' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let got = 0;
        let lastPct = -1;
        res.on('data', (c) => {
          got += c.length;
          if (total) {
            const p = Math.floor((got / total) * 100);
            if (p !== lastPct && p % 20 === 0) { lastPct = p; onLog(`  downloading uv... ${p}%`); }
          }
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }).on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
    };
    get(url);
  });
}

function run(cmd, args, onLog) {
  return new Promise((resolve, reject) => {
    onLog(`> ${path.basename(cmd)} ${args.join(' ')}`);
    const env = {
      ...process.env,
      UV_CACHE_DIR: path.join(runtimeDir(), 'uv-cache'),
      UV_PYTHON_INSTALL_DIR: path.join(runtimeDir(), 'python'),
    };
    const p = spawn(cmd, args, { windowsHide: true, env });
    p.stdout.on('data', (d) => onLog(d.toString().trimEnd()));
    p.stderr.on('data', (d) => onLog(d.toString().trimEnd()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with code ${code}`))));
  });
}

async function ensureUv(onLog) {
  if (fs.existsSync(uvExe())) return;
  fs.mkdirSync(runtimeDir(), { recursive: true });
  onLog('Downloading uv (Python manager)...');
  const asset = IS_WIN ? 'uv-x86_64-pc-windows-msvc.zip' : 'uv-x86_64-unknown-linux-gnu.tar.gz';
  const url = `https://github.com/astral-sh/uv/releases/latest/download/${asset}`;
  const archive = path.join(runtimeDir(), asset);
  await download(url, archive, onLog);
  if (IS_WIN) {
    await extract(archive, { dir: runtimeDir() });
  } else {
    await run('tar', ['-xzf', archive, '-C', runtimeDir(), '--strip-components=1'], onLog);
  }
  fs.unlinkSync(archive);
  if (!fs.existsSync(uvExe())) throw new Error('uv binary not found after extraction');
}

let setupPromise = null;

// Ensures the Python env exists with the right torch flavor, provisioning on
// first call (or re-installing torch if the GPU/CPU choice changed). Returns the
// path to the env's python executable. Safe to call concurrently.
async function ensureReady(onLog) {
  const override = process.env.SPRITE_STUDIO_PYTHON;
  if (override) return override;
  if (isReady()) return venvPython();
  if (setupPromise) return setupPromise;

  const flavor = desiredFlavor();
  setupPromise = (async () => {
    onLog('Setting up the background remover (first run only, a few minutes)...');
    await ensureUv(onLog);

    if (!fs.existsSync(venvPython())) {
      onLog('Creating an isolated Python environment...');
      await run(uvExe(), ['venv', venvDir(), '--python', '3.12', '--python-preference', 'only-managed'], onLog);
    }

    if (flavor === 'gpu') {
      onLog('NVIDIA GPU detected - installing transparent-background with the CUDA build of torch (larger download)...');
      await run(uvExe(), [
        'pip', 'install', '--python', venvPython(),
        'transparent-background', 'torch', 'torchvision',
        '--index-url', CUDA_INDEX,
        '--extra-index-url', PYPI_INDEX,
      ], onLog);
    } else {
      onLog('Installing transparent-background + torch (CPU build)...');
      await run(uvExe(), ['pip', 'install', '--python', venvPython(), 'transparent-background'], onLog);
    }

    fs.writeFileSync(readyMarker(), flavor);
    onLog(`Background remover ready (${flavor.toUpperCase()}).`);
    return venvPython();
  })();

  try {
    return await setupPromise;
  } finally {
    setupPromise = null;
  }
}

module.exports = { ready, ensureReady, hasGpu };
