import { createEffect, createSignal, Show, untrack } from 'solid-js';
import { Crop, Scissors, RotateCcw, Check, FolderOpen, ArrowRight, ImageUp } from 'lucide-solid';
import { Cropper } from './Cropper';
import { DropZone } from './DropZone';
import type { Rect } from '../types';

interface StepCropProps {
  carried: () => { path: string; dataUrl: string } | null;
  onCropped: (data: { path: string; dataUrl: string }) => void;
  onLog: (line: string) => void;
  goNext: () => void;
}

const base = (p: string) => p.split(/[\\/]/).pop() || '';

export function StepCrop(props: StepCropProps) {
  const [inputPath, setInputPath] = createSignal<string | null>(null);
  const [inputUrl, setInputUrl] = createSignal<string | null>(null);
  const [rect, setRect] = createSignal<Rect | null>(null);
  const [nat, setNat] = createSignal({ w: 0, h: 0 });
  const [status, setStatus] = createSignal('Drag the edges to crop, or auto-trim to the character.');
  const [outputPath, setOutputPath] = createSignal<string | null>(null);

  const loadFrom = (path: string, dataUrl: string) => {
    setInputPath(path);
    setInputUrl(dataUrl);
    setRect(null);
    setOutputPath(null);
    setStatus(base(path));
  };

  // Pull the result from the previous step (unless it's already what we have loaded).
  createEffect(() => {
    const c = props.carried();
    if (c && c.path !== untrack(inputPath)) loadFrom(c.path, c.dataUrl);
  });

  const pickInput = async (path: string) => {
    const res = await window.api.readImage(path);
    if (res.ok) loadFrom(path, res.dataUrl!);
    else setStatus(`Could not open: ${res.error}`);
  };

  const clearInput = () => {
    setInputPath(null);
    setInputUrl(null);
    setRect(null);
    setOutputPath(null);
    setStatus('Drag the edges to crop, or auto-trim to the character.');
  };

  const onReady = (w: number, h: number) => {
    setNat({ w, h });
    setRect((prev) => prev ?? { x: 0, y: 0, w, h });
  };

  const reset = () => setRect({ x: 0, y: 0, w: nat().w, h: nat().h });

  const autoTrim = () => {
    const url = inputUrl();
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let minX = c.width, minY = c.height, maxX = 0, maxY = 0, found = false;
      const A = 16; // alpha threshold
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3] > A) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!found) { setStatus('Image is fully transparent - nothing to trim.'); return; }
      setRect({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
      setStatus('Trimmed to the character. Adjust the edges if needed.');
    };
    img.src = url;
  };

  const apply = async () => {
    const url = inputUrl();
    const path = inputPath();
    const r = rect();
    if (!url || !path || !r) return;
    const img = new Image();
    img.onload = async () => {
      const c = document.createElement('canvas');
      c.width = Math.round(r.w);
      c.height = Math.round(r.h);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      const base64 = c.toDataURL('image/png');
      const res = await window.api.saveCrop({ input: path, base64 });
      if (res.ok) {
        setOutputPath(res.output!);
        setStatus(`Saved ${base(res.output!)} (${c.width}x${c.height})`);
        props.onLog(`[Crop] Saved ${res.output}`);
        props.onCropped({ path: res.output!, dataUrl: base64 });
        // Keep working on the cropped result without re-triggering a reload.
        setInputPath(res.output!);
        setInputUrl(base64);
        setRect(null);
      } else {
        setStatus(`Failed: ${res.error}`);
        props.onLog(`[Crop] Error: ${res.error}`);
      }
    };
    img.src = url;
  };

  return (
    <div>
      <p class="text-muted small mb-4">
        Optional. Tighten the frame around your character - drag the edges or hit Auto-trim, then
        Apply. Skip straight to the next step if you don't need it.
      </p>

      <Show
        when={inputUrl()}
        fallback={
          <div class="row justify-content-center">
            <div class="col-md-7">
              <DropZone
                src={null}
                onFile={pickInput}
                kind="image"
                icon={Crop}
                title="Drop a transparent PNG to crop"
                subtitle="or click to browse"
              />
            </div>
          </div>
        }
      >
        <Cropper src={inputUrl()!} rect={rect()} onChange={setRect} onReady={onReady} />

        <div class="d-flex flex-wrap align-items-center gap-2 mt-4">
          <button class="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={autoTrim}>
            <Scissors size={16} /> Auto-trim to character
          </button>
          <button class="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={reset}>
            <RotateCcw size={16} /> Reset
          </button>
          <button class="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={clearInput}>
            <ImageUp size={16} /> Change image
          </button>
          <Show when={rect()}>
            <span class="text-muted small ms-1">
              {Math.round(rect()!.w)} x {Math.round(rect()!.h)} px
            </span>
          </Show>
        </div>

        <button class="premium-btn w-100 mt-4 d-flex align-items-center justify-content-center gap-2" onClick={apply}>
          <Check size={18} /> Apply Crop
        </button>

        <div class="d-flex align-items-center justify-content-between mt-3">
          <span class="small text-muted">{status()}</span>
          <div class="d-flex gap-2">
            <Show when={outputPath()}>
              <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                onClick={() => window.api.openFolder(outputPath()!)}>
                <FolderOpen size={15} /> Folder
              </button>
            </Show>
            <button class="btn btn-sm btn-outline-success d-flex align-items-center gap-1" onClick={props.goNext}>
              Continue <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
