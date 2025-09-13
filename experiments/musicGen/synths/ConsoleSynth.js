import { Synthesizer } from "./Synthesizer.js";

class ConsoleSynth extends Synthesizer {
    constructor() {
        super("console");
    }

    play(event, tempo) {
        console.log(`[${this.name}] Playing event at ${event.startTime} with params ${event.params}`);
    }

    getNoteGR(event, tempo, beatWidth) {
        const width = event.duration * beatWidth;
        return `<rect x="0" y="0" width="${width}" height="20" fill="#ccc"><title>${event.note}</title></rect>`;
    }
}

export { ConsoleSynth };
