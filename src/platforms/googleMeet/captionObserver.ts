import { createLogger } from '../../shared/logger';
import { normalizeForComparison } from '../../transcript/normalization';
import { parseCaptionBlock, rowKeyFor } from './captionParser';
import { containsCaptionRegionCandidate, findCaptionBlocks, findCaptionRegion } from './selectors';
import type { CaptionObservation, MeetStateSignal } from './types';

const logger = createLogger('caption');

export type ObserverLike = Pick<MutationObserver, 'observe' | 'disconnect'>;

type CaptionObserverOptions = {
  root?: ParentNode;
  resolveRegion?: (root: ParentNode) => Element | null;
  readBlocks?: (region: Element) => Element[];
  parseBlock?: (block: Element) => CaptionObservation | null;
  makeObserver?: (callback: MutationCallback) => ObserverLike;
  schedule?: (task: () => void) => number;
  cancelSchedule?: (handle: number) => void;
  addNavigationListener?: (listener: () => void) => void;
  removeNavigationListener?: (listener: () => void) => void;
  onState: (state: MeetStateSignal) => void;
  onObservation: (observation: CaptionObservation) => void;
};

export type CaptionObserver = { start: () => void; stop: () => void; refresh: () => void };

type NavigationTarget = {
  history: {
    pushState: (...args: any[]) => unknown;
    replaceState: (...args: any[]) => unknown;
  };
  addEventListener: (name: string, listener: () => void) => void;
  removeEventListener: (name: string, listener: () => void) => void;
};

type NavigationState = {
  listeners: Set<() => void>;
  originalPushState: NavigationTarget['history']['pushState'];
  originalReplaceState: NavigationTarget['history']['replaceState'];
  pushState: NavigationTarget['history']['pushState'];
  replaceState: NavigationTarget['history']['replaceState'];
  dispatch: () => void;
};

const navigationStates = new WeakMap<object, NavigationState>();

export function subscribeToSpaNavigation(target: NavigationTarget, listener: () => void): () => void {
  let state = navigationStates.get(target);
  if (!state) {
    const listeners = new Set<() => void>();
    const originalPushState = target.history.pushState;
    const originalReplaceState = target.history.replaceState;
    const dispatch = () => listeners.forEach((subscriber) => subscriber());
    const pushState = function (this: unknown, ...args: any[]) {
      const result = originalPushState.apply(this, args);
      dispatch();
      return result;
    };
    const replaceState = function (this: unknown, ...args: any[]) {
      const result = originalReplaceState.apply(this, args);
      dispatch();
      return result;
    };
    state = { listeners, originalPushState, originalReplaceState, pushState, replaceState, dispatch };
    navigationStates.set(target, state);
    target.history.pushState = pushState;
    target.history.replaceState = replaceState;
    target.addEventListener('popstate', dispatch);
    target.addEventListener('hashchange', dispatch);
  }
  state.listeners.add(listener);
  return () => {
    if (!state) return;
    state.listeners.delete(listener);
    if (state.listeners.size > 0) return;
    if (target.history.pushState === state.pushState) target.history.pushState = state.originalPushState;
    if (target.history.replaceState === state.replaceState) target.history.replaceState = state.originalReplaceState;
    target.removeEventListener('popstate', state.dispatch);
    target.removeEventListener('hashchange', state.dispatch);
    navigationStates.delete(target);
  };
}

export function createCaptionObserver(options: CaptionObserverOptions): CaptionObserver {
  const root = options.root ?? document;
  const resolveRegion = options.resolveRegion ?? findCaptionRegion;
  const readBlocks = options.readBlocks ?? findCaptionBlocks;
  const parseBlock = options.parseBlock ?? parseCaptionBlock;
  const makeObserver = options.makeObserver ?? ((callback) => new MutationObserver(callback));
  const schedule = options.schedule ?? ((task) => window.setTimeout(task, 0));
  const cancelSchedule = options.cancelSchedule ?? window.clearTimeout.bind(window);

  let started = false;
  let scheduled: number | undefined;
  let pending: 'read' | 'discover' | undefined;
  let region: Element | null = null;
  let hadRegion = false;
  let hadCaption = false;
  let state: MeetStateSignal | undefined;
  let discoveryObserver: ObserverLike | undefined;
  let regionObserver: ObserverLike | undefined;
  let navigationCleanup: (() => void) | undefined;
  let searchLogged = false;
  let rowKeyCounter = 0;
  const rowKeysByElement = new WeakMap<object, string>();
  const lastTextByRowKey = new Map<string, string>();

  const rowKey = (block: Element): string => {
    const explicit = rowKeyFor(block);
    if (explicit) return `id:${explicit}`;
    let key = rowKeysByElement.get(block);
    if (!key) {
      rowKeyCounter += 1;
      key = `element#${rowKeyCounter}`;
      rowKeysByElement.set(block, key);
      logger.debug('New caption row tracked', key);
    }
    return key;
  };

  const forgetStaleRows = (seen: Set<string>): void => {
    for (const key of lastTextByRowKey.keys()) {
      if (!seen.has(key)) lastTextByRowKey.delete(key);
    }
  };

  const emitState = (next: MeetStateSignal) => {
    if (state === next) return;
    state = next;
    logger.debug('Caption status changed', next);
    options.onState(next);
  };

  const read = () => {
    if (!region) return;
    const blocks = readBlocks(region);
    logger.debug('Caption row count', blocks.length);
    const seen = new Set<string>();
    let foundCaption = false;
    for (const block of blocks) {
      logger.debug('Raw row text', block.textContent?.trim() ?? '');
      const observation = parseBlock(block);
      if (!observation) continue;
      foundCaption = true;
      hadCaption = true;
      const key = rowKey(block);
      seen.add(key);
      const normalized = normalizeForComparison(observation.text);
      if (lastTextByRowKey.get(key) === normalized) {
        logger.debug('Row unchanged, observation suppressed', key);
        continue;
      }
      lastTextByRowKey.set(key, normalized);
      logger.debug('Row emitted', key);
      logger.debug('Speaker parsed', observation.speaker);
      logger.debug('Caption text parsed', observation.text);
      logger.debug('Parsed caption', observation.text);
      options.onObservation(observation);
    }
    forgetStaleRows(seen);
    emitState(foundCaption ? 'CAPTIONS_ACTIVE' : hadCaption ? 'CAPTIONS_INACTIVE' : 'CAPTIONS_WAITING');
  };

  const discover = () => {
    scheduled = undefined;
    pending = undefined;
    if (!started) return;
    const nextRegion = resolveRegion(root);
    if (nextRegion && nextRegion === region) {
      read();
      return;
    }

    regionObserver?.disconnect();
    regionObserver = undefined;
    if (region) logger.debug('Caption region lost');
    if (nextRegion !== region) lastTextByRowKey.clear();
    region = nextRegion;

    if (!region) {
      if (!searchLogged) {
        searchLogged = true;
        logger.debug('Searching for caption region');
      }
      emitState(hadRegion ? 'CAPTIONS_INACTIVE' : 'CAPTIONS_WAITING');
      return;
    }

    searchLogged = false;
    logger.debug('Caption region found');
    if (hadRegion) logger.debug('Observer reattached');
    hadRegion = true;
    regionObserver = makeObserver(() => queue('read'));
    regionObserver.observe(region, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'inert', 'style', 'class'],
    });
    read();
  };

  function runPending(): void {
    const task = pending;
    scheduled = undefined;
    pending = undefined;
    if (!started) return;
    if (task === 'discover') discover();
    else if (region && (root as unknown as { contains?: (node: Element) => boolean }).contains?.(region) !== false) read();
    else discover();
  }

  function queue(task: 'read' | 'discover'): void {
    if (!started) return;
    if (task === 'discover') pending = 'discover';
    else pending ??= 'read';
    if (scheduled === undefined) scheduled = schedule(runPending);
  }

  const onDiscovery = (records: MutationRecord[]) => {
    if (region && (root as unknown as { contains?: (node: Element) => boolean }).contains?.(region) === false) {
      queue('discover');
      return;
    }
    if (region && records.some((record) => record.type === 'attributes'
      && ((record.target as Element) === region || (record.target as Element).contains?.(region)))) {
      queue('read');
      return;
    }
    if (records.some((record) => record.type === 'childList'
      && (containsCaptionRegionCandidate(record.target)
        || Array.from(record.addedNodes).some(containsCaptionRegionCandidate)))) queue('discover');
  };

  const refresh = () => {
    regionObserver?.disconnect();
    regionObserver = undefined;
    region = null;
    hadRegion = false;
    hadCaption = false;
    lastTextByRowKey.clear();
    emitState('CAPTIONS_WAITING');
    queue('discover');
  };

  return {
    start: () => {
      if (started) return;
      started = true;
      emitState('MEET_DETECTED');
      emitState('CAPTIONS_WAITING');
      discoveryObserver = makeObserver(onDiscovery);
      discoveryObserver.observe(root as Node, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'aria-hidden', 'inert', 'style', 'class'],
      });
      if (options.addNavigationListener && options.removeNavigationListener) {
        options.addNavigationListener(refresh);
        navigationCleanup = () => options.removeNavigationListener?.(refresh);
      } else {
        navigationCleanup = subscribeToSpaNavigation(window, refresh);
      }
      discover();
    },
    stop: () => {
      if (!started) return;
      started = false;
      discoveryObserver?.disconnect();
      regionObserver?.disconnect();
      discoveryObserver = undefined;
      regionObserver = undefined;
      navigationCleanup?.();
      navigationCleanup = undefined;
      if (scheduled !== undefined) cancelSchedule(scheduled);
      scheduled = undefined;
      pending = undefined;
      region = null;
    },
    refresh,
  };
}
