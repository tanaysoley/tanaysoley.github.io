var sampleSong = {
  baseBpm: 80,
  metronome: [
    {
      note: 0,
      time: 1,
    },
    {
      note: 1,
      time: 1,
    },
    {
      note: 1,
      time: 1,
    },
    {
      note: 1,
      time: 1,
    },
  ],
  notes: [
    {
      note: 0,
      time: 1,
    },
    {
      note: -11,
      time: 1,
    },
    {
      note: 0,
      time: 1,
    },
    {
      note: 2,
      time: 1,
    },
    {
      note: 2,
      time: 2,
    },
    {
      time: 2,
    },
    {
      note: -5,
      time: 2,
    },
    {
      note: 7,
      time: 2,
    },
    {
      note: 9,
      time: 2,
    },
    {
      note: 11,
      time: 2,
    },
    {
      note: 12,
      time: 2,
    },
  ],
};

var context = new AudioContext();

const legalTokens = [
  "s",
  "r",
  "g",
  "m",
  "p",
  "d",
  "n",
  "R",
  "G",
  "M",
  "D",
  "N",
  "+",
  "-",
  ">",
  "<",
  ".",
];

const letters = ["s", "R", "r", "G", "g", "m", "M", "p", "D", "d", "N", "n"];

const orns = ["+", "-", ">", "<"];

const beatLetters = "0123456789".split("");
const beatOrns = ["+", "-"];

function parseSong(songString, metronomeString, bpmString) {
  return {
    baseBpm: parseInt(bpmString),
    metronome: parseBeats(metronomeString),
    notes: parseNotes(songString),
  };
}

function parseBeats(metronomeString) {
  var tokens = metronomeString.split("");
  var beatsArray = [];
  var currentBeat;
  var state = "start";

  //console.log(tokens);

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    //console.log(token);
    if (!(beatLetters.includes(token) || beatOrns.includes(token))) {
      continue;
    }

    if (state === "start") {
      if (beatLetters.includes(token)) {
        currentBeat = {
          note: parseInt(token),
          time: 1,
        };
        state = "gotLetter";
      }
    } else if (state === "gotLetter" || state === "gotOrn") {
      if (beatOrns.includes(token)) {
        if (token === "+") {
          currentBeat.time = 1.5 * currentBeat.time;
        } else if (token === "-") {
          currentBeat.time = 0.5 * currentBeat.time;
        }
        state = "gotOrn";
      } else if (beatLetters.includes(token)) {
        beatsArray.push(structuredClone(currentBeat));
        currentBeat = {
          note: parseInt(token),
          time: 1,
        };
        state = "gotLetter";
      }
    }
  }
  beatsArray.push(structuredClone(currentBeat));
  return beatsArray;
}

function parseNotes(songString) {
  var state = "start";
  var tokens = songString.split("");
  var notesArray = [];
  var currentNote;
  var currentNoteMultiplier = 1;

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (!legalTokens.includes(token)) {
      continue;
    }

    if (state === "start") {
      if (letters.includes(token)) {
        currentNote = {
          note: letters.indexOf(token),
          time: 1,
        };
        state = "gotLetter";
      } else if (token === ".") {
        currentNote = {
          time: 1,
        };
        state = "gotLetter";
      }
    } else if (state === "gotLetter" || state === "gotOrn") {
      if (token === "+") {
        currentNoteMultiplier++;
        state = "gotOrn";
      } else if (token === "-") {
        currentNote.time = 0.5 * currentNote.time;
        state = "gotOrn";
      } else if (token === ">") {
        currentNote.note = currentNote.note + 12;
        state = "gotOrn";
      } else if (token === "<") {
        currentNote.note = currentNote.note - 12;
        state = "gotOrn";
      } else if (letters.includes(token)) {
        currentNote.time = currentNote.time * currentNoteMultiplier;
        notesArray.push(structuredClone(currentNote));
        // //console.log(`pushing  ${JSON.stringify(notesArray)}`);
        currentNote = {
          note: letters.indexOf(token),
          time: 1,
        };
        currentNoteMultiplier = 1;
        state = "gotLetter";
      } else if (token === ".") {
        currentNote.time = currentNote.time * currentNoteMultiplier;
        notesArray.push(structuredClone(currentNote));
        // //console.log(`pushing  ${JSON.stringify(notesArray)}`);

        currentNote = {
          time: 1,
        };
        currentNoteMultiplier = 1;
        state = "gotLetter";
      }
    }
  }
  currentNote.time = currentNote.time * currentNoteMultiplier;
  notesArray.push(structuredClone(currentNote));
  //   //console.log(`pushing  end ${JSON.stringify(notesArray)}`);
  return notesArray;
}

function unparseSong(songJson) {}

function playSong(song, onBeatCallback, updateBeatMultiplier, playNotes) {
  console.log(playNotes);
  const songTime = getSongTime(song);
  playMetronomoeInLoop(song, songTime);
  updateBeats(song, onBeatCallback, updateBeatMultiplier, songTime);
  if (playNotes) {
    playAllNotes(song);
  }
}

async function updateBeats(song, callback, updateBeatMultiplier, tillTime) {
  var time = 0;
  var beats = 0;
  const beatTime = getBeatTimeFromBpm(song.baseBpm) * updateBeatMultiplier;
  console.log(beatTime);
  while (time < tillTime) {
    // //console.log("Callback: " + beats);
    // console.log("renderA", new Date().getMilliseconds());
    callback(beats);
    beats += updateBeatMultiplier;
    await sleep(beatTime - 10);
    time += beatTime;
  }
}

async function playMetronomeBeat(note) {
  //   console.log("beat", new Date().getMilliseconds());
  playSound(getFrequencyFromNote(note) / 4, 100, "square", 0.5, true);
}

async function playAllNotes(song) {
  var index = 0;
  const beatTime = getBeatTimeFromBpm(song.baseBpm);
  while (index < song.notes.length) {
    note = song.notes[index];
    if (note.note !== undefined) {
      playNote(note.note, note.time, song.baseBpm);
    }
    await sleep(beatTime * note.time - 5);
    index++;
  }
}

async function playMetronomoeInLoop(song, tillTime) {
  var time = 0;
  var index = 0;
  //console.log(song.baseBpm);
  const beatTime = getBeatTimeFromBpm(song.baseBpm);
  while (time < tillTime) {
    //console.log("Beat: " + index);
    var dateA = new Date();

    beat = song.metronome[index];
    playMetronomeBeat(beat.note);
    await sleep(beat.time * beatTime - 10);
    index++;
    if (index >= song.metronome.length) {
      index = 0;
    }
    time += beat.time * beatTime;
    var dateB = new Date();
    console.log("renderB", new Date().getMilliseconds(), dateB - dateA);
  }
}

async function playNote(note, timeMul, baseBpm) {
  //   console.log("note", new Date().getMilliseconds());
  timeMs = getBeatTimeFromBpm(baseBpm) * timeMul;
  playSound(getFrequencyFromNote(note), timeMs, "sine");
}

function playSound(
  frequency,
  timeMS,
  waveType,
  gain = 0.8,
  expRampDown = false
) {
  const timeS = timeMS / 1000;
  //console.log("Playing note: " + frequency);
  const occilatorNode = context.createOscillator();
  occilatorNode.frequency.value = frequency;
  occilatorNode.type = waveType;

  const gainNode = context.createGain();
  gainNode.gain.setValueAtTime(gain, context.currentTime);
  if (expRampDown) {
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + timeS
    );
  } else {
    gainNode.gain.linearRampToValueAtTime(0.0001, context.currentTime + timeS);
  }
  occilatorNode.connect(gainNode);
  gainNode.connect(context.destination);

  occilatorNode.start();

  setTimeout(() => {
    occilatorNode.stop();
    // gain.stop();
  }, timeMS);
}

function getFrequencyFromNote(note) {
  return 440 * Math.pow(2, note / 12);
}

function getBeatTimeFromBpm(bpm) {
  return 60000 / bpm;
}

function getSongTime(song) {
  beatTime = song.notes.reduce((acc, note) => acc + note.time, 0);
  return beatTime * getBeatTimeFromBpm(song.baseBpm);
}

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
