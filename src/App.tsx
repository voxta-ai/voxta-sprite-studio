import { createSignal, onMount, For, Show, type Component } from 'solid-js';
import { Scissors, Crop, Layers, Film, Sparkles, Copy, Check } from 'lucide-solid';
import { Step1RemoveBg } from './components/Step1RemoveBg';
import { StepCrop } from './components/StepCrop';
import { Step2AddBackdrop } from './components/Step2AddBackdrop';
import { Step3Video } from './components/Step3Video';
import { AutoMode } from './components/AutoMode';
import { Segmented } from './components/Segmented';

type StepId = 1 | 2 | 3 | 4;
type Mode = 'guided' | 'auto';

const STEPS: { id: StepId; label: string; icon: Component<{ size?: number }> }[] = [
  { id: 1, label: 'Remove Image BG', icon: Scissors },
  { id: 2, label: 'Crop (optional)', icon: Crop },
  { id: 3, label: 'Add Backdrop', icon: Layers },
  { id: 4, label: 'Video → WebM', icon: Film },
];

const App: Component = () => {
  const [mode, setMode] = createSignal<Mode>('guided');
  const [step, setStep] = createSignal<StepId>(1);
  const [carried, setCarried] = createSignal<{ path: string; dataUrl: string } | null>(null);
  const [log, setLog] = createSignal<string[]>([]);
  let logEl: HTMLDivElement | undefined;

  const [copied, setCopied] = createSignal(false);
  const copyLog = async () => {
    await navigator.clipboard.writeText(log().join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const addLog = (msg: string) => {
    const stamped = msg.endsWith('\n') ? msg.slice(0, -1) : msg;
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${stamped}`]);
    queueMicrotask(() => { if (logEl) logEl.scrollTop = logEl.scrollHeight; });
  };

  // Stream native process logs (Python bg removal + ffmpeg) into the shared panel.
  onMount(() => {
    if (!window.api) {
      addLog('Run this through Electron (npm run electron:dev), not a plain browser.');
      return;
    }
    window.api.onBgLog((line) => addLog(line.trimEnd()));
    window.api.onVideoLog((line) => addLog(line.trimEnd()));
  });

  return (
    <div class="container py-4" style="max-width: 1100px;">
      <header class="text-center mb-4">
        <div class="d-inline-flex align-items-center justify-content-center gap-3 mb-2">
          <div class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10"
            style="width: 46px; height: 46px;">
            <Sparkles size={22} class="text-success" />
          </div>
          <h2 class="fw-bold mb-0">Voxta Sprite Studio</h2>
        </div>
        <p class="text-muted small mb-3">Turn a character image into a transparent WebM for the stage</p>

        <div class="d-flex justify-content-center mb-4">
          <Segmented
            value={mode()}
            onChange={setMode}
            options={[{ value: 'guided', label: 'Guided steps' }, { value: 'auto', label: 'Auto (1-click)' }]}
          />
        </div>

        <Show when={mode() === 'guided'}>
          <div class="step-nav">
            <For each={STEPS}>
              {(s) => (
                <div
                  class={`step-pill ${step() === s.id ? 'active' : ''} ${s.id < step() ? 'done' : ''}`}
                  onClick={() => setStep(s.id)}
                >
                  <span class="step-index">{s.id}</span>
                  <s.icon size={16} />
                  <span>{s.label}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </header>

      <div class="glass-card p-4 p-md-5">
        <Show when={mode() === 'auto'}>
          <AutoMode onLog={addLog} />
        </Show>
        <Show when={mode() === 'guided'}>
          <Show when={step() === 1}>
            <Step1RemoveBg
              onResult={setCarried}
              onLog={addLog}
              goToStep2={() => setStep(2)}
            />
          </Show>
          <Show when={step() === 2}>
            <StepCrop
              carried={carried}
              onCropped={setCarried}
              onLog={addLog}
              goNext={() => setStep(3)}
            />
          </Show>
          <Show when={step() === 3}>
            <Step2AddBackdrop carried={carried} onLog={addLog} />
          </Show>
          <Show when={step() === 4}>
            <Step3Video />
          </Show>
        </Show>
      </div>

      <div class="glass-card p-3 mt-4">
        <div class="d-flex align-items-center justify-content-between mb-2 border-bottom border-secondary border-opacity-25 pb-2">
          <span class="text-muted small">Log</span>
          <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            disabled={!log().length} onClick={copyLog}>
            <Show when={copied()} fallback={<Copy size={14} />}><Check size={14} /></Show>
            {copied() ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div ref={(el) => (logEl = el)} class="log-box p-2 overflow-auto custom-scrollbar" style="max-height: 200px;">
          <Show when={log().length} fallback={<span class="text-muted">No activity yet...</span>}>
            <For each={log()}>{(line) => <div class="text-info-emphasis">{line}</div>}</For>
          </Show>
        </div>
      </div>

      <footer class="text-center mt-4">
        <p class="text-muted small mb-0">image → transparent PNG → backdrop → transparent WebM</p>
      </footer>
    </div>
  );
};

export default App;
