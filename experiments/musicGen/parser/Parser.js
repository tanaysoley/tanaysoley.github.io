import { Token } from './Lexer.js';
import { NoteEvent, Song, Track } from './models.js';

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
        this.length = tokens.length;
    }

    parseSong() {
        let tempo = 120;
        let title = "Untitled";
        const tracks = [];

        while (!this.match(Token.EOF)) {
            const token = this.peek();
            if (token.type === Token.Identifier) {
                switch (token.name) {
                    case "tempo":
                        this.consume();
                        tempo = parseInt(this.parseWordToken());
                        break;
                    case "title":
                        this.consume();
                        title = this.parseWordToken();
                        break;
                    case "begin":
                        tracks.push(this.parseTrack());
                        break;
                    default:
                        throw new Error(`Unexpected identifier: ${token.name}`);
                }
            } else {
                this.consume(); // skip
            }
        }

        return new Song(title, tempo, tracks);
    }

    parseTrack() {
        this.consume(Token.Identifier); // consume 'begin'
        const instrument = this.parseWordToken();
        const events = [];
        let currentTime = 0.0;

        while (!this.match(Token.Identifier) || this.peek().name !== "end") {
            const parsedElements = this.parseElement(currentTime);
            events.push(...parsedElements);
            const lastEvent = events[events.length - 1];
            currentTime = lastEvent ? lastEvent.startTime + lastEvent.duration : currentTime;
        }

        this.consume(Token.Identifier); // consume 'end'
        return new Track(instrument, events);
    }

    parseElement(startTime) {
        const token = this.peek();
        switch (token.type) {
            case Token.Note:
                return [this.parseNoteEvent(startTime)];
            case Token.LBracket:
                return this.parseChord(startTime);
            case Token.LBrace:
                return this.parseRepeat(startTime);
            default:
                throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
        }
    }

    parseNoteEvent(startTime) {
        const noteToken = this.consume(Token.Note);
        const note = noteToken.value;
        let duration = 1.0;
        let plusCount = 1;
        let minusCount = 0;

        while (this.match(Token.Plus) || this.match(Token.Minus)) {
            const t = this.consume();
            if (t.type === Token.Plus) {
                plusCount++;
            } else if (t.type === Token.Minus) {
                minusCount++;
            }
        }

        duration *= plusCount;
        duration /= Math.pow(2, minusCount);

        const params = [];
        if (this.match(Token.LParen)) {
            this.consume(Token.LParen);
            while (!this.match(Token.RParen)) {
                params.push(this.consume(Token.Note).value);
                if (this.match(Token.Comma)) {
                    this.consume(Token.Comma);
                }
            }
            this.consume(Token.RParen);
        }

        return new NoteEvent(startTime, note, duration, params);
    }

    parseChord(startTime) {
        this.consume(Token.LBracket);
        const notes = [];
        while (!this.match(Token.RBracket)) {
            const token = this.peek();
            if (token.type === Token.Note) {
                notes.push(this.parseNoteEvent(startTime));
            } else {
                throw new Error(`Unexpected token in chord: ${JSON.stringify(token)}`);
            }
        }
        this.consume(Token.RBracket);
        return notes;
    }

    parseRepeat(startTime) {
        this.consume(Token.LBrace);
        const elements = [];
        let currentTime = startTime;

        while (!this.match(Token.RBrace)) {
            const parsedElements = this.parseElement(currentTime);
            elements.push(...parsedElements);
            const lastEvent = elements[elements.length - 1];
            currentTime = lastEvent ? lastEvent.startTime + lastEvent.duration : currentTime;
        }

        this.consume(Token.RBrace);

        const repeatCount = parseInt(this.parseWordToken());
        if (isNaN(repeatCount)) {
            throw new Error("Expected repeat count after }");
        }

        const repeated = [];
        const segmentDuration = elements.reduce((sum, e) => sum + e.duration, 0);

        for (let i = 0; i < repeatCount; i++) {
            let time = startTime + i * segmentDuration;
            for (const element of elements) {
                repeated.push(element.copy({ startTime: time }));
                time += element.duration;
            }
        }

        return repeated;
    }

    match(type) {
        return this.pos < this.length && this.tokens[this.pos].type === type;
    }

    peek() {
        return this.tokens[this.pos];
    }

    consume(type) {
        if (type && !this.match(type)) {
            throw new Error(`Expected token type ${type} but got ${this.peek().type}`);
        }
        return this.tokens[this.pos++];
    }

    parseWordToken() {
        const token = this.peek();
        if (token.type === Token.Note || token.type === Token.Identifier) {
            return this.consume().value || this.consume().name;
        } else {
            throw new Error(`Expected word token, got ${JSON.stringify(token)}`);
        }
    }
}

export { Parser };
