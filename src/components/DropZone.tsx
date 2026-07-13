import { createSignal, Show, type Component } from 'solid-js';
import { Dynamic } from 'solid-js/web';

interface DropZoneProps {
  /** Data URL of the image/video to preview, or null. */
  src: string | null;
  /** Called with the absolute path of a picked or dropped file. */
  onFile?: (path: string) => void;
  /** File kind for the native picker. */
  kind?: 'image' | 'video';
  /** Placeholder content. */
  icon?: Component<{ size?: number; class?: string }>;
  title: string;
  subtitle?: string;
  /** Preview-only: not clickable / droppable. */
  readonly?: boolean;
  /** Force a solid backdrop behind the preview (Step 2). */
  backdrop?: 'green' | 'black' | null;
  video?: boolean;
}

export function DropZone(props: DropZoneProps) {
  const [dragActive, setDragActive] = createSignal(false);

  const pick = async () => {
    if (props.readonly || !props.onFile) return;
    if (props.kind === 'video') {
      const files = await window.api.pickVideos();
      if (files.length) props.onFile(files[0]);
    } else {
      const p = await window.api.pickImage();
      if (p) props.onFile(p);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (props.readonly || !props.onFile) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) props.onFile(window.api.getPathForFile(file));
  };

  const backdropClass = () =>
    props.backdrop === 'green' ? 'solid-green'
      : props.backdrop === 'black' ? 'solid-black'
        : '';

  return (
    <div
      class={`preview-panel ${props.readonly ? 'readonly' : ''} ${dragActive() ? 'drop-active' : ''} ${backdropClass()}`}
      onClick={pick}
      onDragOver={(e) => { e.preventDefault(); if (!props.readonly) setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
    >
      <Show when={props.src} fallback={
        <div class="placeholder">
          <Show when={props.icon}>
            <Dynamic component={props.icon} size={34} class="ph-icon" />
          </Show>
          <div class="ph-title">{props.title}</div>
          <Show when={props.subtitle}>
            <div class="ph-sub">{props.subtitle}</div>
          </Show>
        </div>
      }>
        <Show when={props.video} fallback={<img src={props.src!} alt="preview" />}>
          <video src={props.src!} autoplay loop muted controls />
        </Show>
      </Show>
    </div>
  );
}
