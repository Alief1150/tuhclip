# Phase 3 — Transcript Engine, Reconciliation, and Deduplication

## Goal
Turn noisy progressive live-caption observations into clean finalized transcript segments with correct speakers, timestamps, and no accidental duplicates.

This is the most important phase of the project.

## Problem model
Google Meet captions may progress like:

```text
Alief: "saya"
Alief: "saya ingin"
Alief: "saya ingin bertanya"
```

This must become **one** transcript segment:

```text
Alief: "saya ingin bertanya"
```

Never persist every mutation as a new transcript line.

## Active segment
Maintain one active segment in memory.

Suggested shape:

```ts
interface ActiveSegment {
  id: string;
  speaker: string;
  text: string;
  normalizedText: string;
  startedAt: number;
  updatedAt: number;
  sourceId?: string;
  finalized: false;
}
```

Persist only finalized segments.

## Reconciliation rules
For the same active caption/speaker:
- if text extends progressively, replace/update active text
- if only whitespace/casing representation changes, do not create a new segment
- if identical text is observed repeatedly, ignore it

Finalize when appropriate:
1. speaker changes
2. caption block disappears
3. source caption block is replaced by a new independent one
4. caption is unchanged for a configurable inactivity timeout
5. navigation/meeting end invalidates the active caption

Use a configurable inactivity timeout around 1500–2500 ms.

## Text normalization
For comparison only:
- trim
- collapse repeated whitespace
- lowercase or locale-safe case normalization
- normalize harmless punctuation/spacing differences conservatively

Do not destructively rewrite the user's actual transcript text beyond simple display cleanup.

## Deduplication layers
Implement more than one guard.

### Layer 1 — active mutation guard
Same active speaker + same normalized text = no-op.

### Layer 2 — finalized fingerprint
Create a fingerprint such as:

```text
speaker + normalizedText
```

### Layer 3 — recent cache
Keep a small recent finalized-segment cache.

Reject a segment when:
- same speaker
- same normalized text
- appears again within a short duplicate window

Do not globally blacklist the text forever.

The same person must be allowed to genuinely repeat the same sentence minutes later.

## Timestamp model
Use browser local time, not Meet's displayed timestamps.

Persist:

```ts
interface TranscriptSegment {
  id: string;
  meetingId: string;
  speaker: string;
  text: string;
  startedAt: number;
  endedAt: number;
  relativeStartMs: number;
}
```

Use `Date.now()` as the source of truth.

Support UI display for:
- absolute local time, e.g. `19:32:14`
- relative meeting time, e.g. `00:12:34`

## Required automated tests
Implement tests for at least:

### Case 1 — progressive caption
Input:
```text
saya
saya ingin
saya ingin bertanya
```
Expected: one finalized segment with `saya ingin bertanya`.

### Case 2 — repeated observer event
Same caption observation 5 times.
Expected: one segment.

### Case 3 — speaker change
```text
Alief: Halo semuanya
Mahdi: Halo Lif
```
Expected: two segments.

### Case 4 — whitespace-only change
Expected: no new segment.

### Case 5 — genuine repetition much later
Same speaker repeats the same sentence outside the duplicate window.
Expected: both segments are preserved.

### Case 6 — caption toggled off/on
Expected: active state finalizes safely and later transcription resumes.

## Verification before Phase 4
All transcript-engine unit tests must pass.
Run:
- tests
- typecheck
- build

Update `DEVLOG.md` with the exact reconciliation strategy used.
