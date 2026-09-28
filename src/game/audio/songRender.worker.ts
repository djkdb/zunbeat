/// <reference lib="webworker" />
import { renderComposition } from './synth/renderSong';
import type { Composition } from './synth/music';

export interface RenderRequest {
  id: number;
  composition: Composition;
  sampleRate: number;
}

self.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, composition, sampleRate } = event.data;
  try {
    const audio = renderComposition(composition, sampleRate);
    (self as unknown as Worker).postMessage({ id, ok: true, ...audio }, [audio.left.buffer, audio.right.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
