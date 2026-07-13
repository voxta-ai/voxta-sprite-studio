const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pythonEnv = require('./pythonEnv.cjs');

// Bundled static ffmpeg (unpacked from asar in the packaged app).
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        backgroundColor: '#070a08',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, '../build/icon.png'),
    });

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- helpers -----------------------------------------------------------------

const MIME = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif',
};

function fileToDataUrl(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const buf = fs.readFileSync(filePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
}

const OUTPUT_DIR = 'sprite-studio-output';

// Builds the output path inside a "sprite-studio-output" folder next to the source.
// If the source already lives in that folder (a chained step), it stays there
// instead of nesting another folder.
function withSuffix(filePath, suffix, newExt) {
    const parent = path.dirname(filePath);
    const dir = path.basename(parent) === OUTPUT_DIR ? parent : path.join(parent, OUTPUT_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const base = path.basename(filePath, path.extname(filePath));
    return path.join(dir, base + suffix + (newExt || '.png'));
}

// --- dialogs -----------------------------------------------------------------

ipcMain.handle('dialog:pickImage', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select an image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('dialog:pickImages', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select images',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    return res.canceled ? [] : res.filePaths;
});

ipcMain.handle('dialog:pickVideos', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select videos',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    });
    return res.canceled ? [] : res.filePaths;
});

ipcMain.handle('fs:readImage', async (_e, filePath) => {
    try {
        return { ok: true, dataUrl: fileToDataUrl(filePath), path: filePath };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('shell:openFolder', async (_e, filePath) => {
    if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});

// --- Step 1: AI background removal (InSPyReNet via transparent-background) ----

ipcMain.handle('bg:isReady', async () => pythonEnv.ready());

ipcMain.handle('bg:hasGpu', async () => pythonEnv.hasGpu());

ipcMain.handle('bg:setup', async () => {
    const log = (line) => mainWindow.webContents.send('bg:log', line.endsWith('\n') ? line : line + '\n');
    try {
        await pythonEnv.ensureReady(log);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('bg:remove', async (_e, { input, mode, threshold }) => {
    const log = (line) => mainWindow.webContents.send('bg:log', line.endsWith('\n') ? line : line + '\n');

    let python;
    try {
        python = await pythonEnv.ensureReady(log);
    } catch (err) {
        return { ok: false, error: `Background remover setup failed: ${err.message}` };
    }

    const output = withSuffix(input, '_nobg', '.png');
    const script = path.join(__dirname, '..', 'python', 'remove_bg.py').replace('app.asar', 'app.asar.unpacked');
    const args = [
        script,
        '--input', input,
        '--output', output,
        '--mode', mode === 'fast' ? 'fast' : 'base',
    ];
    if (threshold && threshold > 0) args.push('--threshold', String(threshold));

    return new Promise((resolve) => {
        const proc = spawn(python, args, { windowsHide: true });
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => {
            mainWindow.webContents.send('bg:log', d.toString());
        });
        proc.on('error', (err) => {
            resolve({ ok: false, error: `Could not start Python (${PYTHON}): ${err.message}` });
        });
        proc.on('close', (code) => {
            const lastLine = stdout.trim().split('\n').pop() || '';
            let parsed = {};
            try { parsed = JSON.parse(lastLine); } catch { /* ignore */ }
            if (code === 0 && parsed.ok) {
                resolve({ ok: true, output, dataUrl: fileToDataUrl(output) });
            } else {
                resolve({ ok: false, error: parsed.error || `Python exited with code ${code}` });
            }
        });
    });
});

// --- Crop: save the cropped transparent PNG ----------------------------------

ipcMain.handle('crop:save', async (_e, { input, base64 }) => {
    try {
        const output = withSuffix(input, '_cropped', '.png');
        const data = base64.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(output, Buffer.from(data, 'base64'));
        return { ok: true, output };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

// --- Step 2: composite a solid backdrop, save the PNG ------------------------

ipcMain.handle('backdrop:save', async (_e, { input, color, base64 }) => {
    try {
        const suffix = color === 'green' ? '_greenbackground' : '_blackbackground';
        const output = withSuffix(input, suffix, '.png');
        const data = base64.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(output, Buffer.from(data, 'base64'));
        return { ok: true, output };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

// --- Step 3: video -> transparent WebM (ffmpeg) ------------------------------

const VIDEO_FORMATS = {
    // -b:v 0 -crf enables VP9 constant-quality mode; without it libvpx falls back
    // to a low default bitrate (the pixelation). -row-mt speeds it up.
    'webm': { codec: 'libvpx-vp9', pixFmt: 'yuva420p', extra: ['-b:v', '0', '-crf', '18', '-row-mt', '1', '-auto-alt-ref', '0'], ext: '.webm' },
    'webm-lossless': { codec: 'libvpx-vp9', pixFmt: 'yuva420p', extra: ['-lossless', '1', '-row-mt', '1', '-auto-alt-ref', '0'], ext: '.webm' },
    'prores': { codec: 'prores_ks', pixFmt: 'yuva444p10le', extra: ['-profile:v', '4'], ext: '.mov' },
    'mp4': { codec: 'libx264', pixFmt: 'yuv420p', extra: ['-crf', '18', '-preset', 'slow'], ext: '.mp4' },
};

function convertOne(input, opts) {
    const cfg = VIDEO_FORMATS[opts.format] || VIDEO_FORMATS['webm'];
    const output = withSuffix(input, '', cfg.ext);
    const color = opts.color.replace('#', '0x');
    const key = opts.mode === 'green' ? 'chromakey' : 'colorkey';
    let chain = `${key}=color=${color}:similarity=${opts.similarity}:blend=${opts.blend}`;
    // Despill removes the green fringe. Keep `expand` at 0 - expanding it pulls
    // green out of the whole subject (skin/fabric) and leaves a pink/magenta cast.
    // `mix` (strength) is user-tunable.
    if (opts.despill) {
        const mix = typeof opts.despillStrength === 'number' ? opts.despillStrength : 0.35;
        chain += `, despill=type=green:mix=${mix}`;
    }
    // Anti-alias the matte: erode the alpha ~1px to cut the light/dark edge fringe,
    // then feather it so the cutout edge is smooth instead of jagged.
    if (opts.smoothEdges) {
        const sigma = typeof opts.edgeSoftness === 'number' ? opts.edgeSoftness : 0.6;
        chain += `,format=yuva420p,split[m][a];[a]alphaextract,erosion,gblur=sigma=${sigma}[al];[m][al]alphamerge`;
    }

    // -loglevel error drops the banner + swscaler warnings; -stats keeps the
    // progress lines and real errors still show.
    const args = ['-hide_banner', '-loglevel', 'error', '-stats',
        '-i', input, '-vf', chain, '-c:v', cfg.codec, '-pix_fmt', cfg.pixFmt,
        '-an', ...cfg.extra, '-y', output];

    mainWindow.webContents.send('video:log', `> ffmpeg ${args.join(' ')}\n`);

    return new Promise((resolve) => {
        const proc = spawn(ffmpegPath, args, { windowsHide: true });
        proc.stderr.on('data', (d) => mainWindow.webContents.send('video:log', d.toString()));
        proc.on('error', (err) => {
            mainWindow.webContents.send('video:log', `FATAL: ${err.message}\n`);
            resolve({ input, ok: false, error: err.message });
        });
        proc.on('close', (code) => {
            const ok = code === 0;
            mainWindow.webContents.send('video:log',
                `--- ${ok ? 'OK' : 'FAILED (' + code + ')'}: ${path.basename(input)} ---\n\n`);
            resolve({ input, output, ok });
        });
    });
}

ipcMain.handle('video:convert', async (_e, { files, options }) => {
    const results = [];
    for (const f of files) {
        results.push(await convertOne(f, options));
    }
    mainWindow.webContents.send('video:log', 'All conversions finished.\n');
    return results;
});
