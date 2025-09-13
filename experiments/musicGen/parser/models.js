class Song {
    constructor(title, tempo, tracks) {
        this.title = title;
        this.tempo = tempo;
        this.tracks = tracks;
    }
}

class Track {
    constructor(instrument, events) {
        this.instrument = instrument;
        this.events = events;
    }
}

class NoteEvent {
    constructor(startTime, note, duration, params = []) {
        this.startTime = startTime;
        this.note = note;
        this.duration = duration;
        this.params = params;
    }

    copy(overrides) {
        return new NoteEvent(
            overrides.startTime !== undefined ? overrides.startTime : this.startTime,
            overrides.note !== undefined ? overrides.note : this.note,
            overrides.duration !== undefined ? overrides.duration : this.duration,
            overrides.params !== undefined ? overrides.params : this.params
        );
    }

    toString() {
        const base = `${this.note}(${this.duration})`;
        return this.params.length > 0 ? `${base} [${this.params.join(", ")}]` : base;
    }
}

export { Song, Track, NoteEvent };
