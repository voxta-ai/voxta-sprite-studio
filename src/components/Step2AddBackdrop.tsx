import { createEffect, createSignal, Show } from 'solid-js';
import { Layers, FolderOpen, ImageUp, Eye } from 'lucide-solid';
import { DropZone } from './DropZone';
import { Segmented } from './Segmented';

interface Step2Props {
  carried: () => { path: string; dataUrl: string } | null;
  onLog: (line: string) => void;
}

export function Step2AddBackdrop(props: Step2Props) {
  const [inputPath, setInputPath] = createSignal<string | null>(null);
  const [inputUrl, setInputUrl] = createSignal<string | null>(null);
  const [color, setColor] = createSignal<'green' | 'black'>('green');
  const [status, setStatus] = createSignal('Select a transparent PNG.');
  const [outputPath, setOutputPath] = createSignal<string | null>(null);

  // Auto-fill from Step 1 when a result is carried forward.
  createEffect(() => {
    const carried = props.carried();
    if (carried) {
      setInputPath(carried.path);
      setInputUrl(carried.dataUrl);
      setStatus(carried.path.split(/[\\/]/).pop() || '');
      setOutputPath(null);
    }
  });

  const loadInput = async (path: string) => {
    const res = await window.api.readImage(path);
    if (res.ok) {
      setInputPath(path);
      setInputUrl(res.dataUrl!);
      setStatus(path.split(/[\\/]/).pop() || '');
      setOutputPath(null);
    } else {
      setStatus(`Could not open: ${res.error}`);
    }
  };

  const save = async () => {
    const url = inputUrl();
    const path = inputPath();
    if (!url || !path) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color() === 'green' ? '#00ff00' : '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL('image/png');
      const res = await window.api.saveBackdrop({ input: path, color: color(), base64 });
      if (res.ok) {
        setOutputPath(res.output!);
        setStatus(`Saved ${res.output!.split(/[\\/]/).pop()}`);
        props.onLog(`[Backdrop] Saved ${res.output}`);
      } else {
        setStatus(`Failed: ${res.error}`);
        props.onLog(`[Backdrop] Error: ${res.error}`);
      }
    };
    img.src = url;
  };

  return (
    <div>
      <p class="text-muted small mb-4">
        Put a solid green or black backdrop behind the transparent PNG so your video generator
        (e.g. Grok) has a clean key colour to work with.
      </p>

      <div class="row g-4">
        <div class="col-md-6">
          <label class="form-label small text-muted">Transparent PNG</label>
          <DropZone
            src={inputUrl()}
            onFile={loadInput}
            kind="image"
            icon={ImageUp}
            title="Drop transparent PNG"
            subtitle="or click to browse"
          />
        </div>
        <div class="col-md-6">
          <label class="form-label small text-muted">With backdrop</label>
          <DropZone
            src={inputUrl()}
            readonly
            backdrop={inputUrl() ? color() : null}
            icon={Eye}
            title="Preview will appear here"
          />
        </div>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-4 mt-4">
        <div>
          <div class="small text-muted mb-1">Backdrop</div>
          <Segmented
            value={color()}
            onChange={setColor}
            options={[{ value: 'green', label: 'Green' }, { value: 'black', label: 'Black' }]}
          />
        </div>
      </div>

      <button class="premium-btn w-100 mt-4 d-flex align-items-center justify-content-center gap-2"
        disabled={!inputPath()} onClick={save}>
        <Layers size={18} /> Add Backdrop &amp; Save
      </button>

      <div class="d-flex align-items-center justify-content-between mt-3">
        <span class="small text-muted">{status()}</span>
        <Show when={outputPath()}>
          <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={() => window.api.openFolder(outputPath()!)}>
            <FolderOpen size={15} /> Folder
          </button>
        </Show>
      </div>

      <p class="text-muted small mt-3 mb-0" style="opacity:0.7">
        Next: send this image to your video generator, then bring the downloaded video to Step 3.
      </p>
    </div>
  );
}
