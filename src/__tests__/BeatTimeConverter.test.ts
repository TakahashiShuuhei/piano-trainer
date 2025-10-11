import { BeatTimeConverter } from '../utils/BeatTimeConverter';
import { MusicalNote, Note } from '../types/index';

describe('BeatTimeConverter', () => {
  let converter: BeatTimeConverter;

  beforeEach(() => {
    converter = new BeatTimeConverter(120); // 120 BPM
  });

  describe('constructor', () => {
    it('should initialize with default BPM of 120', () => {
      const defaultConverter = new BeatTimeConverter();
      expect(defaultConverter.getBPM()).toBe(120);
    });

    it('should initialize with specified BPM', () => {
      const customConverter = new BeatTimeConverter(140);
      expect(customConverter.getBPM()).toBe(140);
    });
  });

  describe('beatsToMs', () => {
    it('should convert quarter notes to milliseconds correctly', () => {
      // At 120 BPM: 1 quarter note = 500ms
      expect(converter.beatsToMs(1)).toBe(500);
      expect(converter.beatsToMs(2)).toBe(1000);
      expect(converter.beatsToMs(0.5)).toBe(250); // eighth note
      expect(converter.beatsToMs(4)).toBe(2000);  // whole note
    });

    it('should handle different BPMs correctly', () => {
      converter.setBPM(60); // 60 BPM: 1 quarter note = 1000ms
      expect(converter.beatsToMs(1)).toBe(1000);
      
      converter.setBPM(240); // 240 BPM: 1 quarter note = 250ms
      expect(converter.beatsToMs(1)).toBe(250);
    });
  });

  describe('msToBeats', () => {
    it('should convert milliseconds to quarter notes correctly', () => {
      // At 120 BPM: 500ms = 1 quarter note
      expect(converter.msToBeats(500)).toBe(1);
      expect(converter.msToBeats(1000)).toBe(2);
      expect(converter.msToBeats(250)).toBe(0.5); // eighth note
      expect(converter.msToBeats(2000)).toBe(4);  // whole note
    });
  });

  describe('setBPM and getBPM', () => {
    it('should set and get BPM correctly', () => {
      converter.setBPM(140);
      expect(converter.getBPM()).toBe(140);
    });

    it('should throw error for invalid BPM', () => {
      expect(() => converter.setBPM(0)).toThrow('BPM must be greater than 0');
      expect(() => converter.setBPM(-10)).toThrow('BPM must be greater than 0');
    });
  });

  describe('convertNote', () => {
    it('should convert musical note to time-based note', () => {
      const musicalNote: MusicalNote = {
        pitch: 60,
        timing: { beat: 2, duration: 1 },
        velocity: 80
      };

      const timeNote = converter.convertNote(musicalNote);

      expect(timeNote.pitch).toBe(60);
      expect(timeNote.startTime).toBe(1000); // 2 beats * 500ms
      expect(timeNote.duration).toBe(500);   // 1 beat * 500ms
      expect(timeNote.velocity).toBe(80);
    });

    it('should handle chord notes', () => {
      const musicalNote: MusicalNote = {
        pitch: 60,
        timing: { beat: 0, duration: 2 },
        velocity: 80,
        isChord: true,
        chordNotes: [64, 67]
      };

      const timeNote = converter.convertNote(musicalNote);

      expect(timeNote.isChord).toBe(true);
      expect(timeNote.chordNotes).toEqual([64, 67]);
    });
  });

  describe('convertNotes', () => {
    it('should convert array of musical notes', () => {
      const musicalNotes: MusicalNote[] = [
        { pitch: 60, timing: { beat: 0, duration: 1 }, velocity: 80 },
        { pitch: 62, timing: { beat: 1, duration: 1 }, velocity: 85 },
        { pitch: 64, timing: { beat: 2, duration: 0.5 }, velocity: 90 }
      ];

      const timeNotes = converter.convertNotes(musicalNotes);

      expect(timeNotes).toHaveLength(3);
      expect(timeNotes[0]!.startTime).toBe(0);
      expect(timeNotes[1]!.startTime).toBe(500);
      expect(timeNotes[2]!.startTime).toBe(1000);
      expect(timeNotes[2]!.duration).toBe(250); // 0.5 beats
    });
  });

  describe('convertToMusicalNote', () => {
    it('should convert time-based note to musical note', () => {
      const timeNote: Note = {
        pitch: 60,
        startTime: 1000,
        duration: 500,
        velocity: 80
      };

      const musicalNote = converter.convertToMusicalNote(timeNote);

      expect(musicalNote.pitch).toBe(60);
      expect(musicalNote.timing.beat).toBe(2);    // 1000ms / 500ms per beat
      expect(musicalNote.timing.duration).toBe(1); // 500ms / 500ms per beat
      expect(musicalNote.velocity).toBe(80);
    });
  });

  describe('convertToMusicalNotes', () => {
    it('should convert array of time-based notes', () => {
      const timeNotes: Note[] = [
        { pitch: 60, startTime: 0, duration: 500, velocity: 80 },
        { pitch: 62, startTime: 500, duration: 250, velocity: 85 }
      ];

      const musicalNotes = converter.convertToMusicalNotes(timeNotes);

      expect(musicalNotes).toHaveLength(2);
      expect(musicalNotes[0]!.timing.beat).toBe(0);
      expect(musicalNotes[0]!.timing.duration).toBe(1);
      expect(musicalNotes[1]!.timing.beat).toBe(1);
      expect(musicalNotes[1]!.timing.duration).toBe(0.5);
    });
  });

  describe('getQuarterNoteMs', () => {
    it('should return quarter note duration in milliseconds', () => {
      expect(converter.getQuarterNoteMs()).toBe(500); // 120 BPM
      
      converter.setBPM(60);
      expect(converter.getQuarterNoteMs()).toBe(1000); // 60 BPM
    });
  });

  describe('static getQuarterNoteMsForBPM', () => {
    it('should return quarter note duration for specified BPM', () => {
      expect(BeatTimeConverter.getQuarterNoteMsForBPM(120)).toBe(500);
      expect(BeatTimeConverter.getQuarterNoteMsForBPM(60)).toBe(1000);
      expect(BeatTimeConverter.getQuarterNoteMsForBPM(240)).toBe(250);
    });
  });

  describe('BPM changes', () => {
    it('should maintain musical relationships when BPM changes', () => {
      const musicalNotes: MusicalNote[] = [
        { pitch: 60, timing: { beat: 0, duration: 1 }, velocity: 80 },
        { pitch: 62, timing: { beat: 1, duration: 1 }, velocity: 80 }
      ];

      // Convert at 120 BPM
      converter.setBPM(120);
      const timeNotes120 = converter.convertNotes(musicalNotes);
      
      // Convert at 140 BPM
      converter.setBPM(140);
      const timeNotes140 = converter.convertNotes(musicalNotes);

      // Musical relationships should be preserved
      const ratio120 = timeNotes120[1]!.startTime / timeNotes120[0]!.duration;
      const ratio140 = timeNotes140[1]!.startTime / timeNotes140[0]!.duration;
      
      expect(ratio120).toBeCloseTo(ratio140, 5);
      
      // But actual times should be different
      expect(timeNotes120[0]!.duration).toBeGreaterThan(timeNotes140[0]!.duration);
    });
  });
});