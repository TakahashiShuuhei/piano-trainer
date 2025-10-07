import { GameState, Note, ScoreResult } from '../types/index.js';

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
      noteHit: '#28a745'
    },
    dark: {
      background: '#1a1a1a',
      primary: '#ffffff',
      secondary: '#cccccc',
      accent: '#4dabf7',
      success: '#51cf66',
      error: '#ff6b6b',
      note: '#4dabf7',
      noteHit: '#51cf66'
    }
  };

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
    
    console.log('UIRenderer: Canvas initialized');
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
  }

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
    
    // ノートを描画
    this.drawNotes(notes, gameState.currentTime);
    
    // 鍵盤エリアを描画
    this.drawKeyboard();
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
    
    // スコア表示
    this.ctx.fillText(`Score: ${gameState.score}`, 20, 40);
    
    // 正解率表示
    this.ctx.fillText(`Accuracy: ${(gameState.accuracy * 100).toFixed(1)}%`, 20, 70);
    
    // 現在の小節表示
    this.ctx.fillText(`Measure: ${gameState.currentMeasure}`, 20, 100);
    
    // 再生状態表示
    this.ctx.fillStyle = gameState.isPlaying ? currentColors.success : currentColors.secondary;
    this.ctx.fillText(gameState.isPlaying ? 'Playing' : 'Paused', width - 120, 40);
  }

  /**
   * ノートを描画（音ゲー風の落下ノート）
   */
  private drawNotes(notes: Note[], currentTime: number): void {
    if (!this.ctx || !this.canvas) return;
    
    const currentColors = this.colors[this.theme];
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;
    
    // 鍵盤エリアの高さ（画面下部20%）
    const keyboardHeight = height * 0.2;
    const noteAreaHeight = height - keyboardHeight;
    
    notes.forEach(note => {
      // ノートの表示タイミングを計算（2秒前から表示開始）
      const showTime = note.startTime - 2000;
      const hideTime = note.startTime + note.duration;
      
      if (currentTime >= showTime && currentTime <= hideTime) {
        // ノートの垂直位置を計算（時間に基づいて落下）
        const progress = (currentTime - showTime) / (note.startTime - showTime);
        const y = progress * noteAreaHeight;
        
        // ノートの水平位置を計算（音程に基づいて配置）
        const x = this.getNoteXPosition(note.pitch, width);
        
        // ノートを描画
        this.drawNote(x, y, note, currentTime >= note.startTime);
      }
    });
  }

  /**
   * 単一のノートを描画
   */
  private drawNote(x: number, y: number, note: Note, isActive: boolean): void {
    if (!this.ctx) return;
    
    const currentColors = this.colors[this.theme];
    const noteWidth = 40;
    const noteHeight = 20;
    
    // ノートの色を決定
    this.ctx.fillStyle = isActive ? currentColors.noteHit : currentColors.note;
    
    // ノートを矩形で描画
    this.drawRoundedRect(x - noteWidth / 2, y, noteWidth, noteHeight, 5);
    
    // ノート名を表示
    this.ctx.fillStyle = currentColors.background;
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.midiNoteToName(note.pitch), x, y + 14);
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
    
    // 鍵盤背景
    this.ctx.fillStyle = currentColors.secondary;
    this.ctx.fillRect(0, keyboardY, width, keyboardHeight);
    
    // 鍵盤の線を描画（オクターブごとに区切り）
    this.ctx.strokeStyle = currentColors.primary;
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i <= 12; i++) {
      const x = (width / 12) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(x, keyboardY);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
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
    
    const x = this.getNoteXPosition(note.pitch, width);
    const y = height - (height * 0.1); // 鍵盤エリアの上部
    
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
    
    // エフェクト円を描画
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.7;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 30, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
    
    // フィードバックテキストを表示
    this.ctx.fillStyle = currentColors.background;
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(result.feedback.toUpperCase(), x, y + 5);
  }

  /**
   * スコア表示を更新
   */
  updateScore(score: number, accuracy: number): void {
    // render メソッドで描画されるため、ここでは特別な処理は不要
    console.log(`UIRenderer: Score updated - ${score}, Accuracy: ${(accuracy * 100).toFixed(1)}%`);
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
    console.log(`UIRenderer: Theme set to ${theme}`);
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
    console.log('UIRenderer: Animation loop started');
  }

  /**
   * アニメーションループを停止
   */
  stopAnimationLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      console.log('UIRenderer: Animation loop stopped');
    }
  }

  /**
   * ユーティリティ: 音程に基づいてノートのX座標を計算
   */
  private getNoteXPosition(pitch: number, canvasWidth: number): number {
    // C4 (MIDI 60) を基準として、オクターブ内での位置を計算
    const noteInOctave = pitch % 12;
    const octaveWidth = canvasWidth / 2; // 2オクターブ分を表示
    const noteWidth = octaveWidth / 12;
    
    return (canvasWidth / 4) + (noteInOctave * noteWidth) + (noteWidth / 2);
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
   * リソースのクリーンアップ
   */
  destroy(): void {
    this.stopAnimationLoop();
    
    if (this.canvas) {
      window.removeEventListener('resize', () => this.resizeCanvas());
    }
    
    this.canvas = null;
    this.ctx = null;
    console.log('UIRenderer: Destroyed');
  }
}