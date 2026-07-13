import { createSignal, onCleanup, onMount, For, Show } from 'solid-js';
import type { Rect } from '../types';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number] | 'move';

interface CropperProps {
  src: string;
  rect: Rect | null;
  onChange: (r: Rect) => void;
  onReady: (w: number, h: number) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Cropper(props: CropperProps) {
  let imgEl: HTMLImageElement | undefined;
  const [nat, setNat] = createSignal({ w: 0, h: 0 });
  const [dispW, setDispW] = createSignal(0);

  let drag: { mode: Handle; mx: number; my: number; rect: Rect; scale: number } | null = null;

  const scale = () => (nat().w ? dispW() / nat().w : 1);

  const measure = () => { if (imgEl) setDispW(imgEl.clientWidth); };

  const onLoad = () => {
    if (!imgEl) return;
    setNat({ w: imgEl.naturalWidth, h: imgEl.naturalHeight });
    measure();
    props.onReady(imgEl.naturalWidth, imgEl.naturalHeight);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const { mode, mx, my, rect, scale: s } = drag;
    const dx = (e.clientX - mx) / s;
    const dy = (e.clientY - my) / s;
    const N = nat();
    const min = 12;
    let { x, y, w, h } = rect;

    if (mode === 'move') {
      x = clamp(rect.x + dx, 0, N.w - w);
      y = clamp(rect.y + dy, 0, N.h - h);
    } else {
      const left = mode === 'nw' || mode === 'w' || mode === 'sw';
      const right = mode === 'ne' || mode === 'e' || mode === 'se';
      const top = mode === 'nw' || mode === 'n' || mode === 'ne';
      const bottom = mode === 'sw' || mode === 's' || mode === 'se';
      if (left) { const r = rect.x + rect.w; x = clamp(rect.x + dx, 0, r - min); w = r - x; }
      if (right) { w = clamp(rect.w + dx, min, N.w - rect.x); }
      if (top) { const b = rect.y + rect.h; y = clamp(rect.y + dy, 0, b - min); h = b - y; }
      if (bottom) { h = clamp(rect.h + dy, min, N.h - rect.y); }
    }
    props.onChange({ x, y, w, h });
  };

  const onPointerUp = () => { drag = null; };

  onMount(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });
  onCleanup(() => {
    window.removeEventListener('resize', measure);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  });

  const startDrag = (mode: Handle, e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!props.rect) return;
    drag = { mode, mx: e.clientX, my: e.clientY, rect: { ...props.rect }, scale: scale() };
  };

  const box = () => {
    const r = props.rect;
    const s = scale();
    if (!r || !s) return null;
    return { left: r.x * s, top: r.y * s, width: r.w * s, height: r.h * s };
  };

  return (
    <div class="cropper">
      <div class="cropper-stage">
        <img ref={(el) => (imgEl = el)} src={props.src} onLoad={onLoad} draggable={false} alt="crop source" />
        <Show when={box()}>
          {(b) => (
            <div
              class="crop-rect"
              style={{ left: `${b().left}px`, top: `${b().top}px`, width: `${b().width}px`, height: `${b().height}px` }}
              onPointerDown={(e) => startDrag('move', e)}
            >
              <div class="crop-thirds" />
              <For each={HANDLES}>
                {(h) => <div class={`crop-handle h-${h}`} onPointerDown={(e) => startDrag(h, e)} />}
              </For>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
