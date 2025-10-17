import { describe, it, expect, beforeEach } from '@jest/globals';
import { BeatTimeConverter } from '../BeatTimeConverter';
import { MusicalNote, SongMemo } from '../../types/index';

describe('BeatTimeConverter', () => {
  let converter: BeatTimeConverter;

  beforeEach(() => {
    converter = new BeatTimeConverter(120); // BPM 120
  });

  describe('constructor', () => {
    it('デフォルトBPM120で初期化される', () => {
      const defaultConverter = new BeatTimeConverter();
      expect(defaultConverter.getBPM()).toBe(120);
    });

    it('指定したBPMで初期化される', () => {
      const customConverter = new BeatTimeConverter(90);
      expect(customConverter.getBPM()).toBe(90);
    });
  });

  describe('beatsToMs', () => {
    it('拍をミリ秒に正しく変換する', () => {
      // BPM 120 = 1拍 = 500ms (60000ms/120)
      expect(converter.beatsToMs(1)).toBe(500);
      expect(converter.beatsToMs(2)).toBe(1000);
      expect(converter.beatsToMs(4)).toBe(2000);
      expect(converter.beatsToMs(0.5)).toBe(250);
    });

    it('0拍を処理できる', () => {
      expect(converter.beatsToMs(0)).toBe(0);
    });
  });

  describe('msToBeats', () => {
    it('ミリ秒を拍に正しく変換する', () => {
      // BPM 120 = 500ms = 1拍
      expect(converter.msToBeats(500)).toBe(1);
      expect(converter.msToBeats(1000)).toBe(2);
      expect(converter.msToBeats(2000)).toBe(4);
      expect(converter.msToBeats(250)).toBe(0.5);
    });

    it('0ミリ秒を処理できる', () => {
      expect(converter.msToBeats(0)).toBe(0);
    });
  });

  describe('setBPM and getBPM', () => {
    it('BPMを正しく更新する', () => {
      converter.setBPM(90);
      expect(converter.getBPM()).toBe(90);
    });

    it('無効なBPMでエラーを投げる', () => {
      expect(() => converter.setBPM(0)).toThrow('BPM must be greater than 0');
      expect(() => converter.setBPM(-10)).toThrow('BPM must be greater than 0');
    });

    it('BPM変更後、拍-時間変換に影響する', () => {
      converter.setBPM(60); // 1拍 = 1000ms
      expect(converter.beatsToMs(1)).toBe(1000);
      expect(converter.msToBeats(1000)).toBe(1);
    });
  });

  describe('convertNote', () => {
    it('音楽的ノートを時間ベースノートに変換する', () => {
      const musicalNote: MusicalNote = {
        pitch: 60,
        timing: { beat: 2, duration: 1 },
        velocity: 80
      };

      const result = converter.convertNote(musicalNote);

      expect(result.pitch).toBe(60);
      expect(result.startTime).toBe(1000); // 2拍 * 500ms
      expect(result.duration).toBe(500);   // 1拍 * 500ms
      expect(result.velocity).toBe(80);
    });

    it('0拍目のノートを処理できる', () => {
      const musicalNote: MusicalNote = {
        pitch: 72,
        timing: { beat: 0, duration: 0.5 },
        velocity: 100
      };

      const result = converter.convertNote(musicalNote);

      expect(result.startTime).toBe(0);
      expect(result.duration).toBe(250); // 0.5拍 * 500ms
    });
  });

  describe('convertNotes', () => {
    it('音楽的ノート配列を変換する', () => {
      const musicalNotes: MusicalNote[] = [
        { pitch: 60, timing: { beat: 0, duration: 1 }, velocity: 80 },
        { pitch: 62, timing: { beat: 1, duration: 1 }, velocity: 85 },
        { pitch: 64, timing: { beat: 2, duration: 1 }, velocity: 90 }
      ];

      const results = converter.convertNotes(musicalNotes);

      expect(results).toHaveLength(3);
      expect(results[0]!.startTime).toBe(0);
      expect(results[1]!.startTime).toBe(500);
      expect(results[2]!.startTime).toBe(1000);
    });

    it('空配列を処理できる', () => {
      const results = converter.convertNotes([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('convertToMusicalNote', () => {
    it('時間ベースノートを音楽的ノートに変換する', () => {
      const note = {
        pitch: 60,
        startTime: 1000,
        duration: 500,
        velocity: 80
      };

      const result = converter.convertToMusicalNote(note);

      expect(result.pitch).toBe(60);
      expect(result.timing.beat).toBe(2);
      expect(result.timing.duration).toBe(1);
      expect(result.velocity).toBe(80);
    });
  });

  describe('convertMemo', () => {
    it('SongMemoを時間ベースMemoに変換する', () => {
      const songMemo: SongMemo = {
        timing: { beat: 4 },
        text: 'Cメジャーコード',
        align: 'center',
        color: 'blue'
      };

      const result = converter.convertMemo(songMemo);

      expect(result.startTime).toBe(2000); // 4拍 * 500ms
      expect(result.text).toBe('Cメジャーコード');
      expect(result.align).toBe('center');
      expect(result.color).toBe('blue');
    });

    it('オプションフィールドにデフォルト値を使用する', () => {
      const songMemo: SongMemo = {
        timing: { beat: 0 },
        text: 'Test'
      };

      const result = converter.convertMemo(songMemo);

      expect(result.align).toBe('center');
      expect(result.color).toBe('default');
    });
  });

  describe('convertMemos', () => {
    it('メモ配列を変換する', () => {
      const songMemos: SongMemo[] = [
        { timing: { beat: 0 }, text: 'Memo 1', color: 'blue' },
        { timing: { beat: 2 }, text: 'Memo 2', color: 'green' },
        { timing: { beat: 4 }, text: 'Memo 3', align: 'left', color: 'purple' }
      ];

      const results = converter.convertMemos(songMemos);

      expect(results).toHaveLength(3);
      expect(results[0]!.startTime).toBe(0);
      expect(results[1]!.startTime).toBe(1000);
      expect(results[2]!.startTime).toBe(2000);
      expect(results[2]!.align).toBe('left');
    });

    it('空配列を処理できる', () => {
      const results = converter.convertMemos([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('getQuarterNoteMs', () => {
    it('四分音符の長さをミリ秒で返す', () => {
      expect(converter.getQuarterNoteMs()).toBe(500); // 120 BPM
    });

    it('BPM変更時に更新される', () => {
      converter.setBPM(60);
      expect(converter.getQuarterNoteMs()).toBe(1000);
    });
  });

  describe('getQuarterNoteMsForBPM (static)', () => {
    it('指定BPMの四分音符の長さを計算する', () => {
      expect(BeatTimeConverter.getQuarterNoteMsForBPM(120)).toBe(500);
      expect(BeatTimeConverter.getQuarterNoteMsForBPM(60)).toBe(1000);
      expect(BeatTimeConverter.getQuarterNoteMsForBPM(180)).toBeCloseTo(333.33, 2);
    });
  });
});
