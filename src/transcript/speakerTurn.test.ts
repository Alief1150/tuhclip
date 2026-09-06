import { describe, expect, it } from 'vitest';
import { SpeakerTurnAggregator } from './speakerTurn';

const chunk = (speaker: string, text: string, startedAt: number, endedAt: number) => ({
  id: `chunk-${startedAt}`,
  meetingId: 'm1',
  speaker,
  text,
  startedAt,
  endedAt,
  relativeStartMs: startedAt,
});

describe('SpeakerTurnAggregator', () => {
  it('TEST A: merges progressive cumulative captions into one turn', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('You', 'halo', 0, 500));
    turns.ingestChunk(chunk('You', 'halo bandung', 600, 1100));
    const result = turns.ingestChunk(chunk('You', 'halo bandung sudah lama beta', 1200, 1700));
    expect(result.created).toBe(false);
    const open = turns.openTurn;
    expect(open?.text).toBe('halo bandung sudah lama beta');
    turns.finalizeOpen(2000);
    expect(turns.finalizedTurns).toHaveLength(1);
  });

  it('TEST B: keeps same-speaker chunks across a short pause in one turn', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('Alief', 'saya ingin bertanya', 0, 1000));
    const result = turns.ingestChunk(chunk('Alief', 'mengenai jaringan', 4000, 5000));
    expect(result.created).toBe(false);
    expect(turns.openTurn?.text).toBe('saya ingin bertanya mengenai jaringan');
    turns.finalizeOpen(6000);
    expect(turns.finalizedTurns).toHaveLength(1);
  });

  it('TEST C: splits turns on speaker switch', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('Alief', 'halo', 0, 500));
    turns.ingestChunk(chunk('Mahdi', 'iya', 600, 1100));
    turns.finalizeOpen(2000);
    expect(turns.finalizedTurns).toHaveLength(2);
    expect(turns.finalizedTurns.map((turn) => turn.speaker)).toEqual(['Alief', 'Mahdi']);
  });

  it('TEST D: drops exact duplicate chunks', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    for (let i = 0; i < 5; i += 1) {
      turns.ingestChunk(chunk('Alief', 'Halo semuanya', i * 100, i * 100 + 50));
    }
    turns.finalizeOpen(1000);
    expect(turns.finalizedTurns).toHaveLength(1);
  });

  it('TEST E: extends a recently finalized turn instead of inserting', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('You', 'halo bandung', 0, 500));
    turns.finalizeOpen(1000);
    const result = turns.ingestChunk(chunk('You', 'halo bandung sudah lama beta', 5000, 5500));
    expect(result.created).toBe(false);
    expect(result.reopened).toBe(true);
    turns.finalizeOpen(6000);
    expect(turns.finalizedTurns).toHaveLength(1);
    expect(turns.finalizedTurns[0].text).toBe('halo bandung sudah lama beta');
  });

  it('reconnect replay extends the seeded turn instead of duplicating', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.seedLastFinalized({ id: 'turn-old', speaker: 'Alief', text: 'jadi tugas dikumpulkan besok', endedAt: 1000 });
    const result = turns.ingestChunk(chunk('Alief', 'jadi tugas dikumpulkan besok pagi', 5000, 5500));
    expect(result.created).toBe(false);
    expect(result.turn.id).toBe('turn-old');
    expect(result.turn.text).toBe('jadi tugas dikumpulkan besok pagi');
    turns.finalizeOpen(6000);
    expect(turns.finalizedTurns).toHaveLength(1);
  });

  it('TEST F: allows genuine repetition minutes later', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('Alief', 'terima kasih', 0, 500));
    turns.finalizeOpen(1000);
    turns.ingestChunk(chunk('Alief', 'terima kasih', 300_000, 300_500));
    turns.finalizeOpen(301_000);
    expect(turns.finalizedTurns).toHaveLength(2);
  });

  it('TEST G: treats whitespace/punctuation/casing-only differences as the same', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('Alief', 'halo   bandung', 0, 500));
    turns.ingestChunk(chunk('Alief', 'halo bandung', 600, 1100));
    turns.ingestChunk(chunk('Alief', 'halo bandung.', 1200, 1700));
    turns.ingestChunk(chunk('Alief', 'HALO BANDUNG', 1800, 2300));
    turns.finalizeOpen(3000);
    expect(turns.finalizedTurns).toHaveLength(1);
  });
});
