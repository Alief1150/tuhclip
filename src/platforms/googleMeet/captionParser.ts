import { CAPTION_TEXT_SELECTOR, SPEAKER_SELECTOR } from './selectors';
import type { CaptionObservation } from './types';

const sourceAttributes = ['data-caption-id', 'data-message-id', 'data-id'] as const;

export function blockSourceId(block: Element): string | null {
  for (const attribute of sourceAttributes) {
    const value = block.getAttribute(attribute);
    if (value) return value;
  }
  return null;
}

export function rowKeyFor(block: Element): string | null {
  for (const attribute of sourceAttributes) {
    const value = block.getAttribute(attribute);
    if (value) return `${attribute}=${value}`;
  }
  return null;
}

export function parseCaptionBlock(block: Element, observedAt = Date.now()): CaptionObservation | null {
  const speakerElement = block.matches(SPEAKER_SELECTOR) ? block : block.querySelector(SPEAKER_SELECTOR);
  const textElement = block.matches(CAPTION_TEXT_SELECTOR) ? block : block.querySelector(CAPTION_TEXT_SELECTOR);
  const speaker = speakerElement?.textContent?.trim() || null;
  let text = textElement?.textContent?.trim() ?? '';

  if (!text) {
    text = block.textContent?.trim() ?? '';
    if (speaker && text.startsWith(speaker)) {
      text = text.slice(speaker.length).trim();
    }
  }
  if (!text) return null;

  const sourceId = blockSourceId(block);
  return { speaker, text, observedAt, ...(sourceId ? { sourceId } : {}) };
}
