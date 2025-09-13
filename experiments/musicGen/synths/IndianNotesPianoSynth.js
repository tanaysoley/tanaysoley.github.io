import { WebAudioSynth } from "./WebAudioSynth.js";

class IndianNotesPianoSynth extends WebAudioSynth {
    constructor() {
        super("IndianNotesPiano");
    }

    getNoteGR(event, tempo, beatWidth) {
        const noteHeight = 44;
        const width = event.duration * beatWidth;
        const noteText = this.getDevanagariNote(event.note);
        const rectWidth = width - 4;
        
        let textX;
        if (event.duration >= 1) {
            // Center in the first beat for notes >= 1 beat long
            textX = beatWidth / 2;
        } else {
            // Center in the note's own rectangle for shorter notes
            textX = 2 + (rectWidth / 2);
        }

        let svg = `<g>
            <rect x="2" y="0" width="${rectWidth}" height="${noteHeight}" rx="4" ry="4" fill="#f0f0f0" stroke="#f0f0f0"></rect>
            <text x="${textX}" y="${noteHeight / 2}" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="#363636">${noteText}</text>`;

        if (event.duration > 1) {
            for (let i = 1; i < event.duration; i++) {
                const hyphenX = (i * beatWidth) + (beatWidth / 2);
                svg += `<text x="${hyphenX}" y="${noteHeight / 2}" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="#a0a0a0">-</text>`;
            }
        }

        svg += `</g>`;
        return svg;
    }

    getDevanagariNote(note) {
        const noteMap = {
            's': 'स',
            'r': 'रे',
            'g': 'ग',
            'm': 'म',
            'p': 'प',
            'd': 'ध',
            'n': 'नि',
            'R': 'रे',
            'G': 'ग',
            'M': 'म',
            'D': 'ध',
            'N': 'नि',
        };

        const baseChar = note.replace(/[0-9]/g, '');
        let devanagariNote = noteMap[baseChar] || ' ';

        if (/[RGMND]/.test(baseChar)) {
            devanagariNote = `<tspan text-decoration="underline">${devanagariNote}</tspan>`;
        }

        const octaveMatch = note.match(/(\d+)/);
        if (octaveMatch) {
            const octave = octaveMatch[1];
            if (note.indexOf(octave) === 0) { // Lower octave
                devanagariNote += `<tspan dy="4" dx="0" font-size="10px">${octave}</tspan>`;
            } else { // Higher octave
                devanagariNote += `<tspan dy="-8" dx="2" font-size="10px">${octave}</tspan>`;
            }
        }

        return devanagariNote;
    }
}

export { IndianNotesPianoSynth };