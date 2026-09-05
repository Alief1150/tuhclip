import { describe, expect, it } from 'vitest';
import { findCaptionBlocks, findCaptionRegion } from './selectors';
import { parseCaptionBlock } from './captionParser';
import { asElement, asRoot, TestElement } from './testDom';

describe('Google Meet selectors', () => {
  it.each([
    ['ARIA live region', new TestElement('div', { 'aria-live': 'polite' }).append(new TestElement('div', { 'data-is-caption': 'true' }))],
    ['stable data region', new TestElement('div', { 'data-caption-region': 'true' }).append(new TestElement('div', { role: 'listitem' }))],
    ['structural dialog region', new TestElement('div', { role: 'region', 'aria-label': 'Captions' }).append(new TestElement('div', { role: 'listitem' }))],
  ])('finds a caption region using %s', (_name, region) => {
    const root = new TestElement('main').append(region);
    expect(findCaptionRegion(asRoot(root))).toBe(asElement(region));
  });

  it('does not treat an unstable class name as sufficient evidence', () => {
    const generated = new TestElement('div', { class: 'iOzk7 X9fN0 caption-container' });
    expect(findCaptionRegion(asRoot(new TestElement('main').append(generated)))).toBeNull();
  });

  it('finds semantic caption blocks and excludes empty blocks', () => {
    const spoken = new TestElement('div', { 'data-is-caption': 'true' }, 'Ada Hello');
    const empty = new TestElement('div', { role: 'listitem' }, '   ');
    const region = new TestElement('div', { 'aria-live': 'polite' }).append(spoken, empty);
    expect(findCaptionBlocks(asElement(region))).toEqual([asElement(spoken)]);
  });

  it.each([
    new TestElement('div', { 'aria-live': 'polite', 'aria-label': 'Chat messages' }).append(new TestElement('div', { role: 'listitem' }, 'Hello')),
    new TestElement('div', { role: 'region', 'aria-label': 'Participants' }).append(new TestElement('div', { role: 'listitem' }, 'Ada')),
    new TestElement('div', { 'aria-live': 'assertive', 'aria-label': 'Notifications' }).append(new TestElement('div', { role: 'listitem' }, 'Disconnected')),
  ])('rejects unrelated named live and region UIs', (unrelated) => {
    expect(findCaptionRegion(asRoot(new TestElement('main').append(unrelated)))).toBeNull();
  });

  it('excludes semantically hidden caption blocks and accepts them after visibility changes', () => {
    const block = new TestElement('div', { 'data-is-caption': 'true', hidden: '' }, 'Hidden words');
    const region = new TestElement('div', { 'aria-live': 'polite', 'aria-label': 'Captions' }).append(block);
    expect(findCaptionBlocks(asElement(region))).toEqual([]);
    delete block.attributes.hidden;
    expect(findCaptionBlocks(asElement(region))).toEqual([asElement(block)]);
    block.attributes['aria-hidden'] = 'true';
    expect(findCaptionBlocks(asElement(region))).toEqual([]);
    delete block.attributes['aria-hidden'];
    block.attributes.style = 'display: none';
    expect(findCaptionBlocks(asElement(region))).toEqual([]);
  });

  it('discovers and parses one canonical observation from nested caption markup', () => {
    const outer = new TestElement('div', { 'data-caption-id': 'caption-1' }).append(
      new TestElement('span', { 'data-speaker-name': 'true' }, 'Ada'),
      new TestElement('span', { 'data-caption-text': 'true' }, 'Nested words'),
    );
    const region = new TestElement('div', { 'aria-live': 'polite', 'aria-label': 'Captions' }).append(outer);
    const root = new TestElement('main').append(region);

    const found = findCaptionRegion(asRoot(root));
    const observations = found
      ? findCaptionBlocks(found).map((block) => parseCaptionBlock(block, 100)).filter(Boolean)
      : [];

    expect(observations).toEqual([{
      speaker: 'Ada',
      text: 'Nested words',
      observedAt: 100,
      sourceId: 'caption-1',
    }]);
  });

  it.each([
    ['hidden', ''],
    ['inert', ''],
    ['style', 'visibility: hidden'],
  ])('excludes captions hidden by an external %s ancestor', (attribute, value) => {
    const block = new TestElement('div', { 'data-is-caption': 'true' }, 'Hidden words');
    const region = new TestElement('div', { 'aria-live': 'polite', 'aria-label': 'Captions' }).append(block);
    const ancestor = new TestElement('section', { [attribute]: value }).append(region);
    new TestElement('main').append(ancestor);
    expect(findCaptionBlocks(asElement(region))).toEqual([]);
  });
});
