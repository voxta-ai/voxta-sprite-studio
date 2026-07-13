import { createSignal, Show } from 'solid-js';
import { ImageUp, FolderPlus, FolderOpen, Loader2, Wand2 } from 'lucide-solid';
import { Segmented } from './Segmented';
import { FileList } from './FileList';
import { baseName as base, mergeFiles } from '../utils/files';

interface AutoModeProps {
  onLog: (line: string) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function alphaBBox(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 16) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
}

export function AutoMode(props: AutoModeProps) {
  const [files, setFiles] = createSignal<string[]>([]);
  const [removeBg, setRemoveBg] = createSignal(true);
  const [addBackdrop, setAddBackdrop] = createSignal(true);
  const [color, setColor] = createSignal<'green' | 'black'>('green');
  const [quality, setQuality] = createSignal<'base' | 'fast'>('base');
  const [trim, setTrim] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [done, setDone] = createSignal(0);
  const [last, setLast] = createSignal<string | null>(null);
  const [dragActive, setDragActive] = createSignal(false);

  const pick = async () => {
    const picked = await window.api.pickImages();
    if (picked.length) setFiles((prev) => mergeFiles(prev, picked));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const list = e.dataTransfer?.files;
    if (list && list.length) {
      const paths = Array.from(list).map((f) => window.api.getPathForFile(f));
      setFiles((prev) => mergeFiles(prev, paths));
    }
  };

  const removeFile = (path: string) => setFiles((prev) => prev.filter((p) => p !== path));

  const noop = () => !removeBg() && !addBackdrop() && !trim();

  const process = async () => {
    if (!files().length || noop()) return;
    setBusy(true);
    setDone(0);
    setLast(null);
    for (const f of files()) {
      props.onLog(`[Auto] Processing ${base(f)}`);
      try {
        // Get the working transparent source (either remove bg, or use the file as-is).
        let srcPath = f;
        let srcUrl: string;
        if (removeBg()) {
          const bg = await window.api.removeBackground({ input: f, mode: quality(), threshold: 0 });
          if (!bg.ok) {
            props.onLog(`[Auto]   background removal failed: ${bg.error}`);
            setDone((d) => d + 1);
            continue;
          }
          srcPath = bg.output!;
          srcUrl = bg.dataUrl!;
        } else {
          const r = await window.api.readImage(f);
          if (!r.ok) {
            props.onLog(`[Auto]   could not read: ${r.error}`);
            setDone((d) => d + 1);
            continue;
          }
          srcUrl = r.dataUrl!;
        }

        const img = await loadImage(srcUrl);
        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (trim()) {
          const bb = alphaBBox(img);
          if (bb) ({ x: sx, y: sy, w: sw, h: sh } = bb);
        }

        if (addBackdrop()) {
          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = color() === 'green' ? '#00ff00' : '#000000';
          ctx.fillRect(0, 0, sw, sh);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          const save = await window.api.saveBackdrop({ input: srcPath, color: color(), base64: canvas.toDataURL('image/png') });
          if (save.ok) { props.onLog(`[Auto]   saved ${base(save.output!)}`); setLast(save.output!); }
          else props.onLog(`[Auto]   save failed: ${save.error}`);
        } else if (trim()) {
          // Trim only: save a cropped transparent PNG.
          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          const save = await window.api.saveCrop({ input: srcPath, base64: canvas.toDataURL('image/png') });
          if (save.ok) { props.onLog(`[Auto]   saved ${base(save.output!)}`); setLast(save.output!); }
          else props.onLog(`[Auto]   save failed: ${save.error}`);
        } else {
          // Remove-bg only: the transparent cut-out is already saved.
          props.onLog(`[Auto]   saved ${base(srcPath)}`);
          setLast(srcPath);
        }
      } catch (err) {
        props.onLog(`[Auto]   error: ${err instanceof Error ? err.message : String(err)}`);
      }
      setDone((d) => d + 1);
    }
    setBusy(false);
    props.onLog('[Auto] Batch finished.');
  };

  const pct = () => (files().length ? Math.round((done() / files().length) * 100) : 0);

  return (
    <div>
      <p class="text-muted small mb-4">
        Drop one or more images and pick which stages to run. Turn off "Remove background" if your
        images are already transparent and you only want the backdrop. Finished files land in a
        "sprite-studio-output" folder next to the originals.
      </p>

      <div class="row g-4">
        <div class="col-md-7">
          <div
            class={`video-drop ${dragActive() ? 'drop-active' : ''} ${files().length ? 'has-files' : ''}`}
            onClick={() => { if (!files().length) pick(); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <Show
              when={files().length}
              fallback={
                <div class="placeholder">
                  <ImageUp size={34} class="ph-icon" />
                  <div class="ph-title">Drop character images</div>
                  <div class="ph-sub">or click to browse</div>
                </div>
              }
            >
              <div class="w-100">
                <button
                  class="btn btn-outline-secondary btn-sm w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
                  onClick={(e) => { e.stopPropagation(); pick(); }}
                >
                  <FolderPlus size={16} /> Select images
                </button>
                <FileList files={files()} onRemove={removeFile} />
              </div>
            </Show>
          </div>
        </div>

        <div class="col-md-5">
          <div class="glass-card p-3">
            <div class="small text-muted mb-2">Stages to run</div>

            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="auto-removebg" checked={removeBg()}
                onChange={(e) => setRemoveBg(e.currentTarget.checked)} />
              <label class="form-check-label small" for="auto-removebg">Remove background</label>
            </div>
            <Show when={removeBg()}>
              <div class="ms-4 mt-1 mb-2">
                <Segmented
                  value={quality()}
                  onChange={setQuality}
                  options={[{ value: 'base', label: 'Best' }, { value: 'fast', label: 'Fast' }]}
                />
              </div>
            </Show>

            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="auto-backdrop" checked={addBackdrop()}
                onChange={(e) => setAddBackdrop(e.currentTarget.checked)} />
              <label class="form-check-label small" for="auto-backdrop">Add backdrop</label>
            </div>
            <Show when={addBackdrop()}>
              <div class="ms-4 mt-1 mb-2">
                <Segmented
                  value={color()}
                  onChange={setColor}
                  options={[{ value: 'green', label: 'Green' }, { value: 'black', label: 'Black' }]}
                />
              </div>
            </Show>

            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="auto-trim" checked={trim()}
                onChange={(e) => setTrim(e.currentTarget.checked)} />
              <label class="form-check-label small" for="auto-trim">Trim to character</label>
            </div>
          </div>
        </div>
      </div>

      <button class="premium-btn w-100 mt-4 d-flex align-items-center justify-content-center gap-2"
        disabled={!files().length || busy() || noop()} onClick={process}>
        <Show when={busy()} fallback={<Wand2 size={18} />}><Loader2 size={18} class="spin" /></Show>
        {busy() ? `Processing ${done()}/${files().length}...` : `Process ${files().length || ''} image${files().length === 1 ? '' : 's'}`}
      </button>
      <Show when={noop()}>
        <div class="small text-warning mt-2 text-center">Enable at least one stage to run.</div>
      </Show>

      <Show when={busy() || done() > 0}>
        <div class="progress mt-3" style="height: 6px; background: rgba(255,255,255,0.06);">
          <div class="progress-bar bg-success" style={{ width: `${pct()}%` }} />
        </div>
      </Show>

      <div class="d-flex align-items-center justify-content-between mt-3">
        <span class="small text-muted">
          {last() ? `Last saved: ${base(last()!)}` : 'Results go to a sprite-studio-output folder; the transparent cut-out is kept too.'}
        </span>
        <Show when={last()}>
          <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={() => window.api.openFolder(last()!)}>
            <FolderOpen size={15} /> Folder
          </button>
        </Show>
      </div>
    </div>
  );
}
