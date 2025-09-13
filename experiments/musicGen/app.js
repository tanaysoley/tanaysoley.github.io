import { Lexer } from "./parser/Lexer.js";
import { Parser } from "./parser/Parser.js";
import { ConsoleSynth } from "./synths/ConsoleSynth.js";
import { IndianNotesPianoSynth } from "./synths/IndianNotesPianoSynth.js";
import { MusicPlayer } from "./scheduler/MusicPlayer.js";
import { SongDisplay } from "./ui/SongDisplay.js";

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const editorContainer = document.getElementById("editor");
  const songDisplayContainer = document.getElementById("song-display");
  const playBtn = document.getElementById("play-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const stopBtn = document.getElementById("stop-btn");
  const shareBtn = document.getElementById("share-btn");
  const footerControls = document.getElementById("footer-controls");

  // Display Spans
  const startBeatDisplay = document.getElementById("start-beat-display");
  const endBeatDisplay = document.getElementById("end-beat-display");
  const barLengthDisplay = document.getElementById("bar-length-display");

  // State
  let state = {
    startBeat: 0,
    endBeat: 60,
    barLength: 4,
    currentSong: null,
  };

  const editor = CodeMirror.fromTextArea(editorContainer, {
    lineNumbers: true,
    mode: "text",
  });

  const synths = {
    console: new ConsoleSynth(),
    indiannotespiano: new IndianNotesPianoSynth(),
  };

  const songDisplay = new SongDisplay(songDisplayContainer, synths);
  const musicPlayer = new MusicPlayer(synths, (beat) => {
    songDisplay.updateCursor(beat);
  });

  function updateDisplays() {
    startBeatDisplay.textContent = state.startBeat;
    endBeatDisplay.textContent = state.endBeat;
    barLengthDisplay.textContent = state.barLength;
    songDisplay.updatePlayRange(state.startBeat, state.endBeat);
  }

  function parseAndRender() {
    const songText = editor.getValue();
    try {
      const lexer = new Lexer(songText);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      state.currentSong = parser.parseSong();
      songDisplay.barLength = state.barLength;
      songDisplay.render(state.currentSong);
      updateDisplays();
    } catch (error) {
      console.error("Error parsing song:", error);
    }
  }

  function loadSongFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const songData = urlParams.get("song");
    if (songData) {
      try {
        const decodedSong =
          LZString.decompressFromEncodedURIComponent(songData);
        if (decodedSong) editor.setValue(decodedSong);
      } catch (e) {
        console.error("Error decoding song from URL", e);
      }
    }
  }

  // Initial Load
  const initialSong = `
tempo 160
title HappyBirthday

begin IndianNotesPiano
	2p-- 2n-- 1r-- 1g-- 1p-- 1n-- r-- m-- {p--++ p-- 
    d p s1 
    n+}2 p--++ p--
    p1 g1 s1
    n d+ p--++ p--
    g1 s1 r1
    s1+
end

begin IndianNotesPiano
	2p-- 2n-- 1r-- 1g-- 1p-- 1n-- r-- m--++++
    1s [1g 1p] [1g 1p]
    2p [1r 1m] [1r 1m]
    2p [1r 1m] [1r 1m]
    1s [1r 1m] [1r 1m]
    1s [1r 1m] [1r 1m]
    1m [1d s] [1d s]
    1s [1g 1p] [1g 1p]
    [1s 1g 1p] 2s
end
    `;
  editor.setValue(initialSong);
  loadSongFromURL();
  parseAndRender();

  // Event Listeners
  editor.on("change", parseAndRender);

  footerControls.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-target]");
    if (!button) return;

    const target = button.dataset.target;
    const stepType = button.dataset.stepType;
    const direction = parseInt(button.dataset.direction, 10);
    const step = stepType === "bar" ? state.barLength : 1;
    const change = step * direction;

    if (target === "start-beat") {
      state.startBeat = Math.max(0, state.startBeat + change);
    } else if (target === "end-beat") {
      state.endBeat = Math.max(state.startBeat, state.endBeat + change);
    } else if (target === "bar-length") {
      state.barLength = Math.max(1, state.barLength + change);
      parseAndRender(); // Re-render if bar length changes
    }
    updateDisplays();
  });

  playBtn.addEventListener("click", () => {
    if (state.currentSong) {
      musicPlayer.play(state.currentSong, state.startBeat, state.endBeat);
    }
  });

  pauseBtn.addEventListener("click", () => musicPlayer.stop());
  stopBtn.addEventListener("click", () => musicPlayer.stop());

  shareBtn.addEventListener("click", () => {
    const songText = editor.getValue();
    const compressedSong = LZString.compressToEncodedURIComponent(songText);
    const url = new URL(window.location);
    url.searchParams.set("song", compressedSong);
    window.history.pushState({}, "", url);
    navigator.clipboard.writeText(url.toString()).then(() => {
      alert("Sharable URL copied to clipboard!");
    });
  });
});
