import { GameState, GamePhase, Note, ScoreResult } from '../types/index.js';

/**
 * Canvas APIを使用したゲーム画面の描画とアニメーション管理
 */
export class UIRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private theme: 'light' | 'dark' = 'dark';

  // 描画設定
  private readonly colors = {
    light: {
      background: '#ffffff',
      primary: '#000000',
      secondary: '#666666',
      accent: '#007bff',
      success: '#28a745',
      error: '#dc3545',
      note: '#007bff',
      noteHit: '#28a745',
      whiteKey: '#ffffff',
      blackKey: '#333333',
      whiteKeyNote: '#4dabf7',
      blackKeyNote: '#ff9800',
      timingLine: '#ffd700',
      noteTrail: 'rgba(77, 171, 247, 0.3)',
      chord: '#9c27b0'
    },
    dark: {
      background: '#1a1a1a',
      primary: '#ffffff',
      secondary: '#cccccc',
      accent: '#4dabf7',
      success: '#51cf66',
      error: '#ff6b6b',
      note: '#4dabf7',
      noteHit: '#51cf66',
      whiteKey: '#f5f5f5',
      blackKey: '#2a2a2a',
      whiteKeyNote: '#4dabf7',
      blackKeyNote: '#ff9800',
      timingLine: '#ffd700',
      noteTrail: 'rgba(77, 171, 247, 0.3)',
      chord: '#9c27b0'
    }
  };

  // 鍵盤レイアウト設定（88鍵盤対応）
  private readonly keyboardLayout = {
    whiteKeys: [0, 2, 4, 5, 7, 9, 11], // C, D, E, F, G, A, B
    blackKeys: [1, 3, 6, 8, 10], // C#, D#, F#, G#, A#
    // 88鍵盤: A0(21) から C8(108) まで
    // A0=21, A#0=22, B0=23, C1=24, ..., C8=108
    midiRange: { min: 21, max: 108 }, // A0 to C8 (88 keys)
    whiteKeyWidth: 0,
    blackKeyWidth: 0,
    whiteKeyHeight: 0,
    blackKeyHeight: 0
  };

  // ノート状態管理
  private noteStates = new Map<string, 'pending' | 'hit' | 'missed'>();

  // 現在押されている鍵盤の追跡
  private pressedKeys = new Set<number>();

  // 演奏ガイド用の鍵盤状態
  private currentTargetKeys = new Set<number>(); // 今押すべき鍵盤（ノート期間中のみ）

  /**
   * Canvasエレメントを初期化し、描画コンテキストを取得
   */
  initCanvas(canvasElement: HTMLCanvasElement): void {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    if (!this.ctx) {
      throw new Error('Canvas 2D context could not be obtained');
    }

    // Canvas サイズを設定
    this.resizeCanvas();

    // リサイズイベントリスナーを追加
    window.addEventListener('resize', () => this.resizeCanvas());


  }

  /**
   * Canvasサイズを画面サイズに合わせて調整
   */
  private resizeCanvas(): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;

    if (this.ctx) {
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    // 鍵盤レイアウトを再計算
    this.calculateKeyboardLayout();
  }

  /**
   * 鍵盤レイアウトを計算（88鍵盤対応）
   */
  private calculateKeyboardLayout(): void {
    if (!this.canvas) return;

    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // 鍵盤エリアの設定
    const keyboardHeight = height * 0.2;
    
    // 88鍵盤の白鍵数を計算
    // A0, A#0, B0 (オクターブ0: 白鍵2個 - A0, B0)
    // C1-B1 から C7-B7 (7オクターブ: 白鍵 7×7=49個)
    // C8 (オクターブ8: 白鍵1個)
    // 合計: 2 + 49 + 1 = 52個の白鍵
    const totalWhiteKeys = 52;

    this.keyboardLayout.whiteKeyWidth = width / totalWhiteKeys;
    this.keyboardLayout.blackKeyWidth = this.keyboardLayout.whiteKeyWidth * 0.6;
    this.keyboardLayout.whiteKeyHeight = keyboardHeight;
    this.keyboardLayout.blackKeyHeight = keyboardHeight * 0.6;
  }

  // 現在のBPMを保持（外部から設定）
  private currentBPM: number = 120;

  /**
   * ゲーム状態とノート情報を基に画面を描画
   */
  render(gameState: GameState, notes: Note[]): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];

    // 背景をクリア
    this.clearCanvas();

    // 背景を描画
    this.drawBackground();

    // ゲーム情報を描画
    this.drawGameInfo(gameState);

    // カウントダウン表示
    if (gameState.phase === GamePhase.COUNTDOWN && gameState.countdownValue !== undefined) {
      this.drawCountdown(gameState.countdownValue);
    } else {
      // ノートを描画（カウントダウン中以外）
      this.drawNotes(notes, gameState.currentTime);
    }

    // 鍵盤エリアを描画
    this.drawKeyboard();
  }

  /**
   * 現在のBPMを設定
   */
  public setBPM(bpm: number): void {
    this.currentBPM = bpm;
  }

  /**
   * 演奏ガイド：現在押すべき鍵盤を設定
   */
  public setCurrentTargetKeys(keys: number[]): void {
    this.currentTargetKeys.clear();
    keys.forEach(key => this.currentTargetKeys.add(key));
  }

  /**
   * 演奏ガイドをクリア
   */
  public clearTargetKeys(): void {
    this.currentTargetKeys.clear();
  }

  /**
   * 背景をクリア
   */
  private clearCanvas(): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    this.ctx.fillStyle = currentColors.background;
    this.ctx.fillRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);
  }

  /**
   * 背景を描画
   */
  private drawBackground(): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // グラデーション背景
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, currentColors.background);
    gradient.addColorStop(1, this.theme === 'dark' ? '#2a2a2a' : '#f8f9fa');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * ゲーム情報（スコア、正解率等）を描画
   */
  private drawGameInfo(gameState: GameState): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;

    this.ctx.fillStyle = currentColors.primary;
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'left';

    // スコア表示（正解数 / 通過数）
    const totalNotes = gameState.totalNotes || 0;
    this.ctx.fillText(`正解: ${gameState.score} / ${totalNotes}`, 20, 40);

    // 正解率表示
    this.ctx.fillText(`正解率: ${(gameState.accuracy * 100).toFixed(1)}%`, 20, 70);

    // 再生状態表示
    this.ctx.fillStyle = gameState.isPlaying ? currentColors.success : currentColors.secondary;
    this.ctx.fillText(gameState.isPlaying ? 'Playing' : 'Paused', width - 120, 40);
  }

  /**
   * ノートを描画（音ゲー風の落下ノート）
   */
  private drawNotes(notes: Note[], currentTime: number): void {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // 鍵盤エリアの高さ（画面下部20%）
    const keyboardHeight = height * 0.2;
    const noteAreaHeight = height - keyboardHeight;

    // タイミングラインを描画
    this.drawTimingLine(height - keyboardHeight);

    // ノートをグループ化（コード検出）
    const noteGroups = this.groupNotesByTiming(notes, currentTime);

    noteGroups.forEach(group => {
      if (group.notes.length > 1) {
        // コード（和音）として描画
        this.drawChord(group.notes, group.timing, currentTime, noteAreaHeight);
      } else if (group.notes.length === 1 && group.notes[0]) {
        // 単音として描画
        this.drawSingleNote(group.notes[0], currentTime, noteAreaHeight);
      }
    });
  }

  /**
   * タイミングラインを描画
   */
  private drawTimingLine(y: number): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;

    this.ctx.strokeStyle = currentColors.timingLine;
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([10, 5]);

    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(width, y);
    this.ctx.stroke();

    this.ctx.setLineDash([]); // リセット
  }

  /**
   * ノートをタイミングでグループ化
   */
  private groupNotesByTiming(notes: Note[], currentTime: number): Array<{ notes: Note[], timing: number }> {
    const groups = new Map<number, Note[]>();
    const tolerance = 50; // 50ms以内は同じタイミングとみなす

    let visibleNotesCount = 0;

    notes.forEach(note => {
      // 表示範囲内のノートのみ処理
      const showTime = note.startTime - 2000;
      const hideTime = note.startTime + note.duration;

      if (currentTime >= showTime && currentTime <= hideTime) {
        visibleNotesCount++;
        let foundGroup = false;

        for (const [timing, groupNotes] of groups) {
          if (Math.abs(note.startTime - timing) <= tolerance) {
            groupNotes.push(note);
            foundGroup = true;
            break;
          }
        }

        if (!foundGroup) {
          groups.set(note.startTime, [note]);
        }
      }
    });

    return Array.from(groups.entries()).map(([timing, notes]) => ({
      notes,
      timing
    }));
  }

  /**
   * 単音ノートを描画
   */
  private drawSingleNote(note: Note, currentTime: number, noteAreaHeight: number): void {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width / window.devicePixelRatio;

    // ノートの表示タイミングを計算
    const showTime = note.startTime - 2000;
    const progress = Math.max(0, Math.min(1, (currentTime - showTime) / 2000));
    const y = progress * noteAreaHeight;

    // ノートの水平位置を計算
    const x = this.getPreciseNoteXPosition(note.pitch, width);

    // ノートの状態を取得
    const noteId = `${note.pitch}-${note.startTime}`;
    const state = this.noteStates.get(noteId) || 'pending';

    // ノートトレイルを描画
    this.drawNoteTrail(x, y, progress);

    // ノートを描画
    this.drawNote(x, y, note, state, currentTime >= note.startTime);
  }

  /**
   * コード（和音）を描画
   */
  private drawChord(notes: Note[], timing: number, currentTime: number, noteAreaHeight: number): void {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width / window.devicePixelRatio;
    const currentColors = this.colors[this.theme];

    // コードの表示タイミングを計算
    const showTime = timing - 2000;
    const progress = Math.max(0, Math.min(1, (currentTime - showTime) / 2000));
    const y = progress * noteAreaHeight;

    // コードの範囲を計算
    const positions = notes.map(note => this.getPreciseNoteXPosition(note.pitch, width));
    const minX = Math.min(...positions);
    const maxX = Math.max(...positions);

    // コード背景を描画
    this.ctx.fillStyle = currentColors.chord + '20'; // 透明度20%
    this.ctx.fillRect(minX - 10, y - 5, maxX - minX + 20, 30);

    // 個別のノートを描画
    notes.forEach(note => {
      const x = this.getPreciseNoteXPosition(note.pitch, width);
      const noteId = `${note.pitch}-${note.startTime}`;
      const state = this.noteStates.get(noteId) || 'pending';

      this.drawNote(x, y, note, state, currentTime >= timing);
    });

    // コード名を表示
    if (notes.length >= 3) {
      const chordName = this.getChordName(notes);
      this.ctx.fillStyle = currentColors.chord;
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(chordName, (minX + maxX) / 2, y - 10);
    }
  }

  /**
   * ノートトレイルを描画
   */
  private drawNoteTrail(x: number, y: number, progress: number): void {
    if (!this.ctx || progress <= 0) return;

    const currentColors = this.colors[this.theme];
    const trailLength = 50;

    this.ctx.strokeStyle = currentColors.noteTrail;
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.moveTo(x, Math.max(0, y - trailLength));
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  /**
   * 単一のノートを描画
   */
  private drawNote(x: number, y: number, note: Note, state: 'pending' | 'hit' | 'missed', isActive: boolean): void {
    if (!this.ctx) return;

    const currentColors = this.colors[this.theme];
    const isBlackKey = this.isBlackKey(note.pitch);

    // ノートサイズを鍵盤タイプに応じて調整
    const noteWidth = isBlackKey ? this.keyboardLayout.blackKeyWidth * 0.8 : this.keyboardLayout.whiteKeyWidth * 0.8;
    const noteHeight = 25;

    // 演奏ガイド状態をチェック
    const isCurrentTarget = this.currentTargetKeys.has(note.pitch);

    // ノートの色を状態に応じて決定
    let noteColor: string;
    switch (state) {
      case 'hit':
        noteColor = currentColors.success;
        break;
      case 'missed':
        noteColor = currentColors.error;
        break;
      default:
        if (isCurrentTarget) {
          // 今押すべきノートは緑で強調
          noteColor = currentColors.success;
        } else {
          // 通常のノート
          noteColor = isBlackKey ? currentColors.blackKeyNote : currentColors.whiteKeyNote;
        }
    }

    // アクティブ状態またはターゲット状態の場合は光らせる
    if ((isActive && state === 'pending') || isCurrentTarget) {
      this.ctx.shadowColor = noteColor;
      this.ctx.shadowBlur = isCurrentTarget ? 15 : 10;
    }

    this.ctx.fillStyle = noteColor;

    // ノートを描画（黒鍵は少し小さく）
    if (isBlackKey) {
      this.drawRoundedRect(x - noteWidth / 2, y, noteWidth, noteHeight, 3);
    } else {
      this.drawRoundedRect(x - noteWidth / 2, y, noteWidth, noteHeight, 5);
    }

    // 影をリセット
    this.ctx.shadowBlur = 0;

    // ターゲットノートの場合は境界線を追加
    if (isCurrentTarget) {
      this.ctx.strokeStyle = currentColors.success;
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x - noteWidth / 2, y, noteWidth, noteHeight);
    }

    // ノート名を表示
    this.ctx.fillStyle = this.getContrastColor(noteColor);
    this.ctx.font = isBlackKey ? '10px Arial' : '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.midiNoteToName(note.pitch), x, y + 15);

    // ベロシティインジケーター
    if (note.velocity && note.velocity < 127) {
      const velocityHeight = (note.velocity / 127) * 3;
      this.ctx.fillStyle = currentColors.accent;
      this.ctx.fillRect(x - noteWidth / 2 - 2, y + noteHeight - velocityHeight, 2, velocityHeight);
    }
  }

  /**
   * 鍵盤エリアを描画
   */
  private drawKeyboard(): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // 鍵盤エリアの位置とサイズ
    const keyboardHeight = height * 0.2;
    const keyboardY = height - keyboardHeight;

    // 白鍵を先に描画
    this.drawWhiteKeys(keyboardY, keyboardHeight);

    // 黒鍵を後に描画（白鍵の上に重ねる）
    this.drawBlackKeys(keyboardY, keyboardHeight);

    // 鍵盤の境界線
    this.ctx.strokeStyle = currentColors.primary;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, keyboardY, width, keyboardHeight);
  }

  /**
   * 白鍵を描画（88鍵盤対応）
   */
  private drawWhiteKeys(keyboardY: number, keyboardHeight: number): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    let whiteKeyIndex = 0;

    // 88鍵盤の白鍵を順番に描画
    for (let midiNote = this.keyboardLayout.midiRange.min; midiNote <= this.keyboardLayout.midiRange.max; midiNote++) {
      const noteInOctave = midiNote % 12;
      
      // 白鍵のみ描画
      if (this.keyboardLayout.whiteKeys.includes(noteInOctave)) {
        const x = whiteKeyIndex * this.keyboardLayout.whiteKeyWidth;

        // 白鍵を描画（押下状態とガイド状態を考慮）
        const isPressed = this.pressedKeys.has(midiNote);
        const isCurrentTarget = this.currentTargetKeys.has(midiNote);

        let keyColor: string;
        if (isPressed) {
          keyColor = currentColors.accent; // 押されている（青）
        } else if (isCurrentTarget) {
          keyColor = currentColors.success; // 今押すべき（緑）
        } else {
          keyColor = currentColors.whiteKey; // 通常（白）
        }

        this.ctx!.fillStyle = keyColor;
        this.ctx!.fillRect(x, keyboardY, this.keyboardLayout.whiteKeyWidth, keyboardHeight);

        // 境界線（ガイド状態に応じて調整）
        let strokeColor: string;
        let lineWidth: number;
        
        if (isPressed) {
          strokeColor = currentColors.primary;
          lineWidth = 3;
        } else if (isCurrentTarget) {
          strokeColor = currentColors.success;
          lineWidth = 3;
        } else {
          strokeColor = currentColors.secondary;
          lineWidth = 1;
        }

        this.ctx!.strokeStyle = strokeColor;
        this.ctx!.lineWidth = lineWidth;
        this.ctx!.strokeRect(x, keyboardY, this.keyboardLayout.whiteKeyWidth, keyboardHeight);

        // ノート名を表示（小さなフォントで）
        this.ctx!.fillStyle = '#000000';
        this.ctx!.font = 'bold 8px Arial'; // フォントサイズを小さく
        this.ctx!.textAlign = 'center';
        this.ctx!.fillText(
          this.midiNoteToName(midiNote),
          x + this.keyboardLayout.whiteKeyWidth / 2,
          keyboardY + keyboardHeight - 6
        );

        whiteKeyIndex++;
      }
    }
  }

  /**
   * 黒鍵を描画（88鍵盤対応）
   */
  private drawBlackKeys(keyboardY: number, keyboardHeight: number): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    let whiteKeyIndex = 0;

    // 88鍵盤の黒鍵を描画
    for (let midiNote = this.keyboardLayout.midiRange.min; midiNote <= this.keyboardLayout.midiRange.max; midiNote++) {
      const noteInOctave = midiNote % 12;
      
      // 白鍵の位置をカウント（黒鍵の位置計算のため）
      if (this.keyboardLayout.whiteKeys.includes(noteInOctave)) {
        whiteKeyIndex++;
      }
      
      // 黒鍵のみ描画
      if (this.keyboardLayout.blackKeys.includes(noteInOctave)) {
        // 黒鍵の位置を計算（直前の白鍵の右端に配置）
        const x = (whiteKeyIndex - 1) * this.keyboardLayout.whiteKeyWidth + 
                  this.keyboardLayout.whiteKeyWidth - this.keyboardLayout.blackKeyWidth / 2;

        // 黒鍵を描画（押下状態とガイド状態を考慮）
        const isPressed = this.pressedKeys.has(midiNote);
        const isCurrentTarget = this.currentTargetKeys.has(midiNote);

        let keyColor: string;
        if (isPressed) {
          keyColor = currentColors.accent; // 押されている（青）
        } else if (isCurrentTarget) {
          keyColor = currentColors.success; // 今押すべき（緑）
        } else {
          keyColor = currentColors.blackKey; // 通常（黒）
        }

        this.ctx!.fillStyle = keyColor;
        this.ctx!.fillRect(x, keyboardY, this.keyboardLayout.blackKeyWidth, this.keyboardLayout.blackKeyHeight);

        // 境界線（ガイド状態に応じて調整）
        let strokeColor: string;
        let lineWidth: number;
        
        if (isPressed) {
          strokeColor = currentColors.primary;
          lineWidth = 4;
        } else if (isCurrentTarget) {
          strokeColor = currentColors.success;
          lineWidth = 3;
        } else {
          strokeColor = currentColors.primary;
          lineWidth = 1;
        }

        this.ctx!.strokeStyle = strokeColor;
        this.ctx!.lineWidth = lineWidth;
        this.ctx!.strokeRect(x, keyboardY, this.keyboardLayout.blackKeyWidth, this.keyboardLayout.blackKeyHeight);

        // ノート名を表示（白色で見やすく、小さなフォント）
        this.ctx!.fillStyle = '#ffffff';
        this.ctx!.font = 'bold 7px Arial'; // フォントサイズを小さく
        this.ctx!.textAlign = 'center';
        this.ctx!.fillText(
          this.midiNoteToName(midiNote),
          x + this.keyboardLayout.blackKeyWidth / 2,
          keyboardY + this.keyboardLayout.blackKeyHeight - 4
        );
      }
    }
  }

  /**
   * ノートヒット時の視覚エフェクトを表示
   */
  showNoteHit(note: Note, result: ScoreResult): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    const x = this.getPreciseNoteXPosition(note.pitch, width);
    const y = height - (height * 0.1); // 鍵盤エリアの上部

    // ノート状態を更新
    const noteId = `${note.pitch}-${note.startTime}`;
    this.noteStates.set(noteId, result.isCorrect ? 'hit' : 'missed');

    // 結果に応じた色を選択
    let color: string;
    switch (result.feedback) {
      case 'perfect':
        color = currentColors.success;
        break;
      case 'good':
        color = currentColors.accent;
        break;
      case 'miss':
        color = currentColors.error;
        break;
      default:
        color = currentColors.secondary;
    }

    // エフェクト円を描画（サイズを調整）
    const effectSize = result.feedback === 'perfect' ? 40 : result.feedback === 'good' ? 30 : 25;

    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.8;
    this.ctx.beginPath();
    this.ctx.arc(x, y, effectSize, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;

    // フィードバックテキストを表示
    this.ctx.fillStyle = this.getContrastColor(color);
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(result.feedback.toUpperCase(), x, y + 5);

    // スコアを表示
    if (result.points > 0) {
      this.ctx.fillStyle = currentColors.success;
      this.ctx.font = '12px Arial';
      this.ctx.fillText(`+${result.points}`, x, y - 25);
    }

    // エフェクトを一定時間後にフェードアウト
    setTimeout(() => {
      this.fadeOutEffect(x, y, color, effectSize);
    }, 500);
  }

  /**
   * エフェクトのフェードアウト
   */
  private fadeOutEffect(x: number, y: number, color: string, size: number): void {
    if (!this.ctx) return;

    let alpha = 0.8;
    const fadeInterval = setInterval(() => {
      if (alpha <= 0) {
        clearInterval(fadeInterval);
        return;
      }

      // 前のエフェクトをクリア（簡易版）
      this.ctx!.globalAlpha = alpha;
      this.ctx!.fillStyle = color;
      this.ctx!.beginPath();
      this.ctx!.arc(x, y, size * (1 + (0.8 - alpha)), 0, Math.PI * 2);
      this.ctx!.fill();
      this.ctx!.globalAlpha = 1.0;

      alpha -= 0.1;
    }, 50);
  }

  /**
   * ノート状態をクリア
   */
  clearNoteStates(): void {
    this.noteStates.clear();
  }

  /**
   * 特定のノートの状態を設定
   */
  setNoteState(note: Note, state: 'pending' | 'hit' | 'missed'): void {
    const noteId = `${note.pitch}-${note.startTime}`;
    this.noteStates.set(noteId, state);
  }

  /**
   * 鍵盤が押されたことを記録
   */
  setKeyPressed(pitch: number, pressed: boolean): void {
    if (pressed) {
      this.pressedKeys.add(pitch);
    } else {
      this.pressedKeys.delete(pitch);
    }
  }

  /**
   * すべての鍵盤の押下状態をクリア
   */
  clearPressedKeys(): void {
    this.pressedKeys.clear();
  }

  /**
   * スコア表示を更新
   */
  updateScore(score: number, accuracy: number): void {
    // render メソッドで描画されるため、ここでは特別な処理は不要

  }

  /**
   * メトロノームビートの視覚表示
   */
  showMetronome(beat: number): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;

    // メトロノームインジケーターを右上に表示
    const x = width - 60;
    const y = 80;

    this.ctx.fillStyle = beat === 1 ? currentColors.accent : currentColors.secondary;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 15, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = currentColors.background;
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(beat.toString(), x, y + 4);
  }

  /**
   * テーマを設定
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;

  }

  /**
   * アニメーションループを開始
   */
  startAnimationLoop(): void {
    if (this.animationId !== null) {
      return; // 既に開始されている
    }

    const animate = () => {
      // アニメーションフレームでの更新処理
      // 実際のゲーム状態は外部から render メソッドで渡される
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);

  }

  /**
   * アニメーションループを停止
   */
  stopAnimationLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;

    }
  }

  /**
   * ユーティリティ: 音程に基づいてノートのX座標を計算（88鍵盤対応）
   */
  private getPreciseNoteXPosition(pitch: number, canvasWidth: number): number {
    // 88鍵盤の範囲チェック
    if (pitch < this.keyboardLayout.midiRange.min || pitch > this.keyboardLayout.midiRange.max) {
      return -1; // 表示範囲外
    }

    const noteInOctave = pitch % 12;
    let whiteKeyIndex = 0;

    // 指定されたピッチまでの白鍵数をカウント（黒鍵描画と同じロジック）
    for (let midiNote = this.keyboardLayout.midiRange.min; midiNote <= pitch; midiNote++) {
      const currentNoteInOctave = midiNote % 12;
      
      // 白鍵の位置をカウント（黒鍵の位置計算のため）
      if (this.keyboardLayout.whiteKeys.includes(currentNoteInOctave)) {
        whiteKeyIndex++;
      }
      
      // 目的のピッチに到達したら処理を終了
      if (midiNote === pitch) {
        break;
      }
    }

    if (this.keyboardLayout.whiteKeys.includes(noteInOctave)) {
      // 白鍵の場合：中央に配置
      return (whiteKeyIndex - 1) * this.keyboardLayout.whiteKeyWidth + this.keyboardLayout.whiteKeyWidth / 2;
    } else {
      // 黒鍵の場合：黒鍵描画と同じ位置計算
      const x = (whiteKeyIndex - 1) * this.keyboardLayout.whiteKeyWidth + 
                this.keyboardLayout.whiteKeyWidth - this.keyboardLayout.blackKeyWidth / 2;
      // 黒鍵の中央を返す
      return x + this.keyboardLayout.blackKeyWidth / 2;
    }
  }

  /**
   * ユーティリティ: 音程に基づいてノートのX座標を計算（後方互換性）
   */
  private getNoteXPosition(pitch: number, canvasWidth: number): number {
    return this.getPreciseNoteXPosition(pitch, canvasWidth);
  }

  /**
   * ユーティリティ: 黒鍵かどうかを判定
   */
  private isBlackKey(pitch: number): boolean {
    const noteInOctave = pitch % 12;
    return this.keyboardLayout.blackKeys.includes(noteInOctave);
  }

  /**
   * ユーティリティ: コントラスト色を取得
   */
  private getContrastColor(backgroundColor: string): string {
    // 簡易的な実装：背景色に応じて白または黒を返す
    if (backgroundColor.includes('#ff') || backgroundColor.includes('#f') || backgroundColor.includes('white')) {
      return '#000000';
    }
    return '#ffffff';
  }

  /**
   * ユーティリティ: コード名を取得
   */
  private getChordName(notes: Note[]): string {
    if (notes.length < 3) return '';

    // 簡易的なコード判定（基本的な三和音のみ）
    const pitches = notes.map(note => note.pitch % 12).sort((a, b) => a - b);
    const intervals = [];

    for (let i = 1; i < pitches.length; i++) {
      const currentPitch = pitches[i];
      const rootPitch = pitches[0];
      if (currentPitch !== undefined && rootPitch !== undefined) {
        intervals.push(currentPitch - rootPitch);
      }
    }

    // 基本的なコードパターンを判定
    const intervalString = intervals.join(',');
    const firstNote = notes[0];
    if (!firstNote) return '';
    const rootNote = this.midiNoteToName(firstNote.pitch).replace(/\d+/, '');

    switch (intervalString) {
      case '4,7': return rootNote + 'maj';
      case '3,7': return rootNote + 'min';
      case '4,7,10': return rootNote + '7';
      case '3,7,10': return rootNote + 'm7';
      default: return rootNote + '?';
    }
  }

  /**
   * ユーティリティ: MIDIノート番号を音名に変換
   */
  private midiNoteToName(pitch: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(pitch / 12) - 1;
    const note = noteNames[pitch % 12];
    return `${note}${octave}`;
  }

  /**
   * ユーティリティ: 角丸矩形を描画
   */
  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    if (!this.ctx) return;

    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * カウントダウンを描画
   */
  private drawCountdown(countdownValue: number): void {
    if (!this.ctx || !this.canvas) return;

    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // 画面中央にカウントダウンを表示
    const centerX = width / 2;
    const centerY = height / 2;

    // カウントダウン値に応じて色を変更
    let countdownColor: string;
    if (countdownValue === 0) {
      countdownColor = currentColors.success; // START!
    } else if (countdownValue === 1) {
      countdownColor = currentColors.error; // 1
    } else if (countdownValue === 2) {
      countdownColor = currentColors.accent; // 2
    } else {
      countdownColor = currentColors.primary; // 4, 3
    }

    // 大きな円を描画
    this.ctx.fillStyle = countdownColor + '40'; // 透明度40%
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
    this.ctx.fill();

    // 円の境界線
    this.ctx.strokeStyle = countdownColor;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
    this.ctx.stroke();

    // カウントダウンテキストを描画
    this.ctx.fillStyle = countdownColor;
    this.ctx.font = 'bold 80px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const displayText = countdownValue === 0 ? 'START!' : countdownValue.toString();
    this.ctx.fillText(displayText, centerX, centerY);

    // BPM情報を表示
    this.ctx.fillStyle = currentColors.secondary;
    this.ctx.font = '24px Arial';
    this.ctx.fillText('準備してください', centerX, centerY + 80);

    // 小さなメトロノーム表示
    this.ctx.font = '16px Arial';
    this.ctx.fillText(`BPM: ${this.getCurrentBPM()}`, centerX, centerY + 110);
  }

  /**
   * 現在のBPMを取得
   */
  private getCurrentBPM(): number {
    return this.currentBPM;
  }

  /**
   * リソースのクリーンアップ
   */
  destroy(): void {
    this.stopAnimationLoop();

    if (this.canvas) {
      window.removeEventListener('resize', () => this.resizeCanvas());
    }

    this.canvas = null;
    this.ctx = null;

  }
}