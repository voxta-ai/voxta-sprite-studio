import { createSignal, For, Show } from 'solid-js';
import { Film, FolderPlus, Loader2, Play } from 'lucide-solid';
import { Segmented } from './Segmented';
import { FileList } from './FileList';
import { mergeFiles } from '../utils/files';
import type { VideoOptions } from '../types';

const FORMATS: { value: VideoOptions['format']; label: string; alpha: boolean }[] = [
  { value: 'webm', label: 'WebM (VP9) - transparent', alpha: true },
  { value: 'webm-lossless', label: 'WebM (VP9 Lossless)', alpha: true },
  { value: 'prores', label: 'MOV (ProRes 4444)', alpha: true },
  { value: 'mp4', label: 'MP4 (H.264) - no transparency', alpha: false },
];

export function Step3Video() {
  const [files, setFiles] = createSignal<string[]>([]);
  const [mode, setMode] = createSignal<'green' | 'black'>('green');
  const [color, setColor] = createSignal('#00de00');
  const [similarity, setSimilarity] = createSignal('0.12');
  const [blend, setBlend] = createSignal('0.15');
  const [despill, setDespill] = createSignal(true);
  const [despillStrength, setDespillStrength] = createSignal(0.35);
  const [smoothEdges, setSmoothEdges] = createSignal(true);
  const [edgeSoftness, setEdgeSoftness] = createSignal(0.6);
  const [format, setFormat] = createSignal<VideoOptions['format']>('webm');
  const [busy, setBusy] = createSignal(false);
  const [dragActive, setDragActive] = createSignal(false);

  const applyMode = (m: 'green' | 'black') => {
    setMode(m);
    if (m === 'green') {
      setColor('#00de00'); setSimilarity('0.12'); setBlend('0.15'); setDespill(true);
    } else {
      setColor('#000000'); setSimilarity('0.15'); setBlend('0.20'); setDespill(false);
    }
  };

  const pick = async () => {
    const picked = await window.api.pickVideos();
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

  const alphaWarning = () => !FORMATS.find((f) => f.value === format())?.alpha;

  const convert = async () => {
    if (!files().length) return;
    setBusy(true);
    await window.api.convertVideos({
      files: files(),
      options: {
        mode: mode(), color: color(), similarity: similarity(),
        blend: blend(), despill: despill(), despillStrength: despillStrength(),
        smoothEdges: smoothEdges(), edgeSoftness: edgeSoftness(),
        format: format(),
      },
    });
    setBusy(false);
  };

  return (
    <div>
      <p class="text-muted small mb-4">
        Drop the green/black video back from your generator. This keys out the backdrop and saves
        a transparent WebM ready for Voxta's stage.
      </p>

      <div class="row g-4">
        {/* file drop surface */}
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
                  <Film size={34} class="ph-icon" />
                  <div class="ph-title">Drop videos here</div>
                  <div class="ph-sub">or click to browse</div>
                </div>
              }
            >
              <div class="w-100">
                <button
                  class="btn btn-outline-secondary btn-sm w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
                  onClick={(e) => { e.stopPropagation(); pick(); }}
                >
                  <FolderPlus size={16} /> Select videos
                </button>
                <FileList files={files()} onRemove={removeFile} />
              </div>
            </Show>
          </div>
        </div>

        {/* settings */}
        <div class="col-md-5">
          <div class="glass-card p-3">
            <div class="small text-muted mb-1">Backdrop to remove</div>
            <Segmented
              value={mode()}
              onChange={applyMode}
              options={[{ value: 'green', label: 'Green' }, { value: 'black', label: 'Black' }]}
            />

            <div class="mt-3">
              <label class="form-label small text-muted mb-1">Key colour (hex)</label>
              <input class="form-control form-control-sm form-control-dark" value={color()}
                onInput={(e) => setColor(e.currentTarget.value)} />
            </div>
            <div class="row g-2 mt-1">
              <div class="col-6">
                <label class="form-label small text-muted mb-1">Similarity</label>
                <input class="form-control form-control-sm form-control-dark" value={similarity()}
                  onInput={(e) => setSimilarity(e.currentTarget.value)} />
              </div>
              <div class="col-6">
                <label class="form-label small text-muted mb-1">Blend</label>
                <input class="form-control form-control-sm form-control-dark" value={blend()}
                  onInput={(e) => setBlend(e.currentTarget.value)} />
              </div>
            </div>

            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" id="despill" checked={despill()}
                onChange={(e) => setDespill(e.currentTarget.checked)} />
              <label class="form-check-label small" for="despill">Remove green spill (halo)</label>
            </div>
            <Show when={despill()}>
              <div class="mt-2">
                <div class="d-flex justify-content-between small text-muted mb-1">
                  <span>Spill strength</span>
                  <span>{despillStrength().toFixed(2)}</span>
                </div>
                <input type="range" class="form-range" min="0.1" max="0.6" step="0.05"
                  value={despillStrength()}
                  onInput={(e) => setDespillStrength(parseFloat(e.currentTarget.value))} />
                <div class="small text-muted" style="opacity:0.7">Lower this if the result looks pink/magenta; raise it if green edges remain.</div>
              </div>
            </Show>

            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" id="smooth" checked={smoothEdges()}
                onChange={(e) => setSmoothEdges(e.currentTarget.checked)} />
              <label class="form-check-label small" for="smooth">Smooth edges (anti-alias)</label>
            </div>
            <Show when={smoothEdges()}>
              <div class="mt-2">
                <div class="d-flex justify-content-between small text-muted mb-1">
                  <span>Edge softness</span>
                  <span>{edgeSoftness().toFixed(1)}</span>
                </div>
                <input type="range" class="form-range" min="0.5" max="2.5" step="0.1"
                  value={edgeSoftness()}
                  onInput={(e) => setEdgeSoftness(parseFloat(e.currentTarget.value))} />
                <div class="small text-muted" style="opacity:0.7">Removes the jagged white/black edge fringe. Raise for softer edges, lower to keep them crisp.</div>
              </div>
            </Show>

            <div class="mt-3">
              <label class="form-label small text-muted mb-1">Output format</label>
              <select class="form-select form-select-sm form-select-dark"
                value={format()} onChange={(e) => setFormat(e.currentTarget.value as VideoOptions['format'])}>
                <For each={FORMATS}>{(f) => <option value={f.value}>{f.label}</option>}</For>
              </select>
              <Show when={alphaWarning()}>
                <div class="small text-warning mt-2">This format has no transparency. Removed areas become black.</div>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <button class="premium-btn w-100 mt-4 d-flex align-items-center justify-content-center gap-2"
        disabled={!files().length || busy()} onClick={convert}>
        <Show when={busy()} fallback={<Film size={18} />}><Loader2 size={18} class="spin" /></Show>
        {busy() ? 'Converting...' : 'Convert to WebM'}
      </button>

      <div class="text-muted small mt-3 d-flex align-items-center gap-2">
        <Play size={14} /> Output lands in a sprite-studio-output folder next to each source video. Watch the log below for progress.
      </div>
    </div>
  );
}
