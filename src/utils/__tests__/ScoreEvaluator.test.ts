import { describe, it, expect, beforeEach } from '@jest/globals';
import { ScoreEvaluator } from '../ScoreEvaluator';
import { Note } from '../../types/index';

describe('ScoreEvaluator', () => {
  let evaluator: ScoreEvaluator;
  let testNotes: Note[];

  beforeEach(() => {
    evaluator = new ScoreEvaluator();
    testNotes = [
      { pitch: 60, startTime: 1000, duration: 500, velocity: 80 },
      { pitch: 62, startTime: 2000, duration: 500, velocity: 80 },
      { pitch: 64, startTime: 3000, duration: 500, velocity: 80 },
      { pitch: 60, startTime: 4000, duration: 500, velocity: 80 }, // 同じ音程が再度
    ];
  });

  describe('初期状態', () => {
    it('スコアが0/0で正確度1.0', () => {
      const score = evaluator.getScore();
      expect(score.correct).toBe(0);
      expect(score.total).toBe(0);
      expect(score.accuracy).toBe(1.0);
    });
  });

  describe('evaluateInput', () => {
    it('正しいタイミングと音程でヒット判定される', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      const result = evaluator.evaluateInput(60, 1000, testNotes);

      expect(result.isHit).toBe(true);
      expect(result.hitNoteIndex).toBe(0);
    });

    it('許容範囲内(±200ms)でヒット判定される', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      // 早めに入力
      const result1 = evaluator.evaluateInput(60, 850, testNotes);
      expect(result1.isHit).toBe(true);

      evaluator.reset();
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      // 遅めに入力
      const result2 = evaluator.evaluateInput(60, 1150, testNotes);
      expect(result2.isHit).toBe(true);
    });

    it('許容範囲外ではヒットしない', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      // 早すぎる
      const result1 = evaluator.evaluateInput(60, 750, testNotes);
      expect(result1.isHit).toBe(false);

      // 遅すぎる
      const result2 = evaluator.evaluateInput(60, 1250, testNotes);
      expect(result2.isHit).toBe(false);
    });

    it('音程が違う場合ヒットしない', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      const result = evaluator.evaluateInput(62, 1000, testNotes);
      expect(result.isHit).toBe(false);
    });

    it('同じノートは1セッションで1回のみヒット判定される', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      // 1回目：成功
      const result1 = evaluator.evaluateInput(60, 1000, testNotes);
      expect(result1.isHit).toBe(true);

      // 2回目：失敗（既にヒット済み）
      const result2 = evaluator.evaluateInput(60, 1000, testNotes);
      expect(result2.isHit).toBe(false);
    });

    it('複数の候補から最も早いノートを選択する', () => {
      const overlappingNotes: Note[] = [
        { pitch: 60, startTime: 1000, duration: 500, velocity: 80 },
        { pitch: 60, startTime: 1100, duration: 500, velocity: 80 },
      ];

      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1100, overlappingNotes);

      // 1100msで入力すると、両方とも範囲内だが早い方が選ばれる
      const result = evaluator.evaluateInput(60, 1100, overlappingNotes);
      expect(result.isHit).toBe(true);
      expect(result.hitNoteIndex).toBe(0); // 最初のノート
    });
  });

  describe('updateActiveNotes', () => {
    it('開始タイミングに到達したノートをアクティブにする', () => {
      evaluator.startNewPlaySession();

      // 1000msの時点で最初のノートがアクティブに
      evaluator.updateActiveNotes(1000, testNotes);
      const score1 = evaluator.getScore();
      expect(score1.total).toBe(1);

      // 2000msの時点で2つ目のノートもアクティブに
      evaluator.updateActiveNotes(2000, testNotes);
      const score2 = evaluator.getScore();
      expect(score2.total).toBe(2);
    });

    it('セッション開始時刻より前のノートは無視される', () => {
      // 2500msからセッション開始
      evaluator.startNewPlaySession(2500);

      // 3000msの時点で更新
      evaluator.updateActiveNotes(3000, testNotes);

      const score = evaluator.getScore();
      // 2500ms以降のノートのみアクティブ（index 2のみ）
      expect(score.total).toBe(1);
    });
  });

  describe('getScore', () => {
    it('正解数と総ノート数を正しくカウントする', () => {
      evaluator.startNewPlaySession();

      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      evaluator.updateActiveNotes(2000, testNotes);
      evaluator.evaluateInput(62, 2000, testNotes);

      evaluator.updateActiveNotes(3000, testNotes);
      // 3つ目は入力しない

      const score = evaluator.getScore();
      expect(score.correct).toBe(2);
      expect(score.total).toBe(3);
      expect(score.accuracy).toBeCloseTo(2 / 3, 2);
    });

    it('複数セッションでの累積スコアを取得する', () => {
      // セッション1
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      // セッション2
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      const score = evaluator.getScore();
      // 2セッションで同じノートをヒット
      expect(score.correct).toBe(2);
      expect(score.total).toBe(2);
    });
  });

  describe('getMissedNotes', () => {
    it('見逃したノートを検出する', () => {
      evaluator.startNewPlaySession();

      // ノートをアクティブ化
      evaluator.updateActiveNotes(1000, testNotes);

      // 入力しないまま時間経過（終了時刻 + 許容範囲を超える）
      const missedNotes = evaluator.getMissedNotes(1750, testNotes);

      // 最初のノート(startTime=1000, duration=500)が見逃し
      expect(missedNotes.length).toBe(1);
      expect(missedNotes[0]).toBe('60-1000');
    });

    it('ヒットしたノートは見逃しに含まれない', () => {
      evaluator.startNewPlaySession();

      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      const missedNotes = evaluator.getMissedNotes(1750, testNotes);
      expect(missedNotes.length).toBe(0);
    });

    it('まだアクティブでないノートは見逃しに含まれない', () => {
      evaluator.startNewPlaySession();

      const missedNotes = evaluator.getMissedNotes(500, testNotes);
      expect(missedNotes.length).toBe(0);
    });
  });

  describe('getHitableNotes', () => {
    it('ヒット可能なノートを取得する', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      const hitableNotes = evaluator.getHitableNotes(60, 1000, testNotes);

      expect(hitableNotes.length).toBe(1);
      expect(hitableNotes[0]!.noteId).toBe('60-1000');
      expect(hitableNotes[0]!.timingDiff).toBe(0);
    });

    it('音程が一致しないノートは含まれない', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      const hitableNotes = evaluator.getHitableNotes(62, 1000, testNotes);
      expect(hitableNotes.length).toBe(0);
    });

    it('既にヒットしたノートは含まれない', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      const hitableNotes = evaluator.getHitableNotes(60, 1000, testNotes);
      expect(hitableNotes.length).toBe(0);
    });
  });

  describe('startNewPlaySession', () => {
    it('新しいセッションを開始する', () => {
      evaluator.startNewPlaySession();

      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      // 新しいセッションでは同じノートを再度ヒットできる
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      const result = evaluator.evaluateInput(60, 1000, testNotes);
      expect(result.isHit).toBe(true);
    });

    it('開始時刻を指定すると、それより前のノートは無視される', () => {
      evaluator.startNewPlaySession(2500);

      evaluator.updateActiveNotes(3000, testNotes);

      const score = evaluator.getScore();
      // 2500ms以降のノート(index 2)のみアクティブ
      expect(score.total).toBe(1);
    });
  });

  describe('reset', () => {
    it('全てのスコアと状態をリセットする', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      evaluator.reset();

      const score = evaluator.getScore();
      expect(score.correct).toBe(0);
      expect(score.total).toBe(0);
      expect(score.accuracy).toBe(1.0);
    });

    it('リセット後は同じノートを再度ヒットできる', () => {
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      evaluator.reset();
      evaluator.startNewPlaySession();
      evaluator.updateActiveNotes(1000, testNotes);

      const result = evaluator.evaluateInput(60, 1000, testNotes);
      expect(result.isHit).toBe(true);
    });
  });

  describe('複合シナリオ', () => {
    it('部分リピートの動作をシミュレート', () => {
      // セッション1: 0-2000msを演奏
      evaluator.startNewPlaySession(0);
      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);
      evaluator.updateActiveNotes(2000, testNotes);
      // 2つ目は入力しない

      // セッション2: 1000-3000msをリピート
      evaluator.startNewPlaySession(1000);
      evaluator.updateActiveNotes(2000, testNotes);
      evaluator.evaluateInput(62, 2000, testNotes);
      evaluator.updateActiveNotes(3000, testNotes);
      evaluator.evaluateInput(64, 3000, testNotes);

      const score = evaluator.getScore();
      // セッション1で1つ、セッション2で2つ成功
      expect(score.correct).toBe(3);
    });

    it('同じ音程の異なるノートを区別する', () => {
      evaluator.startNewPlaySession();

      // 最初のC(60)をヒット
      evaluator.updateActiveNotes(1000, testNotes);
      evaluator.evaluateInput(60, 1000, testNotes);

      // 2つ目のC(60)もヒット可能（異なるノート）
      evaluator.updateActiveNotes(4000, testNotes);
      const result = evaluator.evaluateInput(60, 4000, testNotes);
      expect(result.isHit).toBe(true);

      const score = evaluator.getScore();
      expect(score.correct).toBe(2);
    });
  });
});
