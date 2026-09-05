import { describe, expect, it } from 'vitest';
import { parseCaptionBlock } from './captionParser';
import { asElement, TestElement } from './testDom';

describe('parseCaptionBlock', () => {
  it('preserves supplied caption text and reads speaker and source identity', () => {
    const block = new TestElement('div', { 'data-is-caption': 'true', 'data-caption-id': 'line-7' })
      .append(
        new TestElement('span', { 'data-speaker-name': 'true' }, 'Zoë'),
        new TestElement('span', { 'data-caption-text': 'true' }, '  Xin chào 世界  '),
      );

    expect(parseCaptionBlock(asElement(block), 1234)).toEqual({
      speaker: 'Zoë',
      text: 'Xin chào 世界',
      observedAt: 1234,
      sourceId: 'line-7',
    });
  });

  it('uses the safe fallback when speaker markup is absent', () => {
    const block = new TestElement('div', { role: 'listitem' })
      .append(new TestElement('span', { 'data-caption-text': 'true' }, 'Still speaking'));

    expect(parseCaptionBlock(asElement(block), 50)).toEqual({
      speaker: 'Unknown speaker',
      text: 'Still speaking',
      observedAt: 50,
    });
  });

  it('returns null for a block without caption text', () => {
    const block = new TestElement('div', { role: 'listitem' })
      .append(new TestElement('span', { 'data-speaker-name': 'true' }, 'Ada'));
    expect(parseCaptionBlock(asElement(block), 50)).toBeNull();
  });

  it('parses a direct caption-text element', () => {
    const block = new TestElement('span', { 'data-caption-text': 'true', 'data-caption-id': 'direct-1' }, 'Direct words');
    expect(parseCaptionBlock(asElement(block), 75)).toEqual({
      speaker: 'Unknown speaker',
      text: 'Direct words',
      observedAt: 75,
      sourceId: 'direct-1',
    });
  });
});
