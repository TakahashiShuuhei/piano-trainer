import { UIRenderer } from '../components/UIRenderer';
import { GameState, Note, ScoreResult } from '../types/index';

// Canvas APIのモック
class MockCanvasRenderingContext2D {
  fillStyle: string = '#000000';
  strokeStyle: string = '#000000';
  lineWidth: number = 1;
  font: string = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  globalAlpha: number = 1;
  shadowColor: string = '#000000';
  shadowBlur: number = 0;

  fillRect = jest.fn();
  strokeRect = jest.fn();
  clearRect = jest.fn();
  beginPath = jest.fn();
  moveTo = jest.fn();
  lineTo = jest.fn();
  arc = jest.fn();
  quadraticCurveTo = jest.fn();
  closePath = jest.fn();
  fill = jest.fn();
  stroke = jest.fn();
  fillText = jest.fn();
  setLineDash = jest.fn();
  createLinearGradient = jest.fn(() => ({
    addColorStop: jest.fn()
  }));
  scale = jest.fn();
}

class MockHTMLCanvasElement {
  width: number = 800;
  height: number = 600;
  
  getContext = jest.fn();
  getBoundingClientRect = jest.fn(() => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600
  }));
}

// グローバルモック
Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  value: 1,
});

global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

describe('UIRenderer', () => {
  let renderer: UIRenderer;
  let mockCanvas: MockHTMLCanvasElement;
  let mockCtx: MockCanvasRenderingContext2D;

  beforeEach(() => {
    renderer = new UIRenderer();
    mockCanvas = new MockHTMLCanvasElement();
    mockCtx = new MockCanvasRenderingContext2D();
    mockCanvas.getContext.mockReturnValue(mockCtx);
    
    // addEventListener のモック
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initCanvas', () => {
    it('should initialize canvas and context successfully', () => {
      renderer.initCanvas(mockCanvas as any);
      
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      expect(mockCtx.scale).toHaveBeenCalledWith(1, 1);
      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should throw error if 2D context cannot be obtained', () => {
      mockCanvas.getContext.mockReturnValue(null);
      
      expect(() => {
        renderer.initCanvas(mockCanvas as any);
      }).toThrow('Canvas 2D context could not be obtained');
    });
  });

  describe('render', () => {
    beforeEach(() => {
      renderer.initCanvas(mockCanvas as any);
    });

    it('should render game state and notes', () => {
      const gameState: GameState = {
        isPlaying: true,
        currentTime: 1000,
        score: 100,
        accuracy: 0.95,
        currentMeasure: 2
      };

      const notes: Note[] = [
        {
          pitch: 60, // C4
          startTime: 2000,
          duration: 500,
          velocity: 80
        }
      ];

      renderer.render(gameState, notes);

      // 背景描画の確認
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.createLinearGradient).toHaveBeenCalled();

      // テキスト描画の確認
      expect(mockCtx.fillText).toHaveBeenCalledWith('Score: 100', 20, 40);
      expect(mockCtx.fillText).toHaveBeenCalledWith('Accuracy: 95.0%', 20, 70);
      expect(mockCtx.fillText).toHaveBeenCalledWith('Measure: 2', 20, 100);
      expect(mockCtx.fillText).toHaveBeenCalledWith('Playing', expect.any(Number), 40);
      
      // タイミングラインの描画確認
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.setLineDash).toHaveBeenCalled();
    });

    it('should render notes within display time window', () => {
      const gameState: GameState = {
        isPlaying: true,
        currentTime: 1500, // 0.5秒前（表示範囲内）
        score: 0,
        accuracy: 1.0,
        currentMeasure: 1
      };

      const notes: Note[] = [
        {
          pitch: 60,
          startTime: 2000,
          duration: 500,
          velocity: 80
        }
      ];

      renderer.render(gameState, notes);

      // ノート描画のための beginPath が呼ばれることを確認
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      
      // 鍵盤描画の確認
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it('should not render notes outside display time window', () => {
      const gameState: GameState = {
        isPlaying: true,
        currentTime: 5000, // ノート終了後（表示範囲外）
        score: 0,
        accuracy: 1.0,
        currentMeasure: 1
      };

      const notes: Note[] = [
        {
          pitch: 60,
          startTime: 2000,
          duration: 500,
          velocity: 80
        }
      ];

      // モックをリセットして呼び出し回数をカウント
      jest.clearAllMocks();
      renderer.render(gameState, notes);
      
      // 鍵盤のノート名は描画されるが、落下ノートは描画されない
      // 落下ノートの描画確認：beginPath の呼び出し回数で判定
      const pathCalls = mockCtx.beginPath.mock.calls.length;
      // 鍵盤描画以外のbeginPath呼び出しが少ないことを確認
      expect(pathCalls).toBeLessThan(10); // 鍵盤描画のみの場合
    });
  });

  describe('showNoteHit', () => {
    beforeEach(() => {
      renderer.initCanvas(mockCanvas as any);
    });

    it('should show perfect hit effect', () => {
      const note: Note = {
        pitch: 60,
        startTime: 1000,
        duration: 500,
        velocity: 80
      };

      const result: ScoreResult = {
        isCorrect: true,
        timingAccuracy: 0.95,
        points: 100,
        feedback: 'perfect'
      };

      renderer.showNoteHit(note, result);

      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('PERFECT', expect.any(Number), expect.any(Number));
    });

    it('should show miss effect', () => {
      const note: Note = {
        pitch: 60,
        startTime: 1000,
        duration: 500,
        velocity: 80
      };

      const result: ScoreResult = {
        isCorrect: false,
        timingAccuracy: 0.3,
        points: 0,
        feedback: 'miss'
      };

      renderer.showNoteHit(note, result);

      expect(mockCtx.fillText).toHaveBeenCalledWith('MISS', expect.any(Number), expect.any(Number));
    });
  });

  describe('showMetronome', () => {
    beforeEach(() => {
      renderer.initCanvas(mockCanvas as any);
    });

    it('should show metronome beat indicator', () => {
      renderer.showMetronome(1);

      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number));
    });

    it('should show different visual for beat 1 vs other beats', () => {
      // Beat 1 (強拍) - accent color が使用される
      renderer.showMetronome(1);
      
      // Beat 2 (弱拍) - secondary color が使用される  
      renderer.showMetronome(2);

      // メトロノーム表示が呼ばれることを確認
      expect(mockCtx.arc).toHaveBeenCalledTimes(2);
      expect(mockCtx.fill).toHaveBeenCalledTimes(2);
      expect(mockCtx.fillText).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('2', expect.any(Number), expect.any(Number));
    });
  });

  describe('theme management', () => {
    it('should set theme to light', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderer.setTheme('light');
      
      expect(consoleSpy).toHaveBeenCalledWith('UIRenderer: Theme set to light');
      consoleSpy.mockRestore();
    });

    it('should set theme to dark', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderer.setTheme('dark');
      
      expect(consoleSpy).toHaveBeenCalledWith('UIRenderer: Theme set to dark');
      consoleSpy.mockRestore();
    });
  });

  describe('animation loop', () => {
    it('should start animation loop', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderer.startAnimationLoop();
      
      expect(requestAnimationFrame).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('UIRenderer: Animation loop started');
      consoleSpy.mockRestore();
    });

    it('should not start multiple animation loops', () => {
      renderer.startAnimationLoop();
      const callCount = (requestAnimationFrame as jest.Mock).mock.calls.length;
      
      renderer.startAnimationLoop(); // 2回目の呼び出し
      
      expect((requestAnimationFrame as jest.Mock).mock.calls.length).toBe(callCount);
    });

    it('should stop animation loop', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderer.startAnimationLoop();
      renderer.stopAnimationLoop();
      
      expect(cancelAnimationFrame).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('UIRenderer: Animation loop stopped');
      consoleSpy.mockRestore();
    });
  });

  describe('updateScore', () => {
    it('should log score update', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderer.updateScore(150, 0.87);
      
      expect(consoleSpy).toHaveBeenCalledWith('UIRenderer: Score updated - 150, Accuracy: 87.0%');
      consoleSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      renderer.initCanvas(mockCanvas as any);
    });

    it('should clean up resources', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderer.startAnimationLoop();
      renderer.destroy();
      
      expect(cancelAnimationFrame).toHaveBeenCalled();
      expect(window.removeEventListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('UIRenderer: Destroyed');
      consoleSpy.mockRestore();
    });
  });
});