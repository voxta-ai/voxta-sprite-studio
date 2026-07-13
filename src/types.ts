export interface ReadImageResult {
  ok: boolean;
  dataUrl?: string;
  path?: string;
  error?: string;
}

export interface RemoveBgResult {
  ok: boolean;
  output?: string;
  dataUrl?: string;
  error?: string;
}

export interface SaveBackdropResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VideoConvertResult {
  input: string;
  output?: string;
  ok: boolean;
  error?: string;
}

export interface VideoOptions {
  mode: 'green' | 'black';
  color: string;
  similarity: string;
  blend: string;
  despill: boolean;
  format: 'webm' | 'webm-lossless' | 'prores' | 'mp4';
}

export interface SpriteApi {
  pickImage: () => Promise<string | null>;
  pickImages: () => Promise<string[]>;
  pickVideos: () => Promise<string[]>;
  readImage: (path: string) => Promise<ReadImageResult>;
  openFolder: (path: string) => Promise<void>;
  getPathForFile: (file: File) => string;
  isBgReady: () => Promise<boolean>;
  removeBackground: (data: { input: string; mode: 'base' | 'fast'; threshold: number }) => Promise<RemoveBgResult>;
  onBgLog: (cb: (line: string) => void) => () => void;
  saveCrop: (data: { input: string; base64: string }) => Promise<SaveBackdropResult>;
  saveBackdrop: (data: { input: string; color: 'green' | 'black'; base64: string }) => Promise<SaveBackdropResult>;
  convertVideos: (data: { files: string[]; options: VideoOptions }) => Promise<VideoConvertResult[]>;
  onVideoLog: (cb: (line: string) => void) => () => void;
}

declare global {
  interface Window {
    api: SpriteApi;
  }
}
