import { describe, expect, it } from 'vitest';
import {
  isSelfSpeakerAlias,
  resolveMeetingMetadata,
  resolveSpeakerName,
  shouldUpgradeTitle,
  titleQualityFor,
  type MetadataDocument,
} from './meetingMetadata';

const doc = (title: string, selfName: string | null = null): MetadataDocument => ({
  title,
  querySelector: (selector: string) => {
    if (selector === '[data-self-name]' && selfName) return { textContent: selfName };
    return null;
  },
});

describe('meetingMetadata', () => {
  it('resolves a real meeting title and the local display name', () => {
    expect(resolveMeetingMetadata(doc('Kelas Jaringan - Google Meet', 'Alief Athallah'), 'abc-defg-hij')).toEqual({
      title: 'Kelas Jaringan',
      quality: 3,
      localName: 'Alief Athallah',
    });
  });

  it('rejects generic titles and unknown local names', () => {
    expect(resolveMeetingMetadata(doc('Meet', null), 'abc-defg-hij')).toEqual({
      title: null,
      quality: 0,
      localName: null,
    });
    expect(resolveMeetingMetadata(doc('Google Meet - Google Meet', null), 'abc-defg-hij').title).toBeNull();
  });

  it('recognizes localized self aliases extensibly', () => {
    expect(isSelfSpeakerAlias('You')).toBe(true);
    expect(isSelfSpeakerAlias('ANDA')).toBe(true);
    expect(isSelfSpeakerAlias('Mahdi')).toBe(false);
  });

  it('ranks title quality from generic to code fallback to real title', () => {
    expect(titleQualityFor('', 'abc-defg-hij')).toBe(0);
    expect(titleQualityFor('Google Meet', 'abc-defg-hij')).toBe(0);
    expect(titleQualityFor('Meet abc-defg-hij', 'abc-defg-hij')).toBe(1);
    expect(titleQualityFor('Kelas Jaringan', 'abc-defg-hij')).toBe(3);
  });

  it('upgrades titles only toward better quality, never down', () => {
    expect(shouldUpgradeTitle('Google Meet', 0, 'Meet abc-defg-hij', 1)).toBe(true);
    expect(shouldUpgradeTitle('Meet abc-defg-hij', 1, 'Kelas Jaringan', 3)).toBe(true);
    expect(shouldUpgradeTitle('Kelas Jaringan', 3, 'Meet abc-defg-hij', 1)).toBe(false);
    expect(shouldUpgradeTitle('Kelas Jaringan', 3, '   ', 3)).toBe(false);
  });

  it('resolves You to the local name only with real DOM evidence', () => {
    expect(resolveSpeakerName('You', 'Alief Athallah')).toBe('Alief Athallah');
    expect(resolveSpeakerName('you', 'Alief Athallah')).toBe('Alief Athallah');
    expect(resolveSpeakerName('Anda', 'Alief Athallah')).toBe('Alief Athallah');
    expect(resolveSpeakerName('anda', 'Alief Athallah')).toBe('Alief Athallah');
    expect(resolveSpeakerName('You', null)).toBe('You');
    expect(resolveSpeakerName('Anda', null)).toBe('Anda');
    expect(resolveSpeakerName('Mahdi', 'Alief Athallah')).toBe('Mahdi');
    expect(resolveSpeakerName(null, 'Alief Athallah')).toBeNull();
  });
});
