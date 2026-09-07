import { describe, expect, it } from 'vitest';
import { reconcileSnapshots } from './normalization';

describe('reconcileSnapshots', () => {
  it('classifies exact duplicates', () => {
    expect(reconcileSnapshots('Halo Bandung', 'halo  bandung').kind).toBe('EXACT');
  });

  it('classifies extension and rollback', () => {
    expect(reconcileSnapshots('halo', 'halo bandung').kind).toBe('EXTENSION');
    expect(reconcileSnapshots('halo bandung', 'halo').kind).toBe('ROLLBACK');
  });

  it('classifies rolling overlap and appends only the delta', () => {
    const result = reconcileSnapshots('A B C D E', 'C D E F');
    expect(result.kind).toBe('ROLLING_OVERLAP');
    expect(result.merged).toBe('A B C D E F');
  });

  it('classifies a long shared-prefix revision and replaces the tail', () => {
    const result = reconcileSnapshots(
      'halo semua hari ini saya mau pergi ke kantor',
      'halo semua hari ini saya mau pergi ke kampus',
    );
    expect(result.kind).toBe('PREFIX_REVISION');
    expect(result.merged).toBe('halo semua hari ini saya mau pergi ke kampus');
  });

  it('does not treat tiny shared prefixes as revision evidence', () => {
    expect(reconcileSnapshots('ya pergi', 'ya datang').kind).toBe('NEW_CONTENT');
    expect(reconcileSnapshots('dan ini', 'dan itu').kind).toBe('NEW_CONTENT');
  });

  it('classifies disjoint content as new', () => {
    const result = reconcileSnapshots('selamat datang', 'hari ini kita belajar jaringan');
    expect(result.kind).toBe('NEW_CONTENT');
    expect(result.merged).toBeNull();
  });
});
