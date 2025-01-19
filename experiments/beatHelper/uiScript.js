const noteTemplate = document.getElementById("noteTemplate").content;

const notesContainer = document.getElementById("notesContainer");

const playButton = document.getElementById("playButton");

const notesInput = document.getElementById("notesInput");
const metronomeInput = document.getElementById("metronomeInput");
const bpmInput = document.getElementById("bpmInput");
const updateInterval = document.getElementById("updateInterval");

var parsedSong;

function getNewNoteElement() {
  return noteTemplate.cloneNode(true);
}

function inflateNoteElement(noteElement, note) {
  var { isUnderlined, noteName, noteTop, noteBottom } = getNoteName(note.note);

  var noteNameElement = noteElement.querySelector(".noteName");
  noteNameElement.innerText = noteName;
  if (isUnderlined) {
    noteNameElement.style.textDecoration = "underline";
  }

  noteElement.querySelector(".noteTop").innerText = noteTop;
  noteElement.querySelector(".noteBottom").innerText = noteBottom;
}

function setNoteElementWidth(noteElement, note) {
  noteElement.style.width = `${120 * note.time}px`;
}

const noteNameMapping = [
  "स",
  "र",
  "र",
  "ग",
  "ग",
  "म",
  "म",
  "प",
  "ध",
  "ध",
  "न",
  "न",
];

function getNoteName(noteNumber) {
  var rangedNumber = 0;
  if (noteNumber < 0) {
    rangedNumber = (12 - ((0 - noteNumber) % 12)) % 12;
  } else {
    rangedNumber = noteNumber % 12;
  }

  isUnderlined = [1, 3, 6, 8, 10].includes(rangedNumber);

  noteName = "";
  if (noteNumber !== undefined) {
    noteName = noteNameMapping[rangedNumber];
  }

  noteTop = "";
  if (noteNumber >= 12) {
    noteTop = "●".repeat(Math.floor(noteNumber / 12));
  }

  noteBottom = "";
  if (noteNumber < 0) {
    noteBottom = "●".repeat(Math.floor((0 - noteNumber) / 12) + 1);
  }

  return { isUnderlined, noteName, noteTop, noteBottom };
}

function renderSong(song, beatTime) {
  notesContainer.innerText = "";
  var index = 0;
  var noteBeatTimeStart;
  var noteBeatTimeEnd;
  while (index < song.notes.length) {
    noteBeatTimeStart = noteBeatTimeEnd || 0;
    noteBeatTimeEnd = noteBeatTimeStart + song.notes[index].time;
    var notePlayedFraction = 0;
    if (beatTime >= noteBeatTimeEnd) {
      notePlayedFraction = 1;
    } else if (beatTime <= noteBeatTimeStart) {
      notePlayedFraction = 0;
    } else {
      notePlayedFraction =
        (beatTime - noteBeatTimeStart) / song.notes[index].time;
    }

    newNoteElement = getNewNoteElement();
    inflateNoteElement(newNoteElement, song.notes[index]);
    notesContainer.appendChild(newNoteElement);
    noteElements = notesContainer.querySelectorAll(".note");
    setNoteElementWidth(
      noteElements[noteElements.length - 1],
      song.notes[index]
    );
    setNoteElementBackground(
      noteElements[noteElements.length - 1],
      notePlayedFraction
    );
    index++;
  }
}

function setNoteElementBackground(noteElement, notePlayedFraction) {
  const unplayedColor = "#2D3047";
  const playedColor = "#1B998B";
  //   background: linear-gradient(to left, #333, #333 50%, #eee 75%, #333 75%);
  if (notePlayedFraction == 0) {
    noteElement.style.background = unplayedColor;
  } else if (notePlayedFraction == 1) {
    noteElement.style.background = playedColor;
  } else {
    noteElement.style.background = `linear-gradient(to right, ${playedColor} ${
      notePlayedFraction * 100
    }%, ${unplayedColor} ${notePlayedFraction}%)`;
  }
}

playButton.addEventListener("click", function () {
  userInputHandler();
  playSong(parsedSong, listenBeatUpdate, parseFloat(updateInterval.value));
});

function listenBeatUpdate(bt) {
  //   console.log("renderD", new Date().getMilliseconds());
  renderSong(parsedSong, bt);
  //   console.log("renderE", new Date().getMilliseconds());
}

notesInput.addEventListener("input", function () {
  parsedSong = parseSong(
    notesInput.value,
    metronomeInput.value,
    bpmInput.value
  );
  console.log(parsedSong);
  renderSong(parsedSong, getBeatTimeFromBpm(parsedSong.baseBpm));
});

function userInputHandler() {
  parsedSong = parseSong(
    notesInput.value,
    metronomeInput.value,
    bpmInput.value
  );
  console.log(parsedSong);
  renderSong(parsedSong, getBeatTimeFromBpm(parsedSong.baseBpm));
}

notesInput.addEventListener("input", userInputHandler);
metronomeInput.addEventListener("input", userInputHandler);
userInputHandler();
