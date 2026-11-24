// Songs for Sur Samraat, written in sargam relative to the player's Sa.
//
// Each token is `swar:beats`. Swars use the tokens from music.js
// (S r R g G m M P d D n N, "." prefix = mandra, "'" suffix = taar).
//   -:beats  a rest  -> an island where you can stay quiet
//   ~:beats  a glide (meend) from the previous swar to the next one
//            -> a diagonal bridge
// Between two different swars with no glide, the last moment of the first
// swar becomes a free transition -> a wide platform with the two swars as
// opposite corners, so it doesn't matter how you get from one to the other.

import { parseNotes } from './music.js';

export const SONGS = [
  {
    id: 'meend',
    title: 'Meend Warm-up',
    titleDev: 'मींड अभ्यास',
    blurb: 'Long, slow swars with glides between some of them. Learn how the bridges work before the songs.',
    bpm: 66,
    notes: `-:4 S:2 R:2 G:2 -:2 G:2 ~:1 P:2 -:1 P:2 ~:1 G:2 -:2
            S:1 G:1 P:2 ~:2 S':3 -:1 S':2 ~:2 P:2 -:1 P:1 G:1 R:1 S:3 -:2`,
  },
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    titleDev: 'ट्विंकल ट्विंकल लिटिल स्टार',
    blurb: 'The traditional nursery melody. Short breaths between the lines are your islands.',
    bpm: 84,
    notes: `-:4 S:1 S:1 P:1 P:1 D:1 D:1 P:1.5 -:0.5 m:1 m:1 G:1 G:1 R:1 R:1 S:1.5 -:0.5
            P:1 P:1 m:1 m:1 G:1 G:1 R:1.5 -:0.5 P:1 P:1 m:1 m:1 G:1 G:1 R:1.5 -:0.5
            S:1 S:1 P:1 P:1 D:1 D:1 P:1.5 -:0.5 m:1 m:1 G:1 G:1 R:1 R:1 S:2 -:2`,
  },
  {
    // Beethoven's opening, moved so it sits between mandra Pa and Ni
    // (the original's F becomes Sa). Beats are eighth notes.
    id: 'fur-elise',
    title: 'Für Elise',
    titleDev: 'फ़्यूर एलीज़',
    blurb: 'Beethoven’s famous opening. Quick swars, komal and teevra notes, and a wide range.',
    bpm: 72,
    notes: `-:6 N:0.5 n:0.5 N:0.5 n:0.5 N:0.5 M:0.5 D:0.5 P:0.5 G:1 -:0.5 .P:0.5 .N:0.5 G:0.5
            M:1 -:0.5 .N:0.5 g:0.5 M:0.5 P:1 -:0.5 .N:0.5 N:0.5 n:0.5
            N:0.5 n:0.5 N:0.5 M:0.5 D:0.5 P:0.5 G:1 -:0.5 .P:0.5 .N:0.5 G:0.5
            M:1 -:0.5 .N:0.5 P:0.5 M:0.5 G:3 -:3`,
  },
];

/**
 * Turn a song into timed segments (seconds):
 *   { kind: 'note', n, t0, t1, grace, split }
 *   { kind: 'free', nA, nB, t0, t1 }
 *   { kind: 'glide', nA, nB, t0, t1 }
 *   { kind: 'rest', t0, t1 }
 */
export function buildTimeline(song) {
  const spb = 60 / song.bpm;
  const events = [];
  let t = 0;
  for (const tok of song.notes.trim().split(/\s+/)) {
    const [name, beats = '1'] = tok.split(':');
    const dur = parseFloat(beats) * spb;
    if (name === '-') {
      const prev = events[events.length - 1];
      if (prev && prev.kind === 'rest') prev.t1 += dur;
      else events.push({ kind: 'rest', t0: t, t1: t + dur });
    } else if (name === '~') {
      events.push({ kind: 'glide', t0: t, t1: t + dur });
    } else {
      events.push({ kind: 'note', n: parseNotes(name)[0], t0: t, t1: t + dur });
    }
    t += dur;
  }

  // Glides take their ends from the swars on either side.
  events.forEach((e, i) => {
    if (e.kind !== 'glide') return;
    const a = events[i - 1];
    const b = events[i + 1];
    if (!a || !b || a.kind !== 'note' || b.kind !== 'note') throw new Error('A glide must sit between two swars');
    e.nA = a.n;
    e.nB = b.n;
  });

  const segs = [];
  events.forEach((e, i) => {
    const prev = events[i - 1];
    const next = events[i + 1];
    if (e.kind !== 'note') {
      segs.push(e);
      return;
    }
    const note = {
      ...e,
      // Coming in from silence, the voice needs a moment to settle.
      grace: !prev || prev.kind === 'rest' ? 0.18 : 0,
      // Same swar again: drawn as a seam in the bridge.
      split: !!(prev && prev.kind === 'note' && prev.n === e.n),
    };
    if (next && next.kind === 'note' && next.n !== e.n) {
      const T = Math.min(0.2, 0.35 * (e.t1 - e.t0));
      segs.push({ ...note, t1: e.t1 - T });
      segs.push({ kind: 'free', nA: e.n, nB: next.n, t0: e.t1 - T, t1: e.t1 });
    } else {
      segs.push(note);
    }
  });

  const notes = events.filter((e) => e.kind === 'note').map((e) => e.n);
  return {
    segs,
    duration: t,
    low: Math.min(...notes),
    high: Math.max(...notes),
    noteCount: notes.length,
    firstNote: notes[0],
  };
}
