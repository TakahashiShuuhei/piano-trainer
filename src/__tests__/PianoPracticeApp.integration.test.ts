import { PianoPracticeApp } from '../app/PianoPracticeApp';

// DOM要素のモック
const mockCanvas = {
  getContext: jest.fn(() => ({
    scale: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    quadraticCurveTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillText: jest.fn(),
    setLineDash: jest.fn(),
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn()
    }))
  })),
  getBoundingClientRect: jest.fn(() => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600
  })),
  width: 800,
  height: 600
};

// DOM要素のモック設定
Object.defineProperty(document, 'getElementById', {
  value: jest.fn((id: string) => {
    if (id === 'gameCanvas') return mockCanvas;
    return {
      textContent: '',
      style: { display: '' },
      disabled: false,
      className: '',
      addEventListener: jest.fn()
    };
  })
});

Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  value: 1,
});

Object.defineProperty(window, 'addEventListener', {
  value: jest.fn()
});

global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

describe('PianoPracticeApp Integration with BeatTimeConverter', () => {
  let app: PianoPracticeApp;

  beforeEach(() => {
    app = new PianoPracticeApp();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (app) {
      app.destroy();
    }
  });

  describe('BPM management', () => {
    it('should initialize with default BPM of 120', async () => {
      await app.initialize();
      expect(app.getBPM()).toBe(120);
    });

    it('should allow BPM changes', async () => {
      await app.initialize();
      
      app.setBPM(140);
      expect(app.getBPM()).toBe(140);
      
      app.setBPM(90);
      expect(app.getBPM()).toBe(90);
    });

    it('should reject invalid BPM values', async () => {
      await app.initialize();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      app.setBPM(0);
      expect(app.getBPM()).toBe(120); // Should remain unchanged
      expect(consoleSpy).toHaveBeenCalledWith('BPM must be greater than 0');
      
      app.setBPM(-10);
      expect(app.getBPM()).toBe(120); // Should remain unchanged
      
      consoleSpy.mockRestore();
    });
  });

  describe('musical notes integration', () => {
    it('should load sample notes successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await app.initialize();
      
      // Check that sample notes were loaded
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Musical notes loaded:'));
      expect(consoleSpy).toHaveBeenCalledWith('Current BPM:', 120);
      
      consoleSpy.mockRestore();
    });

    it('should update note timings when BPM changes', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await app.initialize();
      
      // Change BPM and verify it was updated
      app.setBPM(160);
      
      expect(consoleSpy).toHaveBeenCalledWith('BPM changed to: 160');
      expect(app.getBPM()).toBe(160);
      
      consoleSpy.mockRestore();
    });
  });

  describe('initialization', () => {
    it('should initialize all components successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await app.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('Piano Practice App ready');
      
      consoleSpy.mockRestore();
    });

    it('should handle initialization errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock getElementById to return null for canvas
      const originalGetElementById = document.getElementById;
      document.getElementById = jest.fn((id: string) => {
        if (id === 'gameCanvas') return null;
        return originalGetElementById.call(document, id);
      });
      
      await app.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize app:', expect.any(Error));
      
      // Restore
      document.getElementById = originalGetElementById;
      consoleSpy.mockRestore();
    });
  });
});