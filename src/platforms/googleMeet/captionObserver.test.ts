import { describe, expect, it, vi } from 'vitest';
import { createCaptionObserver, subscribeToSpaNavigation, type ObserverLike } from './captionObserver';
import { asElement, asRoot, TestElement } from './testDom';
import { findCaptionBlocks } from './selectors';

describe('createCaptionObserver', () => {
  it('narrows observation, emits captions, reattaches after replacement, and cleans up once', () => {
    const root = new TestElement('main');
    let region: TestElement | null = null;
    const observers: FakeObserver[] = [];
    const states: string[] = [];
    const observations: unknown[] = [];
    const scheduled: Array<() => void> = [];
    const navigationListeners = new Set<() => void>();

    const controller = createCaptionObserver({
      root: asRoot(root),
      resolveRegion: () => region ? asElement(region) : null,
      readBlocks: (target) => (target as unknown as TestElement).children.map(asElement),
      parseBlock: (block) => ({ speaker: 'Ada', text: (block as unknown as TestElement).textContent, observedAt: 10 }),
      makeObserver: (callback) => {
        const observer = new FakeObserver(callback);
        observers.push(observer);
        return observer;
      },
      schedule: (task) => { scheduled.push(task); return scheduled.length; },
      cancelSchedule: vi.fn(),
      addNavigationListener: (listener) => navigationListeners.add(listener),
      removeNavigationListener: (listener) => navigationListeners.delete(listener),
      onState: (state) => states.push(state),
      onObservation: (observation) => observations.push(observation),
    });

    controller.start();
    expect(states).toEqual(['MEET_DETECTED', 'CAPTIONS_WAITING']);
    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual([{ target: asRoot(root), options: {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'inert', 'style', 'class'],
    } }]);

    region = new TestElement('div', { 'aria-live': 'polite', 'data-caption-region': 'true' }).append(new TestElement('div', {}, 'Hello'));
    root.append(region);
    observers[0].fire([{ type: 'childList', target: root, addedNodes: [region], removedNodes: [] } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(states.at(-1)).toBe('CAPTIONS_ACTIVE');
    expect(observers[0].disconnects).toBe(0);
    expect(observers).toHaveLength(2);
    expect(observers[1].targets).toEqual([{ target: asElement(region), options: {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'inert', 'style', 'class'],
    } }]);
    expect(observations).toEqual([{ speaker: 'Ada', text: 'Hello', observedAt: 10 }]);

    observers[1].fire([{ type: 'characterData', target: region.children[0] } as unknown as MutationRecord]);
    observers[1].fire([{ type: 'characterData', target: region.children[0] } as unknown as MutationRecord]);
    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(observations).toHaveLength(2);

    const oldRegionObserver = observers[1];
    root.children = [];
    region = null;
    observers[0].fire([{ type: 'childList', target: root, addedNodes: [], removedNodes: [region] } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(oldRegionObserver.disconnects).toBe(1);
    expect(states.at(-1)).toBe('CAPTIONS_INACTIVE');

    region = new TestElement('div', { 'aria-live': 'polite' }).append(new TestElement('div', {}, 'Again'));
    root.append(region);
    navigationListeners.forEach((listener) => listener());
    scheduled.shift()?.();
    expect(observers).toHaveLength(3);
    expect(states.at(-1)).toBe('CAPTIONS_ACTIVE');

    controller.start();
    expect(observers).toHaveLength(3);
    controller.stop();
    controller.stop();
    expect(observers[2].disconnects).toBe(1);
    expect(navigationListeners.size).toBe(0);
  });

  it('re-resolves on pushState, replaceState, and popstate then restores history methods', () => {
    const events = new Map<string, () => void>();
    const originalPush = vi.fn();
    const originalReplace = vi.fn();
    const target = {
      history: { pushState: originalPush, replaceState: originalReplace },
      addEventListener: (name: string, listener: () => void) => events.set(name, listener),
      removeEventListener: (name: string) => events.delete(name),
    };
    const listener = vi.fn();

    const unsubscribe = subscribeToSpaNavigation(target, listener);
    target.history.pushState(null, '', '/next');
    target.history.replaceState(null, '', '/again');
    events.get('popstate')?.();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    expect(target.history.pushState).toBe(originalPush);
    expect(target.history.replaceState).toBe(originalReplace);
    expect(events.size).toBe(0);
  });

  it('shares navigation hooks and does not overwrite a later owner during cleanup', () => {
    const events = new Map<string, Set<() => void>>();
    const originalPush = vi.fn();
    const originalReplace = vi.fn();
    const target = {
      history: { pushState: originalPush, replaceState: originalReplace },
      addEventListener: (name: string, listener: () => void) => {
        const listeners = events.get(name) ?? new Set();
        listeners.add(listener);
        events.set(name, listeners);
      },
      removeEventListener: (name: string, listener: () => void) => events.get(name)?.delete(listener),
    };
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToSpaNavigation(target, first);
    const sharedPush = target.history.pushState;
    const unsubscribeSecond = subscribeToSpaNavigation(target, second);
    expect(target.history.pushState).toBe(sharedPush);
    target.history.pushState(null, '', '/next');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    unsubscribeFirst();
    target.history.pushState(null, '', '/again');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);

    const laterOwner = vi.fn();
    target.history.pushState = laterOwner;
    unsubscribeSecond();
    expect(target.history.pushState).toBe(laterOwner);
    expect(target.history.replaceState).toBe(originalReplace);
  });

  it('uses visible caption text, not region presence, for active and inactive state', () => {
    const root = new TestElement('main');
    const region = new TestElement('div', { 'aria-live': 'polite' });
    root.append(region);
    const observers: FakeObserver[] = [];
    const scheduled: Array<() => void> = [];
    const states: string[] = [];
    const controller = createCaptionObserver({
      root: asRoot(root),
      resolveRegion: () => asElement(region),
      readBlocks: () => region.children.map(asElement),
      parseBlock: (block) => ({ speaker: 'Ada', text: (block as unknown as TestElement).textContent, observedAt: 10 }),
      makeObserver: (callback) => {
        const observer = new FakeObserver(callback);
        observers.push(observer);
        return observer;
      },
      schedule: (task) => { scheduled.push(task); return scheduled.length; },
      cancelSchedule: () => undefined,
      addNavigationListener: () => undefined,
      removeNavigationListener: () => undefined,
      onState: (state) => states.push(state),
      onObservation: () => undefined,
    });

    controller.start();
    expect(states.at(-1)).toBe('CAPTIONS_WAITING');
    region.append(new TestElement('div', {}, 'Hello'));
    observers[1].fire([{ type: 'childList', target: region, addedNodes: region.children, removedNodes: [] } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(states.at(-1)).toBe('CAPTIONS_ACTIVE');
    region.children = [];
    observers[1].fire([{ type: 'childList', target: region, addedNodes: [], removedNodes: [] } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(states.at(-1)).toBe('CAPTIONS_INACTIVE');
    controller.stop();
  });

  it('reads the connected region directly on caption mutations without scanning the document', () => {
    const root = new TestElement('main');
    const region = new TestElement('div', { 'aria-live': 'polite' }).append(new TestElement('div', {}, 'Hello'));
    root.append(region);
    const resolveRegion = vi.fn(() => asElement(region));
    const observers: FakeObserver[] = [];
    const scheduled: Array<() => void> = [];
    const controller = createCaptionObserver({
      root: asRoot(root), resolveRegion,
      readBlocks: () => region.children.map(asElement),
      parseBlock: (block) => ({ speaker: 'Ada', text: (block as unknown as TestElement).textContent, observedAt: 1 }),
      makeObserver: (callback) => { const observer = new FakeObserver(callback); observers.push(observer); return observer; },
      schedule: (task) => { scheduled.push(task); return scheduled.length; }, cancelSchedule: () => undefined,
      addNavigationListener: () => undefined, removeNavigationListener: () => undefined,
      onState: () => undefined, onObservation: () => undefined,
    });
    controller.start();
    expect(resolveRegion).toHaveBeenCalledOnce();
    observers[1].fire([{ type: 'characterData', target: region.children[0] } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(resolveRegion).toHaveBeenCalledOnce();
    controller.stop();
  });

  it('keeps document discovery active to detect removal of the observed ancestor', () => {
    const root = new TestElement('main');
    const ancestor = new TestElement('section');
    let region: TestElement | null = new TestElement('div', { 'data-caption-region': 'true' }).append(new TestElement('div', {}, 'Hello'));
    ancestor.append(region);
    root.append(ancestor);
    const observers: FakeObserver[] = [];
    const scheduled: Array<() => void> = [];
    const states: string[] = [];
    const controller = createCaptionObserver({
      root: asRoot(root), resolveRegion: () => region ? asElement(region) : null,
      readBlocks: (target) => (target as unknown as TestElement).children.map(asElement),
      parseBlock: (block) => ({ speaker: null, text: (block as unknown as TestElement).textContent, observedAt: 1 }),
      makeObserver: (callback) => { const observer = new FakeObserver(callback); observers.push(observer); return observer; },
      schedule: (task) => { scheduled.push(task); return scheduled.length; }, cancelSchedule: () => undefined,
      addNavigationListener: () => undefined, removeNavigationListener: () => undefined,
      onState: (state) => states.push(state), onObservation: () => undefined,
    });
    controller.start();
    root.children = [];
    region = null;
    observers[0].fire([{ type: 'childList', target: root, addedNodes: [], removedNodes: [ancestor] } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(states.at(-1)).toBe('CAPTIONS_INACTIVE');
    controller.stop();
  });

  it('observes visibility attributes and stops emitting hidden captions', () => {
    const root = new TestElement('main');
    const block = new TestElement('div', {}, 'Hello');
    const region = new TestElement('div', { 'aria-live': 'polite' }).append(block);
    root.append(region);
    const observers: FakeObserver[] = [];
    const scheduled: Array<() => void> = [];
    const states: string[] = [];
    const controller = createCaptionObserver({
      root: asRoot(root), resolveRegion: () => asElement(region),
      readBlocks: () => block.hasAttribute('hidden') ? [] : [asElement(block)],
      parseBlock: () => ({ speaker: null, text: 'Hello', observedAt: 1 }),
      makeObserver: (callback) => { const observer = new FakeObserver(callback); observers.push(observer); return observer; },
      schedule: (task) => { scheduled.push(task); return scheduled.length; }, cancelSchedule: () => undefined,
      addNavigationListener: () => undefined, removeNavigationListener: () => undefined,
      onState: (state) => states.push(state), onObservation: () => undefined,
    });
    controller.start();
    expect(observers[1].targets[0].options).toMatchObject({ attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'inert', 'style', 'class'] });
    block.attributes.hidden = '';
    observers[1].fire([{ type: 'attributes', target: block, attributeName: 'hidden' } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(states.at(-1)).toBe('CAPTIONS_INACTIVE');
    controller.stop();
  });

  it('resets history on SPA navigation and emits waiting before rediscovery', () => {
    const root = new TestElement('main');
    const region = new TestElement('div').append(new TestElement('div', {}, 'Hello'));
    root.append(region);
    let navigate!: () => void;
    const scheduled: Array<() => void> = [];
    const states: string[] = [];
    const controller = createCaptionObserver({
      root: asRoot(root), resolveRegion: () => asElement(region),
      readBlocks: () => region.children.map(asElement),
      parseBlock: (block) => ({ speaker: null, text: (block as unknown as TestElement).textContent, observedAt: 1 }),
      makeObserver: (callback) => new FakeObserver(callback),
      schedule: (task) => { scheduled.push(task); return scheduled.length; }, cancelSchedule: () => undefined,
      addNavigationListener: (listener) => { navigate = listener; }, removeNavigationListener: () => undefined,
      onState: (state) => states.push(state), onObservation: () => undefined,
    });
    controller.start();
    navigate();
    expect(states.at(-1)).toBe('CAPTIONS_WAITING');
    scheduled.shift()?.();
    expect(states.at(-1)).toBe('CAPTIONS_ACTIVE');
    controller.stop();
  });

  it('does not search globally for irrelevant mutations while no region exists', () => {
    const root = new TestElement('main');
    const resolveRegion = vi.fn(() => null);
    const observers: FakeObserver[] = [];
    const scheduled: Array<() => void> = [];
    const controller = createCaptionObserver({
      root: asRoot(root), resolveRegion,
      makeObserver: (callback) => { const observer = new FakeObserver(callback); observers.push(observer); return observer; },
      schedule: (task) => { scheduled.push(task); return scheduled.length; }, cancelSchedule: () => undefined,
      addNavigationListener: () => undefined, removeNavigationListener: () => undefined,
      onState: () => undefined, onObservation: () => undefined,
    });
    controller.start();
    expect(resolveRegion).toHaveBeenCalledOnce();
    const irrelevant = new TestElement('div', { 'aria-label': 'Toolbar' });
    observers[0].fire([
      { type: 'characterData', target: irrelevant } as unknown as MutationRecord,
      { type: 'childList', target: root, addedNodes: [irrelevant], removedNodes: [] } as unknown as MutationRecord,
    ]);
    expect(scheduled).toHaveLength(0);
    expect(resolveRegion).toHaveBeenCalledOnce();
    controller.stop();
  });

  it('discovers an existing empty caption region when it receives a caption block', () => {
    const root = new TestElement('main');
    const candidate = new TestElement('div', { 'aria-live': 'polite', 'aria-label': 'Captions' });
    root.append(candidate);
    let selected = false;
    const resolveRegion = vi.fn(() => selected ? asElement(candidate) : null);
    const observers: FakeObserver[] = [];
    const scheduled: Array<() => void> = [];
    const states: string[] = [];
    const controller = createCaptionObserver({
      root: asRoot(root), resolveRegion,
      readBlocks: (region) => (region as unknown as TestElement).children.map(asElement),
      parseBlock: (block) => ({ speaker: null, text: (block as unknown as TestElement).textContent, observedAt: 1 }),
      makeObserver: (callback) => { const observer = new FakeObserver(callback); observers.push(observer); return observer; },
      schedule: (task) => { scheduled.push(task); return scheduled.length; }, cancelSchedule: () => undefined,
      addNavigationListener: () => undefined, removeNavigationListener: () => undefined,
      onState: (state) => states.push(state), onObservation: () => undefined,
    });
    controller.start();
    const caption = new TestElement('span', { 'data-caption-text': 'true' }, 'Hello');
    candidate.append(caption);
    selected = true;
    observers[0].fire([{
      type: 'childList',
      target: candidate,
      addedNodes: [caption],
      removedNodes: [],
    } as unknown as MutationRecord]);
    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(resolveRegion).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe('CAPTIONS_ACTIVE');
    controller.stop();
  });

  it.each([
    ['hidden', ''],
    ['inert', ''],
    ['style', 'display: none'],
  ])('reacts when an external ancestor toggles %s', (attribute, value) => {
    const root = new TestElement('main');
    const ancestor = new TestElement('section');
    const block = new TestElement('div', { 'data-is-caption': 'true' }, 'Hello');
    const region = new TestElement('div', { 'aria-live': 'polite', 'aria-label': 'Captions' }).append(block);
    ancestor.append(region);
    root.append(ancestor);
    const observers: FakeObserver[] = [];
    const scheduled: Array<() => void> = [];
    const states: string[] = [];
    const controller = createCaptionObserver({
      root: asRoot(root), resolveRegion: () => asElement(region), readBlocks: findCaptionBlocks,
      parseBlock: () => ({ speaker: null, text: 'Hello', observedAt: 1 }),
      makeObserver: (callback) => { const observer = new FakeObserver(callback); observers.push(observer); return observer; },
      schedule: (task) => { scheduled.push(task); return scheduled.length; }, cancelSchedule: () => undefined,
      addNavigationListener: () => undefined, removeNavigationListener: () => undefined,
      onState: (state) => states.push(state), onObservation: () => undefined,
    });
    controller.start();
    expect(observers[0].targets[0].options).toMatchObject({
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'inert', 'style', 'class'],
    });
    expect(observers[1].targets[0].options.attributeFilter).toContain('inert');
    ancestor.attributes[attribute] = value;
    observers[0].fire([{ type: 'attributes', target: ancestor, attributeName: attribute } as unknown as MutationRecord]);
    scheduled.shift()?.();
    expect(states.at(-1)).toBe('CAPTIONS_INACTIVE');
    controller.stop();
  });
});

class FakeObserver implements ObserverLike {
  targets: Array<{ target: Node | ParentNode; options: MutationObserverInit }> = [];
  disconnects = 0;

  constructor(private readonly callback: MutationCallback) {}

  observe(target: Node, options: MutationObserverInit): void {
    this.targets.push({ target, options });
  }

  disconnect(): void {
    this.disconnects += 1;
  }

  fire(records: MutationRecord[] = []): void {
    this.callback(records, this as unknown as MutationObserver);
  }
}
