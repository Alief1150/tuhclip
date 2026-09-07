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

  it('Case E: keeps a long progressive paragraph in exactly one turn', () => {
    const words = ['saya', 'ingin', 'bertanya', 'mengenai', 'jaringan', 'yang', 'tadi', 'pagi', 'dibahas',
      'bersama', 'tim', 'infrastruktur', 'dan', 'keamanan', 'serta', 'rencana', 'migrasi', 'berikutnya',
      'untuk', 'kuartal', 'depan'];
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    let text = '';
    words.forEach((word, index) => {
      text = text ? `${text} ${word}` : word;
      turns.ingestChunk(chunk('Alief', text, index * 200, index * 200 + 100));
    });
    turns.finalizeOpen(words.length * 200);
    expect(turns.finalizedTurns).toHaveLength(1);
    expect(turns.finalizedTurns[0].text).toBe(text);
  });

  it('merges a rolling caption window without repetition', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('Alief', 'A B C D E', 0, 500));
    const result = turns.ingestChunk(chunk('Alief', 'C D E F', 600, 1100));
    expect(result.created).toBe(false);
    expect(turns.openTurn?.text).toBe('A B C D E F');
    turns.finalizeOpen(2000);
    expect(turns.finalizedTurns).toHaveLength(1);
  });

  it('ignores re-emitted stale rows from a full-region rescan', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    turns.ingestChunk(chunk('Alief', 'A B C', 0, 500));
    const result = turns.ingestChunk(chunk('Alief', 'A B', 600, 1100));
    expect(result.created).toBe(false);
    expect(turns.openTurn?.text).toBe('A B C');
    turns.finalizeOpen(2000);
    expect(turns.finalizedTurns).toHaveLength(1);
  });

  it('real QA pattern: shared-base revisions keep the base exactly once', () => {
    const base = 'halo hai teman teman semua apa kabar di sini ada rafli';
    const tails = [
      'nunggu di',
      'ya pak saya tunggu untuk memastikan',
      'ya bahasa',
      'tisu galon',
      'sebenarnya pakai',
      'sekarang ini adalah tes terbaru',
    ];
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    tails.forEach((tail, index) => {
      turns.ingestChunk(chunk('Alief', `${base} ${tail}`, index * 1000, index * 1000 + 500));
    });
    turns.finalizeOpen(tails.length * 1000);
    expect(turns.finalizedTurns).toHaveLength(1);
    const text = turns.finalizedTurns[0].text;
    const baseOccurrences = text.split(base).length - 1;
    expect(baseOccurrences).toBe(1);
    expect(text.endsWith('sekarang ini adalah tes terbaru')).toBe(true);
  });

  it('long mixed stress: 30 updates keep one turn with every continuation', () => {
    const turns = new SpeakerTurnAggregator({ meetingId: 'm1' });
    let text = 'mulai';
    const uniqueWords = new Set<string>(['mulai']);
    for (let i = 1; i <= 30; i += 1) {
      const step = i % 6;
      if (step === 0) {
        text += ` lanjut${i}`;
        uniqueWords.add(`lanjut${i}`);
      } else if (step === 1) {
        const words = text.split(' ');
        text = [...words.slice(-3), `geser${i}`].join(' ');
        uniqueWords.add(`geser${i}`);
      } else if (step === 2) {
        uniqueWords.add(text.split(' ').pop() ?? '');
      } else if (step === 3) {
        const words = text.split(' ');
        text = [...words.slice(0, -1), `revisi${i}`].join(' ');
        uniqueWords.add(`revisi${i}`);
      } else if (step === 4) {
        text = `${text}.`;
      }
      turns.ingestChunk(chunk('Alief', text, i * 300, i * 300 + 100));
    }
    turns.finalizeOpen(30 * 300 + 500);
    expect(turns.finalizedTurns).toHaveLength(1);
    const final = turns.finalizedTurns[0].text;
    for (const word of uniqueWords) {
      if (word) expect(final).toContain(word);
    }
    const firstWords = final.split(' ').slice(0, 4).join(' ');
    expect(final.split(firstWords).length - 1).toBeLessThanOrEqual(2);
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
