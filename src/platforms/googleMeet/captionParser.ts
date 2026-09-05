import { CAPTION_TEXT_SELECTOR, SPEAKER_SELECTOR } from './selectors';
import type { CaptionObservation } from './types';

const sourceAttributes = ['data-caption-id', 'data-message-id', 'data-id'] as const;

export function parseCaptionBlock(block: Element, observedAt = Date.now()): CaptionObservation | null {
  const speakerElement = block.matches(SPEAKER_SELECTOR) ? block : block.querySelector(SPEAKER_SELECTOR);
  const textElement = block.matches(CAPTION_TEXT_SELECTOR) ? block : block.querySelector(CAPTION_TEXT_SELECTOR);
  let text = textElement?.textContent?.trim() ?? '';
  const speaker = speakerElement?.textContent?.trim() || 'Unknown speaker';

  if (!text && block.hasAttribute('data-is-caption')) {
    text = block.textContent?.trim() ?? '';
    if (speakerElement?.textContent) text = text.slice(speakerElement.textContent.length).trim();
  }
  if (!text) return null;

  const sourceId = sourceAttributes
    .map((attribute) => block.getAttribute(attribute))
    .find((value): value is string => Boolean(value));
  return { speaker, text, observedAt, ...(sourceId ? { sourceId } : {}) };
}
