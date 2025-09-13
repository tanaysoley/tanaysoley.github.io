class SongDisplay {
    constructor(container, synthMap) {
        this.container = container;
        this.synthMap = synthMap;
        this.beatWidth = 80;
        this.barLength = 4;
        this.noteHeight = 44;
        this.noteV_Spacing = 5; // Vertical space between stacked notes
        this.trackV_Padding = 20; // Top/bottom padding for each track row
        this.cursor = null;
        this.startMarker = null;
        this.endMarker = null;
        this.numTracks = 0;
        this.beatsPerRow = 0;
        this.rowHeights = []; // Stores the height of a SINGLE track in each row
    }

    render(song) {
        this.container.innerHTML = '';
        this.numTracks = song.tracks.length;
        if (this.numTracks === 0) return;

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const totalBeats = Math.ceil(Math.max(1, ...song.tracks.flatMap(t => t.events.map(e => e.startTime + e.duration))));
        const barsPerRow = Math.floor(this.container.clientWidth / (this.barLength * this.beatWidth)) || 1;
        this.beatsPerRow = barsPerRow * this.barLength;
        const numRows = Math.ceil(totalBeats / this.beatsPerRow);
        const rowWidth = this.beatsPerRow * this.beatWidth;

        // 1. Calculate the height of a single track for each row
        this.rowHeights = [];
        for (let i = 0; i < numRows; i++) {
            let maxStackInRow = 1;
            for (const track of song.tracks) {
                const eventsInRow = track.events.filter(e => e.startTime >= i * this.beatsPerRow && e.startTime < (i + 1) * this.beatsPerRow);
                const simultaneousEvents = this.groupSimultaneous(eventsInRow);
                const maxStackInTrack = Math.max(1, ...Object.values(simultaneousEvents).map(g => g.length));
                if (maxStackInTrack > maxStackInRow) {
                    maxStackInRow = maxStackInTrack;
                }
            }
            const singleTrackHeight = (maxStackInRow * (this.noteHeight + this.noteV_Spacing)) + this.trackV_Padding;
            this.rowHeights.push(singleTrackHeight);
        }

        const totalHeight = this.rowHeights.reduce((sum, height) => sum + (height * this.numTracks), 0) + 20;
        svg.setAttribute("viewBox", `0 0 ${rowWidth + 20} ${totalHeight}`);

        const contentGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        contentGroup.setAttribute("transform", "translate(10, 10)");

        // Draw notes first, then grid on top for z-index
        this.drawNotes(contentGroup, song, numRows);
        this.drawGrid(contentGroup, totalBeats, numRows, rowWidth);
        
        svg.appendChild(contentGroup);

        this.startMarker = this.createMarker(svg, "#3273dc"); // Bulma's info color
        this.endMarker = this.createMarker(svg, "#3273dc");
        this.cursor = this.createMarker(svg, "#ff3860", 2); // Bulma's danger color
        this.updateCursor(0);
        this.updatePlayRange(0, 16);

        this.container.appendChild(svg);
    }

    drawNotes(svg, song, numRows) {
        let yPos = 0;
        for (let row = 0; row < numRows; row++) {
            const singleTrackHeight = this.rowHeights[row];
            for (const track of song.tracks) {
                const trackGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                trackGroup.setAttribute("transform", `translate(0, ${yPos})`);

                const synth = this.synthMap[track.instrument.toLowerCase()];
                if (!synth) continue;

                const eventsInRow = track.events.filter(e => e.startTime >= row * this.beatsPerRow && e.startTime < (row + 1) * this.beatsPerRow);
                const simultaneousEvents = this.groupSimultaneous(eventsInRow);

                for (const group of Object.values(simultaneousEvents)) {
                    let yNoteOffset = 0;
                    for (const event of group) {
                        const xPos = (event.startTime % this.beatsPerRow) * this.beatWidth;
                        const noteGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                        noteGroup.setAttribute("transform", `translate(${xPos}, ${yNoteOffset})`);
                        noteGroup.innerHTML = synth.getNoteGR(event, song.tempo, this.beatWidth);
                        trackGroup.appendChild(noteGroup);
                        yNoteOffset += this.noteHeight + this.noteV_Spacing;
                    }
                }
                svg.appendChild(trackGroup);
                yPos += singleTrackHeight; // Increment y for each track
            }
        }
    }

    drawGrid(svg, totalBeats, numRows, rowWidth) {
        let yPos = 0;
        for (let row = 0; row < numRows; row++) {
            const singleTrackHeight = this.rowHeights[row];
            const totalRowHeight = singleTrackHeight * this.numTracks;
            for (let beat = 0; beat < this.beatsPerRow && (row * this.beatsPerRow + beat) < totalBeats; beat++) {
                const x = beat * this.beatWidth;
                const isBarLine = beat % this.barLength === 0;
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", x.toString());
                line.setAttribute("y1", yPos.toString());
                line.setAttribute("x2", x.toString());
                line.setAttribute("y2", (yPos + totalRowHeight).toString());
                line.setAttribute("stroke", isBarLine ? "#4a4a4a" : "#dbdbdb");
                line.setAttribute("stroke-width", "1");
                if (!isBarLine) line.setAttribute("stroke-dasharray", "2,3");
                svg.appendChild(line);
            }
            yPos += totalRowHeight;
        }
    }

    groupSimultaneous(events) {
        const groups = {};
        for (const event of events) {
            if (!groups[event.startTime]) {
                groups[event.startTime] = [];
            }
            groups[event.startTime].push(event);
        }
        return groups;
    }

    createMarker(svg, color, width = 2) {
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "line");
        marker.setAttribute("stroke", color);
        marker.setAttribute("stroke-width", width.toString());
        marker.setAttribute("stroke-dasharray", "4");
        svg.appendChild(marker);
        return marker;
    }

    updateMarker(marker, beat) {
        if (!marker || this.beatsPerRow === 0 || this.rowHeights.length === 0) return;
        
        const row = Math.floor(beat / this.beatsPerRow);
        if (row >= this.rowHeights.length) return;

        const yForRowStart = this.rowHeights.slice(0, row).reduce((sum, height) => sum + (height * this.numTracks), 0) + 10;
        const x = (beat % this.beatsPerRow) * this.beatWidth + 10;
        const totalRowHeight = this.rowHeights[row] * this.numTracks;

        marker.setAttribute("x1", x.toString());
        marker.setAttribute("y1", yForRowStart.toString());
        marker.setAttribute("x2", x.toString());
        marker.setAttribute("y2", (yForRowStart + totalRowHeight).toString());
    }

    updatePlayRange(startBeat, endBeat) {
        this.updateMarker(this.startMarker, startBeat);
        this.updateMarker(this.endMarker, endBeat);
    }

    updateCursor(beat) {
        this.updateMarker(this.cursor, beat);
    }
}

export { SongDisplay };
