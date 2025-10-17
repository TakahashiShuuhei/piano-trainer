import { describe, it, expect, beforeEach } from '@jest/globals';
import { NotePositionCalculator } from '../NotePositionCalculator';
import { Note } from '../../types/index';

describe('NotePositionCalculator', () => {
  let calculator: NotePositionCalculator;

  beforeEach(() => {
    calculator = new NotePositionCalculator();
  });

  describe('getShowTime', () => {
    it('ノート開始時刻の2秒前を返す', () => {
      expect(calculator.getShowTime(5000)).toBe(3000);
      expect(calculator.getShowTime(1000)).toBe(-1000);
      expect(calculator.getShowTime(0)).toBe(-2000);
    });
  });

  describe('getHideTime', () => {
    it('ノート終了後1秒後を返す', () => {
      const note: Note = {
        pitch: 60,
        startTime: 1000,
        duration: 500,
        velocity: 80
      };
      // 1000 + 500 + 1000 = 2500
      expect(calculator.getHideTime(note)).toBe(2500);
    });

    it('durationが長いノートも正しく計算する', () => {
      const note: Note = {
        pitch: 60,
        startTime: 2000,
        duration: 2000,
        velocity: 80
      };
      // 2000 + 2000 + 1000 = 5000
      expect(calculator.getHideTime(note)).toBe(5000);
    });
  });

  describe('isNoteVisible', () => {
    const note: Note = {
      pitch: 60,
      startTime: 1000,
      duration: 500,
      velocity: 80
    };

    it('表示範囲内の場合trueを返す', () => {
      // 表示開始: -1000, 終了: 2500
      expect(calculator.isNoteVisible(0, note)).toBe(true);
      expect(calculator.isNoteVisible(1000, note)).toBe(true);
      expect(calculator.isNoteVisible(2000, note)).toBe(true);
    });

    it('表示範囲外の場合falseを返す', () => {
      // 表示開始前
      expect(calculator.isNoteVisible(-1500, note)).toBe(false);
      // 表示終了後
      expect(calculator.isNoteVisible(3000, note)).toBe(false);
    });

    it('境界値でも正しく判定する', () => {
      // 表示開始時刻: -1000
      expect(calculator.isNoteVisible(-1000, note)).toBe(true);
      // 非表示時刻: 2500
      expect(calculator.isNoteVisible(2500, note)).toBe(true);
    });
  });

  describe('calculateNoteY', () => {
    it('ノート表示開始時（2秒前）はY座標が負になる', () => {
      const noteHeight = 30;
      const noteAreaHeight = 400;
      const noteStartTime = 2000;
      const currentTime = 0; // 2秒前

      const y = calculator.calculateNoteY(currentTime, noteStartTime, noteAreaHeight, noteHeight);
      // progress = 0, y = 0 * 400 - 30 = -30
      expect(y).toBe(-30);
    });

    it('タイミングライン到達時（開始時刻）はY座標が(noteAreaHeight - noteHeight)になる', () => {
      const noteHeight = 30;
      const noteAreaHeight = 400;
      const noteStartTime = 2000;
      const currentTime = 2000;

      const y = calculator.calculateNoteY(currentTime, noteStartTime, noteAreaHeight, noteHeight);
      // progress = 1, y = 1 * 400 - 30 = 370
      expect(y).toBe(370);
    });

    it('中間時点のY座標を正しく計算する', () => {
      const noteHeight = 30;
      const noteAreaHeight = 400;
      const noteStartTime = 2000;
      const currentTime = 1000; // 1秒前

      const y = calculator.calculateNoteY(currentTime, noteStartTime, noteAreaHeight, noteHeight);
      // progress = 0.5, y = 0.5 * 400 - 30 = 170
      expect(y).toBe(170);
    });

    it('異なるnoteAreaHeightでも正しく計算する', () => {
      const noteHeight = 50;
      const noteAreaHeight = 800;
      const noteStartTime = 3000;
      const currentTime = 2000; // 1秒前

      const y = calculator.calculateNoteY(currentTime, noteStartTime, noteAreaHeight, noteHeight);
      // progress = 0.5, y = 0.5 * 800 - 50 = 350
      expect(y).toBe(350);
    });
  });

  describe('calculateNoteHeight', () => {
    it('基準duration(500ms)の場合、最小高さ以上になる', () => {
      const height = calculator.calculateNoteHeight(500);
      expect(height).toBeGreaterThanOrEqual(30);
      expect(height).toBeLessThanOrEqual(150);
    });

    it('短いdurationの場合、最小高さ(30px)になる', () => {
      expect(calculator.calculateNoteHeight(100)).toBe(30);
      expect(calculator.calculateNoteHeight(200)).toBe(30);
    });

    it('長いdurationの場合、高さが増加する', () => {
      const height500 = calculator.calculateNoteHeight(500);
      const height1000 = calculator.calculateNoteHeight(1000);
      const height2000 = calculator.calculateNoteHeight(2000);

      expect(height1000).toBeGreaterThan(height500);
      expect(height2000).toBeGreaterThan(height1000);
    });

    it('極端に長いdurationでも最大高さ(150px)を超えない', () => {
      expect(calculator.calculateNoteHeight(5000)).toBe(150);
      expect(calculator.calculateNoteHeight(10000)).toBe(150);
    });

    it('0以下のdurationでも最小高さを返す', () => {
      expect(calculator.calculateNoteHeight(0)).toBe(30);
      expect(calculator.calculateNoteHeight(-100)).toBe(30);
    });

    it('duration比率が正しく反映される', () => {
      // duration 1000ms = ratio 2.0 -> height = 30 + (2-1)*100 = 130
      expect(calculator.calculateNoteHeight(1000)).toBe(130);
      // duration 1500ms = ratio 3.0 -> height = 30 + (3-1)*100 = 230
      expect(calculator.calculateNoteHeight(1500)).toBe(150);
      // duration 2000ms = ratio 4.0 -> height = 30 + (4-1)*100 = 330
      expect(calculator.calculateNoteHeight(2000)).toBe(150);
    });
  });

  describe('isNoteOffScreen', () => {
    it('ノートが画面外（下）に出た場合trueを返す', () => {
      expect(calculator.isNoteOffScreen(500, 400)).toBe(true);
      expect(calculator.isNoteOffScreen(401, 400)).toBe(true);
    });

    it('ノートが画面内の場合falseを返す', () => {
      expect(calculator.isNoteOffScreen(300, 400)).toBe(false);
      expect(calculator.isNoteOffScreen(0, 400)).toBe(false);
      expect(calculator.isNoteOffScreen(-50, 400)).toBe(false);
    });

    it('境界値の場合trueを返す', () => {
      expect(calculator.isNoteOffScreen(400, 400)).toBe(false);
      expect(calculator.isNoteOffScreen(401, 400)).toBe(true);
    });
  });

  describe('calculateProgress', () => {
    it('表示開始時（2秒前）はprogress = 0', () => {
      const progress = calculator.calculateProgress(0, 2000);
      expect(progress).toBe(0);
    });

    it('タイミングライン到達時（開始時刻）はprogress = 1', () => {
      const progress = calculator.calculateProgress(2000, 2000);
      expect(progress).toBe(1);
    });

    it('中間時点でprogress = 0.5', () => {
      const progress = calculator.calculateProgress(1000, 2000);
      expect(progress).toBe(0.5);
    });

    it('開始時刻を過ぎてもprogressは1以上になる', () => {
      const progress = calculator.calculateProgress(3000, 2000);
      expect(progress).toBeGreaterThan(1);
    });

    it('表示前の時刻では0を返す（負にならない）', () => {
      const progress = calculator.calculateProgress(-1000, 2000);
      expect(progress).toBe(0);
    });
  });

  describe('isNoteActive', () => {
    it('現在時刻がノート開始時刻以降の場合trueを返す', () => {
      expect(calculator.isNoteActive(1000, 1000)).toBe(true);
      expect(calculator.isNoteActive(1500, 1000)).toBe(true);
      expect(calculator.isNoteActive(2000, 1000)).toBe(true);
    });

    it('現在時刻がノート開始時刻より前の場合falseを返す', () => {
      expect(calculator.isNoteActive(500, 1000)).toBe(false);
      expect(calculator.isNoteActive(0, 1000)).toBe(false);
    });

    it('開始時刻ちょうどの場合trueを返す', () => {
      expect(calculator.isNoteActive(1000, 1000)).toBe(true);
    });
  });

  describe('getConstants', () => {
    it('定数を取得できる', () => {
      const constants = calculator.getConstants();

      expect(constants.showAheadTime).toBe(2000);
      expect(constants.hideAfterTime).toBe(1000);
      expect(constants.baseDuration).toBe(500);
      expect(constants.minHeight).toBe(30);
      expect(constants.maxHeight).toBe(150);
    });
  });

  describe('複合シナリオ', () => {
    it('ノートが画面を流れる一連の動きを計算する', () => {
      const note: Note = {
        pitch: 60,
        startTime: 3000,
        duration: 500,
        velocity: 80
      };
      const noteAreaHeight = 400;
      const canvasHeight = 500;
      const noteHeight = calculator.calculateNoteHeight(note.duration);

      // 1秒前（currentTime = 1000）
      expect(calculator.isNoteVisible(1000, note)).toBe(true);
      let y = calculator.calculateNoteY(1000, note.startTime, noteAreaHeight, noteHeight);
      expect(y).toBeLessThan(0); // 画面上部の外
      expect(calculator.isNoteOffScreen(y, canvasHeight)).toBe(false);
      expect(calculator.isNoteActive(1000, note.startTime)).toBe(false);

      // 開始時刻（currentTime = 3000）
      expect(calculator.isNoteVisible(3000, note)).toBe(true);
      y = calculator.calculateNoteY(3000, note.startTime, noteAreaHeight, noteHeight);
      expect(y).toBeGreaterThan(0);
      expect(calculator.isNoteActive(3000, note.startTime)).toBe(true);

      // 終了後（currentTime = 4000）
      expect(calculator.isNoteVisible(4000, note)).toBe(true);
      y = calculator.calculateNoteY(4000, note.startTime, noteAreaHeight, noteHeight);
      expect(y).toBeGreaterThan(noteAreaHeight);
    });

    it('複数のdurationのノート高さを比較する', () => {
      const shortNote = 250;   // 四分音符の半分（500ms未満なので最小値）
      const normalNote = 500;  // 四分音符（ratio=1なので最小値）
      const longNote = 1000;   // 二分音符（ratio=2なので70px）
      const veryLongNote = 2000; // 全音符（ratio=4なので150px）

      const h1 = calculator.calculateNoteHeight(shortNote);
      const h2 = calculator.calculateNoteHeight(normalNote);
      const h3 = calculator.calculateNoteHeight(longNote);
      const h4 = calculator.calculateNoteHeight(veryLongNote);

      // 500ms未満は最小値
      expect(h1).toBe(30);
      expect(h2).toBe(30);
      // 長いほど大きい
      expect(h3).toBe(130);
      expect(h4).toBe(150); // 最大値

      // 順序確認
      expect(h3).toBeGreaterThan(h2);
      expect(h4).toBeGreaterThan(h3);
    });
  });
});
