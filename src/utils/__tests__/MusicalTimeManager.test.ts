import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MusicalTimeManager } from '../MusicalTimeManager';

describe('MusicalTimeManager', () => {
  let manager: MusicalTimeManager;

  beforeEach(() => {
    manager = new MusicalTimeManager(120); // BPM 120
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('デフォルトBPM120で初期化される', () => {
      const defaultManager = new MusicalTimeManager();
      expect(defaultManager.getBPM()).toBe(120);
    });

    it('指定したBPMで初期化される', () => {
      const customManager = new MusicalTimeManager(90);
      expect(customManager.getBPM()).toBe(90);
    });

    it('初期状態では開始していない', () => {
      expect(manager.isStarted()).toBe(false);
      expect(manager.isPaused()).toBe(false);
    });
  });

  describe('start', () => {
    it('ゲームを開始する', () => {
      manager.start();
      expect(manager.isStarted()).toBe(true);
      expect(manager.isPaused()).toBe(false);
    });

    it('開始後に現在時刻が0以上になる', () => {
      manager.start();
      const time = manager.getCurrentRealTime();
      expect(time).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pause and resume', () => {
    it('一時停止と再開ができる', () => {
      manager.start();
      expect(manager.isPaused()).toBe(false);

      manager.pause();
      expect(manager.isPaused()).toBe(true);

      manager.resume();
      expect(manager.isPaused()).toBe(false);
    });

    it('一時停止中は音楽的位置が固定される', async () => {
      manager.start();

      // 少し待機して位置を進める
      await new Promise(resolve => setTimeout(resolve, 100));

      manager.pause();
      const pausedPosition = manager.getCurrentMusicalPosition();

      // さらに待機
      await new Promise(resolve => setTimeout(resolve, 50));

      // 一時停止中は位置が変わらない
      expect(manager.getCurrentMusicalPosition()).toBe(pausedPosition);
    });

    it('再開後に時間が進む', async () => {
      manager.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      manager.pause();
      const pausedPosition = manager.getCurrentMusicalPosition();

      await new Promise(resolve => setTimeout(resolve, 50));

      manager.resume();
      await new Promise(resolve => setTimeout(resolve, 50));

      // 再開後は位置が進む
      expect(manager.getCurrentMusicalPosition()).toBeGreaterThan(pausedPosition);
    });
  });

  describe('stop', () => {
    it('停止すると全ての状態がリセットされる', () => {
      manager.start();
      manager.pause();
      manager.stop();

      expect(manager.isStarted()).toBe(false);
      expect(manager.isPaused()).toBe(false);
      expect(manager.getCurrentRealTime()).toBe(0);
      expect(manager.getCurrentMusicalPosition()).toBe(0);
    });
  });

  describe('realTimeToMusicalPosition', () => {
    it('実時間を拍数に正しく変換する', () => {
      // BPM 120 = 1拍 = 500ms
      expect(manager.realTimeToMusicalPosition(0)).toBe(0);
      expect(manager.realTimeToMusicalPosition(500)).toBe(1);
      expect(manager.realTimeToMusicalPosition(1000)).toBe(2);
      expect(manager.realTimeToMusicalPosition(250)).toBe(0.5);
    });
  });

  describe('musicalPositionToRealTime', () => {
    it('拍数を実時間に正しく変換する', () => {
      // BPM 120 = 1拍 = 500ms
      expect(manager.musicalPositionToRealTime(0)).toBe(0);
      expect(manager.musicalPositionToRealTime(1)).toBe(500);
      expect(manager.musicalPositionToRealTime(2)).toBe(1000);
      expect(manager.musicalPositionToRealTime(0.5)).toBe(250);
    });
  });

  describe('setBPM', () => {
    it('BPMを正しく更新する', () => {
      manager.setBPM(90);
      expect(manager.getBPM()).toBe(90);
    });

    it('無効なBPM(0以下)は無視される', () => {
      manager.setBPM(0);
      expect(manager.getBPM()).toBe(120);

      manager.setBPM(-10);
      expect(manager.getBPM()).toBe(120);
    });

    it('BPM変更後も音楽的位置が保持される', async () => {
      manager.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const positionBefore = manager.getCurrentMusicalPosition();

      manager.setBPM(60); // BPMを半分に

      const positionAfter = manager.getCurrentMusicalPosition();

      // 音楽的位置はほぼ同じ（わずかな時間経過の誤差を許容）
      expect(Math.abs(positionAfter - positionBefore)).toBeLessThan(0.1);
    });
  });

  describe('seekToMusicalPosition', () => {
    it('指定した拍数にシークする', () => {
      manager.start();
      manager.seekToMusicalPosition(4); // 4拍目にシーク

      const position = manager.getCurrentMusicalPosition();
      expect(position).toBeCloseTo(4, 1);
    });

    it('シーク後に時間が進む', async () => {
      manager.start();
      manager.seekToMusicalPosition(4);

      const positionBefore = manager.getCurrentMusicalPosition();

      await new Promise(resolve => setTimeout(resolve, 100));

      const positionAfter = manager.getCurrentMusicalPosition();
      expect(positionAfter).toBeGreaterThan(positionBefore);
    });
  });

  describe('seekToRealTime', () => {
    it('指定した実時間にシークする', () => {
      manager.start();
      manager.seekToRealTime(2000); // 2000msにシーク

      const time = manager.getCurrentRealTime();
      expect(time).toBeCloseTo(2000, -1); // 10ms単位で近似
    });
  });

  describe('getProgress and setProgress', () => {
    it('進行度を0-1の範囲で取得する', () => {
      manager.start();
      const totalDuration = 10000; // 10秒

      manager.seekToRealTime(0);
      expect(manager.getProgress(totalDuration)).toBeCloseTo(0, 1);

      manager.seekToRealTime(5000);
      expect(manager.getProgress(totalDuration)).toBeCloseTo(0.5, 1);

      manager.seekToRealTime(10000);
      expect(manager.getProgress(totalDuration)).toBeCloseTo(1, 1);
    });

    it('進行度から位置を設定する', () => {
      manager.start();
      const totalDuration = 10000;

      manager.setProgress(0.5, totalDuration);
      expect(manager.getCurrentRealTime()).toBeCloseTo(5000, -1);

      manager.setProgress(0.75, totalDuration);
      expect(manager.getCurrentRealTime()).toBeCloseTo(7500, -1);
    });

    it('進行度が範囲外でも0-1にクランプされる', () => {
      manager.start();
      const totalDuration = 10000;

      manager.seekToRealTime(-1000);
      expect(manager.getProgress(totalDuration)).toBe(0);

      manager.seekToRealTime(15000);
      expect(manager.getProgress(totalDuration)).toBe(1);
    });
  });

  describe('getDebugInfo', () => {
    it('デバッグ情報を取得できる', () => {
      manager.start();
      const info = manager.getDebugInfo();

      expect(info).toHaveProperty('gameStartTime');
      expect(info).toHaveProperty('pausedTime');
      expect(info).toHaveProperty('totalPausedDuration');
      expect(info).toHaveProperty('seekOffset');
      expect(info).toHaveProperty('pausedMusicalPosition');
      expect(info).toHaveProperty('currentBPM');
      expect(info).toHaveProperty('currentRealTime');
      expect(info).toHaveProperty('currentMusicalPosition');
      expect(info).toHaveProperty('isPaused');

      expect(info.currentBPM).toBe(120);
      expect(info.isPaused).toBe(false);
    });

    it('一時停止状態が正しく反映される', () => {
      manager.start();
      manager.pause();

      const info = manager.getDebugInfo();
      expect(info.isPaused).toBe(true);
      expect(info.pausedTime).toBeGreaterThan(0);
    });
  });

  describe('複合シナリオ', () => {
    it('開始→一時停止→再開→シーク→停止の一連の流れ', async () => {
      // 開始
      manager.start();
      expect(manager.isStarted()).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 50));

      // 一時停止
      manager.pause();
      const pausedPosition = manager.getCurrentMusicalPosition();
      expect(manager.isPaused()).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 50));

      // 再開
      manager.resume();
      expect(manager.isPaused()).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(manager.getCurrentMusicalPosition()).toBeGreaterThan(pausedPosition);

      // シーク
      manager.seekToMusicalPosition(8);
      expect(manager.getCurrentMusicalPosition()).toBeCloseTo(8, 0);

      // 停止
      manager.stop();
      expect(manager.isStarted()).toBe(false);
      expect(manager.getCurrentRealTime()).toBe(0);
    });

    it('BPM変更と一時停止の組み合わせ', async () => {
      manager.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 一時停止中にBPM変更
      manager.pause();
      const pausedPosition = manager.getCurrentMusicalPosition();

      manager.setBPM(60);

      // 音楽的位置は保持される
      expect(manager.getCurrentMusicalPosition()).toBeCloseTo(pausedPosition, 1);
      expect(manager.getBPM()).toBe(60);
    });
  });
});
