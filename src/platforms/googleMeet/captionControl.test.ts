import { describe, expect, it } from 'vitest';
import { readCaptionControlState } from './captionControl';

const button = (label: string | null) => ({
  getAttribute: (name: string) => (name === 'aria-label' ? label : null),
});

const docWith = (labels: Array<string | null>) => ({
  querySelectorAll: () => labels.map(button),
});

describe('readCaptionControlState', () => {
  it('reads CC off when Meet offers to turn captions on', () => {
    expect(readCaptionControlState(docWith(['Turn on captions']))).toBe('off');
  });

  it('reads CC on when Meet offers to turn captions off', () => {
    expect(readCaptionControlState(docWith(['Turn off captions']))).toBe('on');
  });

  it('ignores unrelated buttons and reports unknown without evidence', () => {
    expect(readCaptionControlState(docWith(['Leave call', 'Mute microphone']))).toBe('unknown');
    expect(readCaptionControlState(docWith(['Captions']))).toBe('unknown');
    expect(readCaptionControlState(docWith([null]))).toBe('unknown');
  });
});
