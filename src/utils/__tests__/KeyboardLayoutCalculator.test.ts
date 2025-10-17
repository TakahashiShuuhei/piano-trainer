import { describe, it, expect, beforeEach } from '@jest/globals';
import { KeyboardLayoutCalculator, KeyboardLayout } from '../KeyboardLayoutCalculator';

describe('KeyboardLayoutCalculator', () => {
  let calculator: KeyboardLayoutCalculator;

  beforeEach(() => {
    calculator = new KeyboardLayoutCalculator();
  });

  describe('calculateLayout', () => {
    it('キャンバスサイズから鍵盤レイアウトを計算する', () => {
      const layout = calculator.calculateLayout(1040, 400);

      // 1040px / 52白鍵 = 20px
      expect(layout.whiteKeyWidth).toBe(20);
      // 20px * 0.6 = 12px
      expect(layout.blackKeyWidth).toBe(12);
      // 400px * 0.2 = 80px
      expect(layout.whiteKeyHeight).toBe(80);
      // 80px * 0.6 = 48px
      expect(layout.blackKeyHeight).toBe(48);
    });

    it('カスタムの鍵盤高さ比率で計算する', () => {
      const layout = calculator.calculateLayout(1040, 500, 0.3);

      // 500px * 0.3 = 150px
      expect(layout.whiteKeyHeight).toBe(150);
      expect(layout.blackKeyHeight).toBe(90);
    });

    it('小さいキャンバスでも正しく計算する', () => {
      const layout = calculator.calculateLayout(520, 200);

      // 520px / 52 = 10px
      expect(layout.whiteKeyWidth).toBe(10);
      expect(layout.blackKeyWidth).toBe(6);
      expect(layout.whiteKeyHeight).toBe(40);
      expect(layout.blackKeyHeight).toBe(24);
    });
  });

  describe('isBlackKey', () => {
    it('黒鍵を正しく判定する', () => {
      // C# (1), D# (3), F# (6), G# (8), A# (10)
      expect(calculator.isBlackKey(25)).toBe(true); // C#1
      expect(calculator.isBlackKey(27)).toBe(true); // D#1
      expect(calculator.isBlackKey(30)).toBe(true); // F#1
      expect(calculator.isBlackKey(32)).toBe(true); // G#1
      expect(calculator.isBlackKey(34)).toBe(true); // A#1
    });

    it('白鍵は黒鍵ではないと判定する', () => {
      // C (0), D (2), E (4), F (5), G (7), A (9), B (11)
      expect(calculator.isBlackKey(24)).toBe(false); // C1
      expect(calculator.isBlackKey(26)).toBe(false); // D1
      expect(calculator.isBlackKey(28)).toBe(false); // E1
      expect(calculator.isBlackKey(29)).toBe(false); // F1
      expect(calculator.isBlackKey(31)).toBe(false); // G1
      expect(calculator.isBlackKey(33)).toBe(false); // A1
      expect(calculator.isBlackKey(35)).toBe(false); // B1
    });

    it('MIDIノート60(C4)は白鍵', () => {
      expect(calculator.isBlackKey(60)).toBe(false);
    });

    it('MIDIノート61(C#4)は黒鍵', () => {
      expect(calculator.isBlackKey(61)).toBe(true);
    });
  });

  describe('isWhiteKey', () => {
    it('白鍵を正しく判定する', () => {
      expect(calculator.isWhiteKey(60)).toBe(true);  // C4
      expect(calculator.isWhiteKey(62)).toBe(true);  // D4
      expect(calculator.isWhiteKey(64)).toBe(true);  // E4
      expect(calculator.isWhiteKey(65)).toBe(true);  // F4
      expect(calculator.isWhiteKey(67)).toBe(true);  // G4
      expect(calculator.isWhiteKey(69)).toBe(true);  // A4
      expect(calculator.isWhiteKey(71)).toBe(true);  // B4
    });

    it('黒鍵は白鍵ではないと判定する', () => {
      expect(calculator.isWhiteKey(61)).toBe(false); // C#4
      expect(calculator.isWhiteKey(63)).toBe(false); // D#4
      expect(calculator.isWhiteKey(66)).toBe(false); // F#4
      expect(calculator.isWhiteKey(68)).toBe(false); // G#4
      expect(calculator.isWhiteKey(70)).toBe(false); // A#4
    });
  });

  describe('getNoteXPosition', () => {
    let layout: KeyboardLayout;

    beforeEach(() => {
      // 1040px / 52 = 20px per white key
      layout = calculator.calculateLayout(1040, 400);
    });

    it('範囲外のMIDIノートは-1を返す', () => {
      expect(calculator.getNoteXPosition(20, layout)).toBe(-1);  // A0未満
      expect(calculator.getNoteXPosition(109, layout)).toBe(-1); // C8より大きい
    });

    it('最初の白鍵(A0=21)の位置を計算する', () => {
      const x = calculator.getNoteXPosition(21, layout);
      // A0は最初の白鍵、中央は 0 * 20 + 10 = 10
      expect(x).toBe(10);
    });

    it('最初の黒鍵(A#0=22)の位置を計算する', () => {
      const x = calculator.getNoteXPosition(22, layout);
      // A#0は最初の黒鍵、A0の右側
      // x = (1-1) * 20 + 20 - 6 + 6 = 20
      expect(x).toBe(20);
    });

    it('C4(60)の位置を計算する', () => {
      const x = calculator.getNoteXPosition(60, layout);
      // C4はMIDI 60、計算結果を確認
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1040);
    });

    it('白鍵は鍵盤の中央に配置される', () => {
      const x = calculator.getNoteXPosition(24, layout); // C1
      // C1の白鍵インデックスを計算し、中央に配置されることを確認
      expect(x % layout.whiteKeyWidth).toBeCloseTo(layout.whiteKeyWidth / 2, 5);
    });

    it('連続する白鍵は等間隔に配置される', () => {
      const c4 = calculator.getNoteXPosition(60, layout); // C4
      const d4 = calculator.getNoteXPosition(62, layout); // D4
      const e4 = calculator.getNoteXPosition(64, layout); // E4

      // C4からD4、D4からE4の間隔は同じ（whiteKeyWidth）
      expect(d4 - c4).toBeCloseTo(layout.whiteKeyWidth, 5);
      expect(e4 - d4).toBeCloseTo(layout.whiteKeyWidth, 5);
    });
  });

  describe('getWhiteKeyX', () => {
    let layout: KeyboardLayout;

    beforeEach(() => {
      layout = calculator.calculateLayout(1040, 400);
    });

    it('白鍵のX座標を計算する', () => {
      expect(calculator.getWhiteKeyX(0, layout)).toBe(0);
      expect(calculator.getWhiteKeyX(1, layout)).toBe(20);
      expect(calculator.getWhiteKeyX(2, layout)).toBe(40);
      expect(calculator.getWhiteKeyX(51, layout)).toBe(1020); // 最後の白鍵
    });
  });

  describe('getBlackKeyX', () => {
    let layout: KeyboardLayout;

    beforeEach(() => {
      layout = calculator.calculateLayout(1040, 400);
    });

    it('黒鍵のX座標を計算する', () => {
      // 黒鍵は直前の白鍵の右端付近に配置される
      const x = calculator.getBlackKeyX(1, layout);
      // (1-1) * 20 + 20 - 6 = 14
      expect(x).toBe(14);
    });

    it('複数の黒鍵の位置を計算する', () => {
      const x1 = calculator.getBlackKeyX(1, layout);
      const x2 = calculator.getBlackKeyX(2, layout);
      // 黒鍵間の距離は白鍵の幅と同じ
      expect(x2 - x1).toBe(layout.whiteKeyWidth);
    });
  });

  describe('getKeyPositions', () => {
    let layout: KeyboardLayout;

    beforeEach(() => {
      layout = calculator.calculateLayout(1040, 400);
    });

    it('全ての鍵盤の位置を取得する', () => {
      const positions = calculator.getKeyPositions(layout);

      // 88鍵盤: 52白鍵 + 36黒鍵
      expect(positions.whiteKeys.length).toBe(52);
      expect(positions.blackKeys.length).toBe(36);
    });

    it('白鍵の最初と最後のピッチが正しい', () => {
      const positions = calculator.getKeyPositions(layout);

      expect(positions.whiteKeys[0]!.pitch).toBe(21);  // A0
      expect(positions.whiteKeys[51]!.pitch).toBe(108); // C8
    });

    it('黒鍵の最初と最後のピッチが正しい', () => {
      const positions = calculator.getKeyPositions(layout);

      expect(positions.blackKeys[0]!.pitch).toBe(22);  // A#0
      expect(positions.blackKeys[35]!.pitch).toBe(106); // A#7
    });

    it('各鍵盤にX座標が設定されている', () => {
      const positions = calculator.getKeyPositions(layout);

      positions.whiteKeys.forEach(key => {
        expect(key.x).toBeGreaterThanOrEqual(0);
        expect(key.x).toBeLessThan(1040);
      });

      positions.blackKeys.forEach(key => {
        expect(key.x).toBeGreaterThanOrEqual(0);
        expect(key.x).toBeLessThan(1040);
      });
    });
  });

  describe('getConfig', () => {
    it('設定を取得できる', () => {
      const config = calculator.getConfig();

      expect(config.whiteKeys).toEqual([0, 2, 4, 5, 7, 9, 11]);
      expect(config.blackKeys).toEqual([1, 3, 6, 8, 10]);
      expect(config.midiRange.min).toBe(21);
      expect(config.midiRange.max).toBe(108);
      expect(config.totalWhiteKeys).toBe(52);
    });
  });

  describe('getTotalWhiteKeys', () => {
    it('白鍵の総数を取得できる', () => {
      expect(calculator.getTotalWhiteKeys()).toBe(52);
    });
  });

  describe('getMidiRange', () => {
    it('MIDIノート番号の範囲を取得できる', () => {
      const range = calculator.getMidiRange();
      expect(range.min).toBe(21);  // A0
      expect(range.max).toBe(108); // C8
    });
  });

  describe('エッジケース', () => {
    it('極端に小さいキャンバスでも計算できる', () => {
      const layout = calculator.calculateLayout(52, 50);
      expect(layout.whiteKeyWidth).toBe(1);
      expect(layout.blackKeyWidth).toBe(0.6);
    });

    it('極端に大きいキャンバスでも計算できる', () => {
      const layout = calculator.calculateLayout(10400, 4000);
      expect(layout.whiteKeyWidth).toBe(200);
      expect(layout.blackKeyWidth).toBe(120);
    });

    it('オクターブの境界でも正しく計算する', () => {
      const layout = calculator.calculateLayout(1040, 400);

      // C4 (60) と B3 (59)
      const c4 = calculator.getNoteXPosition(60, layout);
      const b3 = calculator.getNoteXPosition(59, layout);
      expect(c4).toBeGreaterThan(b3);

      // B4 (71) と C5 (72)
      const b4 = calculator.getNoteXPosition(71, layout);
      const c5 = calculator.getNoteXPosition(72, layout);
      expect(c5).toBeGreaterThan(b4);
    });
  });
});
