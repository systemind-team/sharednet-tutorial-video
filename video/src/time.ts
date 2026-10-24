import take from './take.json';

export const FPS = 30;
export type Lang = 'zh' | 'en';
export type L = {zh: string; en: string};
export type SceneName = keyof typeof take.scenes;

type SceneTake = {dur: number; cursor: {t: number; x: number; y: number}[]; clicks: {t: number; x: number; y: number; drag?: string}[]; marks: Record<string, number>};
export const sceneTake = (name: string): SceneTake => (take.scenes as Record<string, SceneTake>)[name];

/**
 * A point in a recorded scene, in source seconds: a number, a cue logged by
 * the recorder ("compose", "mention+1.5"), a click by index ("c2", "c2-0.4"),
 * or "end".
 */
export type At = number | string;
export function at(scene: string, a: At): number {
  if (typeof a === 'number') return a;
  const s = sceneTake(scene);
  const m = a.match(/^([a-z0-9]+)([+-][\d.]+)?$/i);
  if (!m) throw new Error(`bad time ${a}`);
  const off = m[2] ? parseFloat(m[2]) : 0;
  if (m[1] === 'end') return s.dur + off;
  if (/^c\d+$/.test(m[1])) return s.clicks[parseInt(m[1].slice(1), 10)].t + off;
  if (!(m[1] in s.marks)) throw new Error(`no cue ${m[1]} in ${scene}`);
  return s.marks[m[1]] + off;
}

/** Piecewise speed-up of a recording: output time <-> source time. */
export type Speed = {from: At; to: At; speed: number};
export type Segment = {src0: number; src1: number; speed: number; out0: number};
export function segments(scene: string, start: number, end: number, speeds: Speed[] = []): Segment[] {
  const cuts = speeds.map((s) => ({a: at(scene, s.from), b: at(scene, s.to), speed: s.speed})).sort((x, y) => x.a - y.a);
  const segs: Segment[] = [];
  let t = start, out = 0;
  const push = (a: number, b: number, speed: number) => {
    if (b - a <= 0.01) return;
    segs.push({src0: a, src1: b, speed, out0: out});
    out += (b - a) / speed;
  };
  for (const c of cuts) {
    push(t, Math.max(t, c.a), 1);
    push(Math.max(t, c.a), Math.min(end, c.b), c.speed);
    t = Math.max(t, c.b);
  }
  push(t, end, 1);
  return segs;
}
export const outDur = (segs: Segment[]) => {
  const l = segs[segs.length - 1];
  return l.out0 + (l.src1 - l.src0) / l.speed;
};
export function srcAt(segs: Segment[], out: number): number {
  let s = segs[0];
  for (const g of segs) if (out >= g.out0) s = g;
  return Math.min(s.src1, s.src0 + (out - s.out0) * s.speed);
}
export function outAt(segs: Segment[], src: number): number {
  let s = segs[0];
  for (const g of segs) if (src >= g.src0) s = g;
  return s.out0 + (Math.min(src, s.src1) - s.src0) / s.speed;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
