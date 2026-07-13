import { For } from 'solid-js';
import { X } from 'lucide-solid';
import { baseName } from '../utils/files';

interface FileListProps {
  files: string[];
  onRemove: (path: string) => void;
}

export function FileList(props: FileListProps) {
  return (
    <div class="custom-scrollbar overflow-auto" style="max-height: 240px">
      <For each={props.files}>
        {(f) => (
          <div class="file-chip mb-2 d-flex align-items-center gap-2">
            <span class="text-truncate flex-grow-1">{baseName(f)}</span>
            <button
              class="file-chip-x"
              title="Remove"
              onClick={(e) => { e.stopPropagation(); props.onRemove(f); }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
