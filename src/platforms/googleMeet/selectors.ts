const REGION_SELECTORS = [
  '[data-caption-region]',
  '[data-subtitle-region]',
  '[role="region"][aria-label]',
  '[jsname="tgaKEf"]',
  '[jsname="YSxPC"]',
  '[role="region"]',
  '[aria-live="polite"]',
  '[aria-live="assertive"]',
] as const;

const MEET_ROW_SELECTOR = 'div[jsname="dsyhDe"],div.CNusmb,div.TBMuR,.nMcdL';

export const CAPTION_BLOCK_SELECTOR = [
  '[data-is-caption="true"]',
  '[data-caption-id]',
  '[data-caption-text]',
  MEET_ROW_SELECTOR,
  '[role="listitem"]',
].join(',');

export const SPEAKER_SELECTOR = [
  '[data-speaker-name]',
  '[data-participant-name]',
  '[data-self-name]',
  '.NWpY1d',
  'div.KcIKyf',
  'div.zs7s8d',
  '[role="heading"]',
].join(',');

export const CAPTION_TEXT_SELECTOR = [
  '[data-caption-text]',
  '[data-is-caption-text="true"]',
  '.ygicle',
  '.VbkSUe',
  'div.bh44bd',
  'div.iTTPOb',
  'span[jsname="tgaKEf"]',
  '[role="paragraph"]',
].join(',');

const captionWords = /caption|subtitle|transcript|sous-titre|untertitel|leyenda|字幕/i;
const excludedWords = /chat|participant|notification/i;
const MEET_REGION_JSNAMES = new Set(['tgaKEf', 'YSxPC']);

function accessibleName(element: Element): string {
  return [
    element.getAttribute('aria-label'),
    element.getAttribute('data-caption-region'),
    element.getAttribute('data-subtitle-region'),
  ].filter(Boolean).join(' ');
}

export function isCaptionRegionCandidate(candidate: Element): boolean {
  const name = accessibleName(candidate);
  if (excludedWords.test(name)) return false;
  if (candidate.hasAttribute('data-caption-region') || candidate.hasAttribute('data-subtitle-region')) return true;
  if (captionWords.test(name)) return true;
  const jsname = candidate.getAttribute('jsname');
  if (jsname && MEET_REGION_JSNAMES.has(jsname)) return true;
  if (candidate.getAttribute('aria-live') && candidate.querySelector('[data-is-caption="true"],[data-caption-id],[data-caption-text]')) return true;
  return Boolean(candidate.querySelector(MEET_ROW_SELECTOR));
}

export function containsCaptionRegionCandidate(node: Node): boolean {
  const candidate = node as unknown as Partial<Element>;
  if (typeof candidate.querySelectorAll !== 'function' || typeof candidate.getAttribute !== 'function') return false;
  if (isCaptionRegionCandidate(candidate as Element)) return true;
  return Array.from(candidate.querySelectorAll(REGION_SELECTORS.join(','))).some(isCaptionRegionCandidate);
}

export function findCaptionRegion(root: ParentNode): Element | null {
  for (const selector of REGION_SELECTORS) {
    for (const candidate of root.querySelectorAll(selector)) {
      if (isCaptionRegionCandidate(candidate)) return candidate;
    }
  }
  return null;
}

export function findCaptionBlocks(region: Element): Element[] {
  const descendants = Array.from(region.querySelectorAll(CAPTION_BLOCK_SELECTOR));
  const candidates = descendants.length > 0 ? descendants : Array.from(region.children);
  return candidates.filter((element) => {
    for (let parent = element.parentElement; parent && parent !== region; parent = parent.parentElement) {
      if (parent.matches(CAPTION_BLOCK_SELECTOR)) return false;
    }
    const text = element.textContent?.trim() || element.querySelector(CAPTION_TEXT_SELECTOR)?.textContent?.trim();
    return Boolean(text) && isVisible(element);
  });
}

function isVisible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('hidden') || current.hasAttribute('inert') || current.getAttribute('aria-hidden') === 'true') return false;
    const inlineStyle = current.getAttribute('style') ?? '';
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(inlineStyle)) return false;
    const view = current.ownerDocument?.defaultView;
    if (view) {
      const style = view.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
  }
  return true;
}
