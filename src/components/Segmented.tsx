import { For } from 'solid-js';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>(props: SegmentedProps<T>) {
  return (
    <div class="segmented">
      <For each={props.options}>
        {(opt) => (
          <button
            type="button"
            class={props.value === opt.value ? 'active' : ''}
            onClick={() => props.onChange(opt.value)}
          >
            {opt.label}
          </button>
        )}
      </For>
    </div>
  );
}
