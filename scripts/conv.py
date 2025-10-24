#!/usr/bin/env python3
"""
MusicXML to JSON converter for Piano Practice App

Converts MusicXML files to JSON format according to json-spec.md specification.
Handles partwise format, backup/forward elements, ties, and chord processing.
"""

import xml.etree.ElementTree as ET
import json
import sys
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class Note:
    """Represents a musical note with timing and pitch information."""
    pitch: int  # MIDI note number
    beat: float  # Start position in quarter notes
    duration: float  # Length in quarter notes
    velocity: int = 80
    voice: str = "1"
    staff: int = 1


class MusicXMLConverter:
    """Converts MusicXML to JSON format for Piano Practice App."""
    
    def __init__(self):
        self.divisions = 24  # Default divisions per quarter note
        self.current_beat = 0.0
        self.notes = []
        self.active_ties = {}  # Track active ties by (pitch, voice, staff)
        self.chord_start_beat = 0.0  # Track the start beat of current chord
        self.voice_beats = {}  # Track beat position for each voice independently
        
    def pitch_to_midi(self, step: str, alter: int, octave: int) -> int:
        """Convert MusicXML pitch to MIDI note number."""
        # Map note names to semitone offsets
        note_map = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
        
        # Calculate MIDI note number
        midi_note = (octave + 1) * 12 + note_map[step] + alter
        return midi_note
    
    def duration_to_beats(self, duration: int) -> float:
        """Convert MusicXML duration to quarter note beats."""
        return duration / self.divisions

    def round_beat(self, beat: float) -> float:
        """Round beat value to remove floating point errors.

        Rounds to the nearest common fraction:
        - Integer (1.0, 2.0, etc.)
        - Half (0.5, 1.5, etc.)
        - Quarter (0.25, 0.75, 1.25, etc.)

        If none of these are close enough, returns the original value.
        """
        # Try rounding to integer
        rounded = round(beat)
        if abs(beat - rounded) < 0.0001:
            return float(rounded)

        # Try rounding to 0.5
        half_rounded = round(beat * 2) / 2
        if abs(beat - half_rounded) < 0.0001:
            return half_rounded

        # Try rounding to 0.25
        quarter_rounded = round(beat * 4) / 4
        if abs(beat - quarter_rounded) < 0.0001:
            return quarter_rounded

        # Return original value if no close match
        return beat
    
    def process_note_element(self, note_elem) -> Optional[Note]:
        """Process a single note element from MusicXML."""
        # Get voice and staff first for timing calculations
        voice_elem = note_elem.find('voice')
        voice = voice_elem.text if voice_elem is not None else "1"
        
        staff_elem = note_elem.find('staff')
        staff = int(staff_elem.text) if staff_elem is not None else 1
        
        # Get duration (needed for both notes and rests)
        duration_elem = note_elem.find('duration')
        if duration_elem is None:
            return None
        duration = int(duration_elem.text)
        duration_beats = self.duration_to_beats(duration)
        
        # Check if this is a rest
        if note_elem.find('rest') is not None:
            # For rests, we still need to advance the timing but don't create a note
            return None
            
        # Get pitch information
        pitch_elem = note_elem.find('pitch')
        if pitch_elem is None:
            return None
            
        step = pitch_elem.find('step').text
        alter_elem = pitch_elem.find('alter')
        alter = int(alter_elem.text) if alter_elem is not None else 0
        octave = int(pitch_elem.find('octave').text)
        
        # Convert to MIDI note number
        midi_pitch = self.pitch_to_midi(step, alter, octave)
        
        # Check if this is a chord note (starts at same time as previous note)
        is_chord = note_elem.find('chord') is not None
        
        # Calculate beat position using voice-specific timing
        voice_key = f"{voice}_{staff}"
        if voice_key not in self.voice_beats:
            self.voice_beats[voice_key] = self.current_beat
            
        beat_position = self.voice_beats[voice_key]
        
        # Create note object
        note = Note(
            pitch=midi_pitch,
            beat=beat_position,
            duration=duration_beats,
            voice=voice,
            staff=staff
        )
        
        return note
    
    def process_tie(self, note_elem, note: Note):
        """Process tie elements for the note."""
        tie_key = (note.pitch, note.voice, note.staff)
        
        # Check for tie stop first
        tie_stop = note_elem.find('.//tie[@type="stop"]')
        tie_start = note_elem.find('.//tie[@type="start"]')
        
        if tie_stop is not None and tie_key in self.active_ties:
            # Extend the duration of the tied note
            tied_note = self.active_ties[tie_key]
            tied_note.duration += note.duration
            
            # Check if this note also starts a new tie
            if tie_start is not None:
                # This note continues the tie, keep the reference
                pass
            else:
                # Tie ends here
                del self.active_ties[tie_key]
            
            return False  # Don't add this note separately
        
        # Check for tie start (only if not already processed as tie stop)
        if tie_start is not None:
            self.active_ties[tie_key] = note
            
        return True  # Add this note
    
    def process_measure(self, measure_elem):
        """Process a single measure from MusicXML."""
        measure_start_beat = self.current_beat
        measure_duration = 0.0  # Track the longest duration in this measure
        
        for elem in measure_elem:
            if elem.tag == 'attributes':
                # Update divisions if specified
                divisions_elem = elem.find('divisions')
                if divisions_elem is not None:
                    self.divisions = int(divisions_elem.text)
                    
            elif elem.tag == 'note':
                # Get voice and staff for timing management
                voice_elem = elem.find('voice')
                voice = voice_elem.text if voice_elem is not None else "1"
                staff_elem = elem.find('staff')
                staff = int(staff_elem.text) if staff_elem is not None else 1
                voice_key = f"{voice}_{staff}"
                
                # Get duration for timing advancement
                duration_elem = elem.find('duration')
                if duration_elem is not None:
                    duration = int(duration_elem.text)
                    duration_beats = self.duration_to_beats(duration)
                else:
                    duration_beats = 0
                
                # Check if this is a chord note before processing
                is_chord = elem.find('chord') is not None
                
                # Initialize voice timing if not exists
                if voice_key not in self.voice_beats:
                    self.voice_beats[voice_key] = self.current_beat
                
                # If this is not a chord note, update the chord start beat
                if not is_chord:
                    self.chord_start_beat = self.voice_beats[voice_key]
                
                note = self.process_note_element(elem)
                if note is not None:
                    # For chord notes, use the chord start beat
                    if is_chord:
                        note.beat = self.chord_start_beat
                    
                    # Process ties
                    should_add = self.process_tie(elem, note)
                    
                    if should_add:
                        self.notes.append(note)
                
                # Update voice timing (for both notes and rests, but not for chord notes)
                if not is_chord:
                    self.voice_beats[voice_key] += duration_beats
                    # Update global current_beat to the maximum of all voices
                    self.current_beat = max(self.voice_beats.values())
                    # Track measure duration
                    current_position = self.current_beat - measure_start_beat
                    measure_duration = max(measure_duration, current_position)
                        
            elif elem.tag == 'backup':
                # Move beat counter backward
                duration_elem = elem.find('duration')
                if duration_elem is not None:
                    backup_duration = int(duration_elem.text)
                    backup_beats = self.duration_to_beats(backup_duration)
                    # Reset current_beat for backup
                    self.current_beat = measure_start_beat
                    # Reset voice_beats for new voices that will start after backup
                    # But keep existing voice timing intact
                    
            elif elem.tag == 'forward':
                # Move beat counter forward
                duration_elem = elem.find('duration')
                if duration_elem is not None:
                    forward_duration = int(duration_elem.text)
                    forward_beats = self.duration_to_beats(forward_duration)
                    self.current_beat += forward_beats
        
        # Ensure we advance to the end of the measure
        if measure_duration > 0:
            self.current_beat = measure_start_beat + measure_duration
    
    def convert_file(self, xml_file: str, output_file: str = None) -> Dict:
        """Convert MusicXML file to JSON format."""
        # Parse XML
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        # Reset state
        self.current_beat = 0.0
        self.notes = []
        self.active_ties = {}
        self.voice_beats = {}
        
        # Get title from work element or use filename
        title = "Untitled"
        work_elem = root.find('work')
        if work_elem is not None:
            work_title = work_elem.find('work-title')
            if work_title is not None:
                title = work_title.text
        
        # Process all parts (usually just one for piano)
        for part in root.findall('part'):
            # Reset beat counter for each part
            self.current_beat = 0.0
            self.voice_beats = {}
            
            # Process all measures in the part
            for measure in part.findall('measure'):
                self.process_measure(measure)
        
        # Convert notes to JSON format
        json_notes = []
        for note in self.notes:
            json_note = {
                "pitch": note.pitch,
                "timing": {
                    "beat": self.round_beat(note.beat),
                    "duration": self.round_beat(note.duration)
                },
                "velocity": note.velocity
            }
            json_notes.append(json_note)
        
        # Sort notes by beat position
        json_notes.sort(key=lambda x: x["timing"]["beat"])
        
        # Create final JSON structure
        result = {
            "title": title,
            "bpm": 120,  # Default BPM
            "notes": json_notes
        }
        
        # Write to file if specified
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result


def main():
    """Command line interface for the converter."""
    if len(sys.argv) < 2:
        print("Usage: python conv.py <input.xml> [output.json]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    converter = MusicXMLConverter()
    try:
        result = converter.convert_file(input_file, output_file)
        
        if output_file:
            print(f"Converted {input_file} to {output_file}")
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
    except Exception as e:
        print(f"Error converting file: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()