import { useEffect, useState } from 'react';
import { StarIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { createLogger } from '../shared/logger';

const logger = createLogger('ui');

const REPO_URL = 'https://github.com/Alief1150/tuhclip';
const CACHE_MS = 10 * 60 * 1000;

let cachedCount: number | null = null;
let cachedAt = 0;

async function fetchStarCount(): Promise<number | null> {
  if (cachedCount !== null && Date.now() - cachedAt < CACHE_MS) return cachedCount;
  try {
    const response = await fetch('https://api.github.com/repos/Alief1150/tuhclip');
    if (!response.ok) return null;
    const data = (await response.json()) as { stargazers_count?: unknown };
    if (typeof data.stargazers_count !== 'number') return null;
    cachedCount = data.stargazers_count;
    cachedAt = Date.now();
    return cachedCount;
  } catch (cause) {
    logger.debug('Star count unavailable', cause);
    return null;
  }
}

export function StarButton() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchStarCount().then((count) => {
      if (!cancelled) setStars(count);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={stars === null ? 'Star tuhclip on GitHub' : `Star tuhclip on GitHub, ${stars} stars`}
      onClick={() => void chrome.tabs.create({ url: REPO_URL })}
    >
      <StarIcon aria-hidden="true" />
      {stars === null ? 'Star' : `Star ${stars}`}
    </Button>
  );
}
