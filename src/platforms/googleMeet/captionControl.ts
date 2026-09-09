export type CaptionControlState = 'on' | 'off' | 'unknown';

export interface ControlButton {
  getAttribute: (name: string) => string | null;
}

export interface ControlDocument {
  querySelectorAll: (selector: string) => ArrayLike<ControlButton>;
}

const OFF_PATTERNS = /turn on|show captions|enable captions|unmute captions/i;
const ON_PATTERNS = /turn off|hide captions|disable captions|mute captions/i;

export function readCaptionControlState(doc: ControlDocument): CaptionControlState {
  const buttons = Array.from(doc.querySelectorAll('button'));
  for (const button of buttons) {
    const label = button.getAttribute('aria-label') ?? '';
    if (!/caption/i.test(label)) continue;
    if (OFF_PATTERNS.test(label)) return 'off';
    if (ON_PATTERNS.test(label)) return 'on';
  }
  return 'unknown';
}
