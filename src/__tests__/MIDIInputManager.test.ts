import { MIDIInputManager } from '../components/MIDIInputManager';

// Mock Tone.js
jest.mock('tone', () => ({
  Frequency: jest.fn((note: number, unit: string) => ({
    toFrequency: () => 440 * Math.pow(2, (note - 69) / 12), // A4 = 440Hz
    toNote: () => {
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const octave = Math.floor(note / 12) - 1;
      const noteName = noteNames[note % 12];
      return `${noteName}${octave}`;
    }
  })),
  now: () => 0.5,
  Transport: {
    state: 'stopped',
    start: jest.fn(),
    seconds: 1.0
  },
  context: {
    currentTime: 1.0
  }
}));

// Mock Web MIDI API
const mockMIDIAccess = {
  inputs: new Map(),
  outputs: new Map(),
  onstatechange: null,
  sysexEnabled: false
};

const mockMIDIInput = {
  id: 'test-input-1',
  manufacturer: 'Test Manufacturer',
  name: 'Test MIDI Input',
  type: 'input' as const,
  version: '1.0',
  state: 'connected' as const,
  connection: 'closed' as const,
  onmidimessage: null as ((event: MIDIMessageEvent) => void) | null,
  onstatechange: null as ((event: MIDIConnectionEvent) => void) | null,
  open: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
} as unknown as MIDIInput;

// Global navigator mock
Object.defineProperty(global.navigator, 'requestMIDIAccess', {
  writable: true,
  value: jest.fn()
});

describe('MIDIInputManager', () => {
  let midiManager: MIDIInputManager;
  let mockRequestMIDIAccess: jest.Mock;

  beforeEach(() => {
    midiManager = new MIDIInputManager();
    mockRequestMIDIAccess = navigator.requestMIDIAccess as jest.Mock;
    
    // Reset mocks
    mockRequestMIDIAccess.mockClear();
    mockMIDIAccess.inputs.clear();
    mockMIDIInput.onmidimessage = null;
  });

  afterEach(() => {
    midiManager.disconnect();
  });

  describe('requestAccess', () => {
    it('should successfully request MIDI access', async () => {
      mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess);

      const result = await midiManager.requestAccess();

      expect(result).toBe(true);
      expect(mockRequestMIDIAccess).toHaveBeenCalled();
    });

    it('should handle MIDI access failure', async () => {
      mockRequestMIDIAccess.mockRejectedValue(new Error('MIDI access denied'));

      const result = await midiManager.requestAccess();

      expect(result).toBe(false);
    });

    it('should return false when Web MIDI API is not supported', async () => {
      // Temporarily remove requestMIDIAccess
      const originalRequestMIDIAccess = navigator.requestMIDIAccess;
      (navigator as any).requestMIDIAccess = undefined;

      const result = await midiManager.requestAccess();

      expect(result).toBe(false);

      // Restore
      (navigator as any).requestMIDIAccess = originalRequestMIDIAccess;
    });
  });

  describe('getAvailableDevices', () => {
    it('should return empty array when no MIDI access', () => {
      const devices = midiManager.getAvailableDevices();
      expect(devices).toEqual([]);
    });

    it('should return available MIDI input devices', async () => {
      mockMIDIAccess.inputs.set('test-input-1', mockMIDIInput);
      mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess);

      await midiManager.requestAccess();
      const devices = midiManager.getAvailableDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toBe(mockMIDIInput);
    });
  });

  describe('convertNoteToFrequency', () => {
    it('should convert MIDI note number to frequency', () => {
      // A4 (MIDI note 69) should be 440Hz
      const frequency = midiManager.convertNoteToFrequency(69);
      expect(frequency).toBe(440);
    });

    it('should convert C4 (MIDI note 60) correctly', () => {
      const frequency = midiManager.convertNoteToFrequency(60);
      // C4 should be approximately 261.63Hz
      expect(frequency).toBeCloseTo(261.63, 1);
    });
  });

  describe('convertNoteToNoteName', () => {
    it('should convert MIDI note number to note name', () => {
      const noteName = midiManager.convertNoteToNoteName(69);
      expect(noteName).toBe('A4');
    });

    it('should convert C4 (MIDI note 60) correctly', () => {
      const noteName = midiManager.convertNoteToNoteName(60);
      expect(noteName).toBe('C4');
    });
  });

  describe('MIDI message handling', () => {
    let noteOnCallback: jest.Mock;
    let noteOffCallback: jest.Mock;

    beforeEach(() => {
      noteOnCallback = jest.fn();
      noteOffCallback = jest.fn();
      
      midiManager.onNoteOn(noteOnCallback);
      midiManager.onNoteOff(noteOffCallback);
    });

    it('should handle Note On messages', async () => {
      mockMIDIAccess.inputs.set('test-input-1', mockMIDIInput);
      mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess);

      await midiManager.requestAccess();

      // Simulate Note On message (C4, velocity 100)
      const midiEvent = {
        data: new Uint8Array([0x90, 60, 100]), // Note On, channel 0, note 60, velocity 100
        timeStamp: performance.now()
      } as MIDIMessageEvent;

      // Trigger the MIDI message handler
      if (mockMIDIInput.onmidimessage) {
        mockMIDIInput.onmidimessage(midiEvent);
      }

      expect(noteOnCallback).toHaveBeenCalledWith(60, 100, expect.any(Number));
    });

    it('should handle Note Off messages', async () => {
      mockMIDIAccess.inputs.set('test-input-1', mockMIDIInput);
      mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess);

      await midiManager.requestAccess();

      // Simulate Note Off message (C4)
      const midiEvent = {
        data: new Uint8Array([0x80, 60, 0]), // Note Off, channel 0, note 60
        timeStamp: performance.now()
      } as MIDIMessageEvent;

      // Trigger the MIDI message handler
      if (mockMIDIInput.onmidimessage) {
        mockMIDIInput.onmidimessage(midiEvent);
      }

      expect(noteOffCallback).toHaveBeenCalledWith(60, expect.any(Number));
    });

    it('should treat Note On with velocity 0 as Note Off', async () => {
      mockMIDIAccess.inputs.set('test-input-1', mockMIDIInput);
      mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess);

      await midiManager.requestAccess();

      // Simulate Note On message with velocity 0 (C4)
      const midiEvent = {
        data: new Uint8Array([0x90, 60, 0]), // Note On, channel 0, note 60, velocity 0
        timeStamp: performance.now()
      } as MIDIMessageEvent;

      // Trigger the MIDI message handler
      if (mockMIDIInput.onmidimessage) {
        mockMIDIInput.onmidimessage(midiEvent);
      }

      expect(noteOffCallback).toHaveBeenCalledWith(60, expect.any(Number));
      expect(noteOnCallback).not.toHaveBeenCalled();
    });
  });

  describe('device connection status', () => {
    it('should report disconnected when no devices are connected', () => {
      expect(midiManager.isDeviceConnected()).toBe(false);
    });

    it('should report connected when devices are available', async () => {
      mockMIDIAccess.inputs.set('test-input-1', mockMIDIInput);
      mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess);

      await midiManager.requestAccess();

      expect(midiManager.isDeviceConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should clean up all connections and callbacks', async () => {
      const noteOnCallback = jest.fn();
      const noteOffCallback = jest.fn();
      
      midiManager.onNoteOn(noteOnCallback);
      midiManager.onNoteOff(noteOffCallback);

      mockMIDIAccess.inputs.set('test-input-1', mockMIDIInput);
      mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess);

      await midiManager.requestAccess();
      expect(midiManager.isDeviceConnected()).toBe(true);

      midiManager.disconnect();

      expect(midiManager.isDeviceConnected()).toBe(false);
      expect(mockMIDIInput.onmidimessage).toBeNull();
    });
  });
});