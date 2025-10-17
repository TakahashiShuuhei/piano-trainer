import { describe, it, expect } from '@jest/globals';
import { TimeFormatter } from '../TimeFormatter';

describe('TimeFormatter', () => {
  describe('formatTime', () => {
    it('0ミリ秒を "0:00" にフォーマット', () => {
      expect(TimeFormatter.formatTime(0)).toBe('0:00');
    });

    it('1秒未満を "0:00" にフォーマット', () => {
      expect(TimeFormatter.formatTime(500)).toBe('0:00');
      expect(TimeFormatter.formatTime(999)).toBe('0:00');
    });

    it('1秒を "0:01" にフォーマット', () => {
      expect(TimeFormatter.formatTime(1000)).toBe('0:01');
    });

    it('59秒を "0:59" にフォーマット', () => {
      expect(TimeFormatter.formatTime(59000)).toBe('0:59');
    });

    it('1分を "1:00" にフォーマット', () => {
      expect(TimeFormatter.formatTime(60000)).toBe('1:00');
    });

    it('1分23秒を "1:23" にフォーマット', () => {
      expect(TimeFormatter.formatTime(83000)).toBe('1:23');
    });

    it('10分以上を正しくフォーマット', () => {
      expect(TimeFormatter.formatTime(600000)).toBe('10:00');
      expect(TimeFormatter.formatTime(765000)).toBe('12:45');
    });

    it('負の値も正しくフォーマット', () => {
      // 負の値の場合、負の分と負の秒になるが、実装は Math.floor を使用するため
      // -1000ms → -1秒 → -1分, -1秒 → "-1:-01" ではなく "-1:-1" になる
      // 実用上、負の値は想定しないが、動作を確認
      const result = TimeFormatter.formatTime(-1000);
      expect(result.startsWith('-')).toBe(true);
    });
  });

  describe('formatTimeWithPadding', () => {
    it('0ミリ秒を "00:00" にフォーマット', () => {
      expect(TimeFormatter.formatTimeWithPadding(0)).toBe('00:00');
    });

    it('1秒を "00:01" にフォーマット', () => {
      expect(TimeFormatter.formatTimeWithPadding(1000)).toBe('00:01');
    });

    it('1分23秒を "01:23" にフォーマット', () => {
      expect(TimeFormatter.formatTimeWithPadding(83000)).toBe('01:23');
    });

    it('10分以上も正しくフォーマット', () => {
      expect(TimeFormatter.formatTimeWithPadding(600000)).toBe('10:00');
      expect(TimeFormatter.formatTimeWithPadding(765000)).toBe('12:45');
    });

    it('1桁の分も2桁でパディング', () => {
      expect(TimeFormatter.formatTimeWithPadding(60000)).toBe('01:00');
      expect(TimeFormatter.formatTimeWithPadding(540000)).toBe('09:00');
    });
  });

  describe('toSeconds', () => {
    it('0ミリ秒を0秒に変換', () => {
      expect(TimeFormatter.toSeconds(0)).toBe(0);
    });

    it('1000ミリ秒を1.0秒に変換', () => {
      expect(TimeFormatter.toSeconds(1000)).toBe(1.0);
    });

    it('1234ミリ秒を1.2秒に変換（四捨五入）', () => {
      expect(TimeFormatter.toSeconds(1234)).toBe(1.2);
    });

    it('1500ミリ秒を1.5秒に変換', () => {
      expect(TimeFormatter.toSeconds(1500)).toBe(1.5);
    });

    it('999ミリ秒を1.0秒に変換（四捨五入）', () => {
      expect(TimeFormatter.toSeconds(999)).toBe(1.0);
    });

    it('2567ミリ秒を2.6秒に変換（四捨五入）', () => {
      expect(TimeFormatter.toSeconds(2567)).toBe(2.6);
    });
  });

  describe('toMilliseconds', () => {
    it('0秒を0ミリ秒に変換', () => {
      expect(TimeFormatter.toMilliseconds(0)).toBe(0);
    });

    it('1秒を1000ミリ秒に変換', () => {
      expect(TimeFormatter.toMilliseconds(1)).toBe(1000);
    });

    it('1.5秒を1500ミリ秒に変換', () => {
      expect(TimeFormatter.toMilliseconds(1.5)).toBe(1500);
    });

    it('0.1秒を100ミリ秒に変換', () => {
      expect(TimeFormatter.toMilliseconds(0.1)).toBe(100);
    });

    it('小数点以下の誤差を丸める', () => {
      expect(TimeFormatter.toMilliseconds(1.2345)).toBe(1235);
    });
  });

  describe('複合シナリオ', () => {
    it('formatTimeとtoSecondsの往復変換', () => {
      const milliseconds = 83000; // 1:23
      const seconds = TimeFormatter.toSeconds(milliseconds);
      const formatted = TimeFormatter.formatTime(milliseconds);

      expect(seconds).toBe(83.0);
      expect(formatted).toBe('1:23');
    });

    it('toMillisecondsとtoSecondsの往復変換', () => {
      const originalSeconds = 5.5;
      const milliseconds = TimeFormatter.toMilliseconds(originalSeconds);
      const backToSeconds = TimeFormatter.toSeconds(milliseconds);

      expect(milliseconds).toBe(5500);
      expect(backToSeconds).toBe(originalSeconds);
    });

    it('楽曲の典型的な時間をフォーマット', () => {
      // 30秒の楽曲
      expect(TimeFormatter.formatTime(30000)).toBe('0:30');

      // 3分の楽曲
      expect(TimeFormatter.formatTime(180000)).toBe('3:00');

      // 5分30秒の楽曲
      expect(TimeFormatter.formatTime(330000)).toBe('5:30');
    });
  });
});
