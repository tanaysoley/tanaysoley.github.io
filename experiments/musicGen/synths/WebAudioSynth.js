import { Synthesizer } from "./Synthesizer.js";

class WebAudioSynth extends Synthesizer {
  constructor(name) {
    super(name);
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }

  play(event, tempo) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // This is a very simple mapping. A more sophisticated approach would be needed for accurate pitch.
    const pitch = this.noteToPitch(event.note);
    oscillator.frequency.setValueAtTime(pitch, this.audioContext.currentTime);

    const durationInSeconds = (60 / tempo) * event.duration;
    gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      this.audioContext.currentTime + durationInSeconds
    );

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + durationInSeconds);
  }

  noteToPitch(note) {
    const midiMap = {
      s: 60, // C4
      R: 61, // Komal Re
      r: 62, // Shuddha Re
      G: 63, // Komal Ga
      g: 64, // Shuddha Ga
      m: 65, // Shuddha Ma
      M: 66, // Teevra Ma
      p: 67, // Pa
      D: 68, // Komal Dha
      d: 69, // Shuddha Dha
      N: 70, // Komal Ni
      n: 71, // Shuddha Ni
    };

    const baseNote = note.replace(/[0-9]/g, "");
    const octaveStr = note.replace(/[^0-9]/g, "");
    const octave = octaveStr ? parseInt(octaveStr) : 0;

    let midiNote = midiMap[baseNote] || 60; // Default to C4

    if (octave !== 0) {
      // Check if octave number is a prefix (lower) or suffix (higher)
      if (note.startsWith(octaveStr)) {
        midiNote -= octave * 12;
      } else {
        midiNote += octave * 12;
      }
    }

    // Convert MIDI note number to frequency (A4 = 440Hz = MIDI 69)
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  getNoteGR(event, tempo, beatWidth) {
    const width = event.duration * beatWidth;
    return `<rect x="0" y="0" width="${width}" height="20" fill="#88f"><title>${event.note}</title></rect>`;
  }
}

export { WebAudioSynth };
