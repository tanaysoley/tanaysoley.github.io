class MusicPlayer {
    constructor(synthMap, onBeatCallback) {
        this.synthMap = synthMap;
        this.isPlaying = false;
        this.scheduledEvents = [];
        this.onBeatCallback = onBeatCallback;
        this.animationFrameId = null;
    }

    play(song, startBeat = 0, endBeat = Infinity) {
        if (this.isPlaying) {
            this.stop();
        }
        this.isPlaying = true;

        const groupedEvents = this.groupEvents(song);
        const millisPerBeat = (60 / song.tempo) * 1000;
        const startTime = performance.now();

        for (const batch of groupedEvents) {
            const eventTime = batch[0].second.startTime;
            if (eventTime >= startBeat && eventTime < endBeat) {
                const scheduledTime = (eventTime - startBeat) * millisPerBeat;

                const timeoutId = setTimeout(() => {
                    if (!this.isPlaying) return;
                    batch.forEach(({ first: synth, second: event }) => {
                        synth.play(event, song.tempo);
                    });
                }, scheduledTime);
                this.scheduledEvents.push(timeoutId);
            }
        }

        const animate = () => {
            if (!this.isPlaying) return;
            const elapsedTime = performance.now() - startTime;
            const currentBeat = startBeat + (elapsedTime / millisPerBeat);
            if (currentBeat >= endBeat) {
                this.stop();
                return;
            }
            if (this.onBeatCallback) {
                this.onBeatCallback(currentBeat);
            }
            this.animationFrameId = requestAnimationFrame(animate);
        };
        this.animationFrameId = requestAnimationFrame(animate);
    }

    stop() {
        this.isPlaying = false;
        this.scheduledEvents.forEach(clearTimeout);
        this.scheduledEvents = [];
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.onBeatCallback) {
            this.onBeatCallback(0);
        }
        for (const synth of Object.values(this.synthMap)) {
            synth.stopAll();
        }
    }

    groupEvents(song) {
        const allEvents = [];
        for (const track of song.tracks) {
            const synth = this.synthMap[track.instrument.toLowerCase()];
            if (!synth) {
                console.warn(`No synth found for instrument ${track.instrument}`);
                continue;
            }
            for (const event of track.events) {
                allEvents.push({ first: synth, second: event });
            }
        }

        const grouped = new Map();
        for (const eventPair of allEvents) {
            const startTime = eventPair.second.startTime;
            if (!grouped.has(startTime)) {
                grouped.set(startTime, []);
            }
            grouped.get(startTime).push(eventPair);
        }

        return Array.from(grouped.values()).sort((a, b) => a[0].second.startTime - b[0].second.startTime);
    }
}

export { MusicPlayer };
