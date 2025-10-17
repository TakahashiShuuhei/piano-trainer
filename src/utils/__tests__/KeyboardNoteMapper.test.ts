import { describe, it, expect } from '@jest/globals';
import { KeyboardNoteMapper } from '../KeyboardNoteMapper';

describe('KeyboardNoteMapper', () => {
  describe('getMidiNote', () => {
    it('白鍵のキーを正しくMIDIノートに変換', () => {
      expect(KeyboardNoteMapper.getMidiNote('a')).toBe(60); // C4
      expect(KeyboardNoteMapper.getMidiNote('s')).toBe(62); // D4
      expect(KeyboardNoteMapper.getMidiNote('d')).toBe(64); // E4
      expect(KeyboardNoteMapper.getMidiNote('f')).toBe(65); // F4
      expect(KeyboardNoteMapper.getMidiNote('g')).toBe(67); // G4
      expect(KeyboardNoteMapper.getMidiNote('h')).toBe(69); // A4
      expect(KeyboardNoteMapper.getMidiNote('j')).toBe(71); // B4
      expect(KeyboardNoteMapper.getMidiNote('k')).toBe(72); // C5
    });

    it('黒鍵のキーを正しくMIDIノートに変換', () => {
      expect(KeyboardNoteMapper.getMidiNote('w')).toBe(61); // C#4
      expect(KeyboardNoteMapper.getMidiNote('e')).toBe(63); // D#4
      expect(KeyboardNoteMapper.getMidiNote('t')).toBe(66); // F#4
      expect(KeyboardNoteMapper.getMidiNote('y')).toBe(68); // G#4
      expect(KeyboardNoteMapper.getMidiNote('u')).toBe(70); // A#4
    });

    it('大文字のキーも正しく処理', () => {
      expect(KeyboardNoteMapper.getMidiNote('A')).toBe(60); // C4
      expect(KeyboardNoteMapper.getMidiNote('W')).toBe(61); // C#4
      expect(KeyboardNoteMapper.getMidiNote('K')).toBe(72); // C5
    });

    it('マッピングされていないキーはundefinedを返す', () => {
      expect(KeyboardNoteMapper.getMidiNote('z')).toBeUndefined();
      expect(KeyboardNoteMapper.getMidiNote('q')).toBeUndefined();
      expect(KeyboardNoteMapper.getMidiNote('1')).toBeUndefined();
      expect(KeyboardNoteMapper.getMidiNote(' ')).toBeUndefined();
    });
  });

  describe('hasMapping', () => {
    it('マッピングされているキーでtrueを返す', () => {
      expect(KeyboardNoteMapper.hasMapping('a')).toBe(true);
      expect(KeyboardNoteMapper.hasMapping('w')).toBe(true);
      expect(KeyboardNoteMapper.hasMapping('k')).toBe(true);
    });

    it('大文字でもtrueを返す', () => {
      expect(KeyboardNoteMapper.hasMapping('A')).toBe(true);
      expect(KeyboardNoteMapper.hasMapping('W')).toBe(true);
    });

    it('マッピングされていないキーでfalseを返す', () => {
      expect(KeyboardNoteMapper.hasMapping('z')).toBe(false);
      expect(KeyboardNoteMapper.hasMapping('1')).toBe(false);
      expect(KeyboardNoteMapper.hasMapping('')).toBe(false);
    });
  });

  describe('getAllMappings', () => {
    it('すべてのマッピングを取得', () => {
      const mappings = KeyboardNoteMapper.getAllMappings();

      // 13個のキーがマッピングされている
      expect(Object.keys(mappings).length).toBe(13);

      // 主要なマッピングを確認
      expect(mappings['a']).toBe(60);
      expect(mappings['k']).toBe(72);
    });

    it('元のマッピングを変更しない（コピーを返す）', () => {
      const mappings1 = KeyboardNoteMapper.getAllMappings();
      const mappings2 = KeyboardNoteMapper.getAllMappings();

      // オブジェクトは異なる参照
      expect(mappings1).not.toBe(mappings2);

      // 内容は同じ
      expect(mappings1).toEqual(mappings2);

      // mappings1を変更してもmappings2に影響しない
      mappings1['z'] = 100;
      expect(mappings2['z']).toBeUndefined();
    });
  });

  describe('getKeysForNote', () => {
    it('指定したMIDIノートに対応するキーを取得', () => {
      expect(KeyboardNoteMapper.getKeysForNote(60)).toEqual(['a']); // C4
      expect(KeyboardNoteMapper.getKeysForNote(72)).toEqual(['k']); // C5
    });

    it('マッピングされていないノートは空配列を返す', () => {
      expect(KeyboardNoteMapper.getKeysForNote(59)).toEqual([]);
      expect(KeyboardNoteMapper.getKeysForNote(73)).toEqual([]);
      expect(KeyboardNoteMapper.getKeysForNote(0)).toEqual([]);
    });

    it('複数のキーが同じノートにマッピングされている場合、すべて返す', () => {
      // 現在のマッピングでは各ノートに1つのキーのみだが、
      // 将来的に複数のキーが同じノートにマッピングされる可能性を考慮
      const keysForC4 = KeyboardNoteMapper.getKeysForNote(60);
      expect(Array.isArray(keysForC4)).toBe(true);
      expect(keysForC4.length).toBeGreaterThan(0);
    });
  });

  describe('getAllKeys', () => {
    it('マッピングされているすべてのキーを取得', () => {
      const keys = KeyboardNoteMapper.getAllKeys();

      expect(keys.length).toBe(13);
      expect(keys).toContain('a');
      expect(keys).toContain('w');
      expect(keys).toContain('k');
    });

    it('小文字のキーのみを返す', () => {
      const keys = KeyboardNoteMapper.getAllKeys();

      keys.forEach(key => {
        expect(key).toBe(key.toLowerCase());
      });
    });
  });

  describe('getAllNotes', () => {
    it('マッピングされているすべてのノートを取得（昇順）', () => {
      const notes = KeyboardNoteMapper.getAllNotes();

      expect(notes.length).toBe(13);
      expect(notes[0]).toBe(60); // 最小: C4
      expect(notes[notes.length - 1]).toBe(72); // 最大: C5
    });

    it('ノートが昇順でソートされている', () => {
      const notes = KeyboardNoteMapper.getAllNotes();

      for (let i = 1; i < notes.length; i++) {
        const current = notes[i];
        const previous = notes[i - 1];
        if (current !== undefined && previous !== undefined) {
          expect(current).toBeGreaterThan(previous);
        }
      }
    });

    it('重複がない', () => {
      const notes = KeyboardNoteMapper.getAllNotes();
      const uniqueNotes = Array.from(new Set(notes));

      expect(notes.length).toBe(uniqueNotes.length);
    });
  });

  describe('getNoteRange', () => {
    it('ノートの範囲を正しく取得', () => {
      const range = KeyboardNoteMapper.getNoteRange();

      expect(range.min).toBe(60); // C4
      expect(range.max).toBe(72); // C5
    });

    it('範囲は1オクターブ', () => {
      const range = KeyboardNoteMapper.getNoteRange();

      expect(range.max - range.min).toBe(12); // 1オクターブ = 12半音
    });
  });

  describe('複合シナリオ', () => {
    it('すべてのキーをMIDIノートに変換できる', () => {
      const keys = KeyboardNoteMapper.getAllKeys();

      keys.forEach(key => {
        const note = KeyboardNoteMapper.getMidiNote(key);
        expect(note).toBeDefined();
        expect(note).toBeGreaterThanOrEqual(60);
        expect(note).toBeLessThanOrEqual(72);
      });
    });

    it('すべてのノートが少なくとも1つのキーにマッピングされている', () => {
      const notes = KeyboardNoteMapper.getAllNotes();

      notes.forEach(note => {
        const keys = KeyboardNoteMapper.getKeysForNote(note);
        expect(keys.length).toBeGreaterThan(0);
      });
    });

    it('getMidiNoteとgetKeysForNoteの往復変換', () => {
      const originalKey = 'a';
      const midiNote = KeyboardNoteMapper.getMidiNote(originalKey);
      const keys = KeyboardNoteMapper.getKeysForNote(midiNote!);

      expect(midiNote).toBe(60);
      expect(keys).toContain(originalKey);
    });

    it('ピアノの鍵盤レイアウトに従っている', () => {
      // C4からC5まで（1オクターブ + 1音）のクロマチックスケール
      const expectedNotes = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];
      const actualNotes = KeyboardNoteMapper.getAllNotes();

      expect(actualNotes).toEqual(expectedNotes);
    });
  });
});
