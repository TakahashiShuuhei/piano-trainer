import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ContentLoader } from '../ContentLoader';

describe('ContentLoader', () => {
  let loader: ContentLoader;

  beforeEach(() => {
    loader = new ContentLoader();
  });

  describe('validateSongData', () => {
    it('正しい楽曲データを検証する', () => {
      const validData = {
        title: 'Test Song',
        bpm: 120,
        notes: [
          { pitch: 60, timing: { beat: 0, duration: 1 }, velocity: 80 }
        ]
      };

      const result = (loader as any).validateSongData(validData);

      expect(result.title).toBe('Test Song');
      expect(result.bpm).toBe(120);
      expect(result.notes).toHaveLength(1);
    });

    it('BPM未指定時はデフォルト値を使用する', () => {
      const dataWithoutBPM = {
        title: 'Test Song',
        notes: []
      };

      const result = (loader as any).validateSongData(dataWithoutBPM);

      expect(result.bpm).toBe(120);
    });

    it('タイトルがない場合エラーを投げる', () => {
      const invalidData = {
        bpm: 120,
        notes: []
      };

      expect(() => (loader as any).validateSongData(invalidData))
        .toThrow('楽曲タイトルが必要です');
    });

    it('BPMが範囲外の場合エラーを投げる', () => {
      const invalidData = {
        title: 'Test',
        bpm: 50,
        notes: []
      };

      expect(() => (loader as any).validateSongData(invalidData))
        .toThrow('BPMは60-200の範囲で指定してください');
    });

    it('notesが配列でない場合エラーを投げる', () => {
      const invalidData = {
        title: 'Test',
        notes: 'not an array'
      };

      expect(() => (loader as any).validateSongData(invalidData))
        .toThrow('notesは配列である必要があります');
    });
  });

  describe('validateSongNote', () => {
    it('正しいノートを検証する', () => {
      const validNote = {
        pitch: 60,
        timing: { beat: 0, duration: 1 },
        velocity: 80
      };

      expect(() => (loader as any).validateSongNote(validNote, 0)).not.toThrow();
    });

    it('pitchが範囲外の場合エラーを投げる', () => {
      const invalidNote = {
        pitch: 128,
        timing: { beat: 0 }
      };

      expect(() => (loader as any).validateSongNote(invalidNote, 0))
        .toThrow('pitchは0-127の範囲で指定してください');
    });

    it('beatが負の場合エラーを投げる', () => {
      const invalidNote = {
        pitch: 60,
        timing: { beat: -1 }
      };

      expect(() => (loader as any).validateSongNote(invalidNote, 0))
        .toThrow('beatは0以上の数値で指定してください');
    });

    it('durationが0以下の場合エラーを投げる', () => {
      const invalidNote = {
        pitch: 60,
        timing: { beat: 0, duration: 0 }
      };

      expect(() => (loader as any).validateSongNote(invalidNote, 0))
        .toThrow('durationは0より大きい数値で指定してください');
    });

    it('velocityが範囲外の場合エラーを投げる', () => {
      const invalidNote = {
        pitch: 60,
        timing: { beat: 0 },
        velocity: 128
      };

      expect(() => (loader as any).validateSongNote(invalidNote, 0))
        .toThrow('velocityは0-127の範囲で指定してください');
    });
  });

  describe('validateSongMemo', () => {
    it('正しいメモを検証する', () => {
      const validMemo = {
        timing: { beat: 0 },
        text: 'Test Memo',
        align: 'center',
        color: 'blue'
      };

      expect(() => (loader as any).validateSongMemo(validMemo, 0)).not.toThrow();
    });

    it('timingがない場合エラーを投げる', () => {
      const invalidMemo = {
        text: 'Test'
      };

      expect(() => (loader as any).validateSongMemo(invalidMemo, 0))
        .toThrow('timingが必要です');
    });

    it('beatが負の場合エラーを投げる', () => {
      const invalidMemo = {
        timing: { beat: -1 },
        text: 'Test'
      };

      expect(() => (loader as any).validateSongMemo(invalidMemo, 0))
        .toThrow('beatは0以上の数値で指定してください');
    });

    it('textが文字列でない場合エラーを投げる', () => {
      const invalidMemo = {
        timing: { beat: 0 },
        text: 123
      };

      expect(() => (loader as any).validateSongMemo(invalidMemo, 0))
        .toThrow('textは文字列で指定してください');
    });

    it('alignが不正な値の場合エラーを投げる', () => {
      const invalidMemo = {
        timing: { beat: 0 },
        text: 'Test',
        align: 'invalid'
      };

      expect(() => (loader as any).validateSongMemo(invalidMemo, 0))
        .toThrow('alignは\'left\'、\'center\'、\'right\'のいずれかで指定してください');
    });
  });

  describe('convertToMusicalNotes', () => {
    it('SongNotesをMusicalNotesに変換してデフォルト値を適用する', () => {
      const songData = {
        title: 'Test',
        bpm: 120,
        notes: [
          { pitch: 60, timing: { beat: 0 } },
          { pitch: 62, timing: { beat: 1, duration: 2 }, velocity: 100 }
        ]
      };

      const result = (loader as any).convertToMusicalNotes(songData);

      expect(result).toHaveLength(2);
      expect(result[0].pitch).toBe(60);
      expect(result[0].timing.duration).toBe(1); // デフォルト
      expect(result[0].velocity).toBe(80); // デフォルト
      expect(result[1].timing.duration).toBe(2);
      expect(result[1].velocity).toBe(100);
    });
  });

  describe('processSongData', () => {
    it('メモ付きの楽曲データを処理する', () => {
      const data = {
        title: 'Test Song',
        bpm: 120,
        notes: [
          { pitch: 60, timing: { beat: 0, duration: 1 }, velocity: 80 }
        ],
        memos: [
          { timing: { beat: 0 }, text: 'Test Memo', color: 'blue' }
        ]
      };

      const result = (loader as any).processSongData(data);

      expect(result.notes).toHaveLength(1);
      expect(result.memos).toHaveLength(1);
      expect(result.memos[0].text).toBe('Test Memo');
    });

    it('メモなしの楽曲データを処理する', () => {
      const data = {
        title: 'Test Song',
        notes: [
          { pitch: 60, timing: { beat: 0 } }
        ]
      };

      const result = (loader as any).processSongData(data);

      expect(result.notes).toHaveLength(1);
      expect(result.memos).toEqual([]);
    });

    it('ノートが空の場合警告を出す', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const data = {
        title: 'Test Song',
        notes: []
      };

      (loader as any).processSongData(data);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('楽曲データにノートが含まれていません')
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
