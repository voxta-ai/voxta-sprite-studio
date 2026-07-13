import { createSignal, onMount, Show } from 'solid-js';
import { Wand2, FolderOpen, ArrowRight, Loader2, ImageUp, Sparkles, Download } from 'lucide-solid';
import { DropZone } from './DropZone';
import { Segmented } from './Segmented';

interface Step1Props {
  onResult: (data: { path: string; dataUrl: string }) => void;
  onLog: (line: string) => void;
  goToStep2: () => void;
}

export function Step1RemoveBg(props: Step1Props) {
  const [inputPath, setInputPath] = createSignal<string | null>(null);
  const [inputUrl, setInputUrl] = createSignal<string | null>(null);
  const [outputUrl, setOutputUrl] = createSignal<string | null>(null);
  const [outputPath, setOutputPath] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<'base' | 'fast'>('base');
  const [edge, setEdge] = createSignal<'soft' | 'hard'>('soft');
  const [busy, setBusy] = createSignal(false);
  const [status, setStatus] = createSignal('Select a character image to begin.');
  const [ready, setReady] = createSignal(true);
  const [settingUp, setSettingUp] = createSignal(false);
  const [gpu, setGpu] = createSignal(false);

  onMount(async () => {
    setReady(await window.api.isBgReady());
    setGpu(await window.api.hasGpu());
  });

  const setupNow = async () => {
    setSettingUp(true);
    props.onLog('[BG] Setting up background remover...');
    const res = await window.api.setupBg();
    setSettingUp(false);
    if (res.ok) { setReady(true); props.onLog('[BG] Background remover ready.'); }
    else props.onLog(`[BG] Setup failed: ${res.error}`);
  };

  const loadInput = async (path: string) => {
    const res = await window.api.readImage(path);
    if (res.ok) {
      setInputPath(path);
      setInputUrl(res.dataUrl!);
      setOutputUrl(null);
      setStatus(path.split(/[\\/]/).pop() || '');
    } else {
      setStatus(`Could not open: ${res.error}`);
    }
  };

  const run = async () => {
    const path = inputPath();
    if (!path) return;
    setBusy(true);
    setStatus('Removing background (loading model on first run)...');
    props.onLog(`[BG] Removing background from ${path.split(/[\\/]/).pop()}`);
    const res = await window.api.removeBackground({
      input: path,
      mode: mode(),
      threshold: edge() === 'hard' ? 0.5 : 0,
    });
    setBusy(false);
    if (res.ok) {
      setOutputUrl(res.dataUrl!);
      setOutputPath(res.output!);
      setStatus(`Saved ${res.output!.split(/[\\/]/).pop()}`);
      props.onLog(`[BG] Done -> ${res.output}`);
      props.onResult({ path: res.output!, dataUrl: res.dataUrl! });
    } else {
      setStatus(`Failed: ${res.error}`);
      props.onLog(`[BG] Error: ${res.error}`);
    }
  };

  return (
    <div>
      <p class="text-muted small mb-4">
        Bring your own character image. The AI cuts out the background and gives you a clean
        transparent PNG.
      </p>

      <Show when={!ready()}>
        <div class="d-flex align-items-center gap-3 p-2 ps-3 pe-2 mb-4 rounded-3"
          style="background: rgba(56,177,107,0.10); border: 1px solid rgba(56,177,107,0.25);">
          <Download size={16} class="text-success flex-shrink-0" />
          <span class="small text-muted flex-grow-1">
            The background remover needs a one-time setup (downloads Python + AI model, a few minutes).
            {gpu() ? ' Your NVIDIA GPU was detected, so it will install the CUDA build for faster removal.' : ''}
            {' '}It runs automatically on your first removal, or start it now:
          </span>
          <button class="btn btn-sm btn-success d-flex align-items-center gap-2 flex-shrink-0"
            disabled={settingUp()} onClick={setupNow}>
            <Show when={settingUp()} fallback={<Download size={15} />}><Loader2 size={15} class="spin" /></Show>
            {settingUp() ? 'Setting up...' : 'Set up now'}
          </button>
        </div>
      </Show>

      <div class="row g-4">
        <div class="col-md-6">
          <label class="form-label small text-muted">Your image</label>
          <DropZone
            src={inputUrl()}
            onFile={loadInput}
            kind="image"
            icon={ImageUp}
            title="Drop character image"
            subtitle="or click to browse"
          />
        </div>
        <div class="col-md-6">
          <label class="form-label small text-muted">Transparent result</label>
          <DropZone
            src={outputUrl()}
            readonly
            icon={Sparkles}
            title="Result will appear here"
          />
        </div>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-4 mt-4">
        <div>
          <div class="small text-muted mb-1">Quality</div>
          <Segmented
            value={mode()}
            onChange={setMode}
            options={[{ value: 'base', label: 'Best' }, { value: 'fast', label: 'Fast' }]}
          />
        </div>
        <div>
          <div class="small text-muted mb-1">Edges</div>
          <Segmented
            value={edge()}
            onChange={setEdge}
            options={[{ value: 'soft', label: 'Soft' }, { value: 'hard', label: 'Hard' }]}
          />
        </div>
      </div>

      <button class="premium-btn w-100 mt-4 d-flex align-items-center justify-content-center gap-2"
        disabled={!inputPath() || busy()} onClick={run}>
        <Show when={busy()} fallback={<Wand2 size={18} />}><Loader2 size={18} class="spin" /></Show>
        {busy() ? 'Removing background...' : 'Remove Background'}
      </button>

      <div class="d-flex align-items-center justify-content-between mt-3">
        <span class="small text-muted">{status()}</span>
        <div class="d-flex gap-2">
          <Show when={outputPath()}>
            <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={() => window.api.openFolder(outputPath()!)}>
              <FolderOpen size={15} /> Folder
            </button>
            <button class="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
              onClick={props.goToStep2}>
              Continue <ArrowRight size={15} />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
