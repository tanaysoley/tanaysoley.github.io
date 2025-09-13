class Synthesizer {
    constructor(name) {
        this.name = name;
    }

    init() {
        // Optional setup code
    }

    play(event, tempo) {
        throw new Error("Play method not implemented");
    }

    stopAll() {
        // Optional cleanup code
    }

    getNoteGR(event, tempo, beatWidth) {
        throw new Error("getNoteGR method not implemented");
    }
}

export { Synthesizer };
