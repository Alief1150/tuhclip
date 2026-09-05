import type { SessionSignals } from '../shared/messages';

export type ViewState = 'not-on-meet' | 'meet-detected' | 'captions-off' | 'transcribing' | 'idle';

export function deriveViewState(signals: SessionSignals): ViewState {
  if (!signals.onMeet) return 'not-on-meet';
  if (!signals.contentReady) return 'meet-detected';
  if (signals.lifecycle === 'ended') return 'idle';
  return signals.lifecycle === 'active' ? 'transcribing' : 'captions-off';
}
