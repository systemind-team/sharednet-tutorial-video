import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {K, Window} from './frame';
import {at, At, clamp, FPS, Segment, sceneTake, smooth, srcAt} from './time';

export type Zoom = {from: At; to: At; scale: number; x: number; y: number};
export type Url = {at: At; path: string};

const RAMP = 0.7;

/**
 * One recorded scene in a browser window: the clip (sped up where the
 * segments say), a zoom that follows the edit list, and the person's pointer
 * redrawn from the logged samples so it moves at full frame rate.
 */
export const BrowserScene: React.FC<{scene: string; segs: Segment[]; zooms: Zoom[]; urls: Url[]}> = ({scene, segs, zooms, urls}) => {
  const f = useCurrentFrame();
  const src = srcAt(segs, f / FPS);
  const take = sceneTake(scene);

  // Zoom: strongest of the active windows, eased in and out.
  let scale = 1, ox = 768, oy = 432, best = 0;
  for (const z of zooms) {
    const a = at(scene, z.from), b = at(scene, z.to);
    const w = smooth(clamp((src - a) / RAMP)) * smooth(clamp((b - src) / RAMP));
    if (w > best) { best = w; scale = 1 + (z.scale - 1) * w; ox = z.x; oy = z.y; }
  }

  // Pointer.
  const cur = take.cursor;
  let px = cur[0]?.x ?? 1000, py = cur[0]?.y ?? 700;
  for (let i = 0; i < cur.length; i++) {
    if (cur[i].t > src) {
      if (i > 0) {
        const a = cur[i - 1], b = cur[i], u = (src - a.t) / Math.max(1e-3, b.t - a.t);
        px = a.x + (b.x - a.x) * clamp(u); py = a.y + (b.y - a.y) * clamp(u);
      }
      break;
    }
    px = cur[i].x; py = cur[i].y;
  }
  const clicks = take.clicks.filter((c) => !c.drag && src >= c.t && src - c.t < 0.5);
  const pressed = take.clicks.some((c) => !c.drag && Math.abs(src - c.t) < 0.09);

  const path = [...urls].reverse().find((u) => at(scene, u.at) <= src)?.path ?? urls[0]?.path ?? '/';

  return (
    <Window kind="browser" title={path}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${ox * K}px ${oy * K}px`, transform: `scale(${scale})`}}>
        {segs.map((g, i) => (
          <Sequence key={i} from={Math.round(g.out0 * FPS)} durationInFrames={Math.max(1, Math.round(((g.src1 - g.src0) / g.speed) * FPS))} layout="none">
            <AbsoluteFill>
              <OffthreadVideo muted src={staticFile(`clips/${scene}.mp4`)} startFrom={Math.round(g.src0 * FPS)} playbackRate={g.speed} style={{width: 1600, height: 900}} />
            </AbsoluteFill>
          </Sequence>
        ))}
        {clicks.map((c, i) => {
          const p = (src - c.t) / 0.5;
          return <div key={i} style={{position: 'absolute', left: c.x * K - 28, top: c.y * K - 28, width: 56, height: 56, borderRadius: 28, border: `3px solid rgba(46,111,168,${0.7 * (1 - p)})`, background: `rgba(46,111,168,${0.18 * (1 - p)})`, transform: `scale(${0.4 + p * 0.9})`}} />;
        })}
        <Pointer x={px * K} y={py * K} pressed={pressed} />
      </div>
    </Window>
  );
};

const Pointer: React.FC<{x: number; y: number; pressed: boolean}> = ({x, y, pressed}) => (
  <svg width="30" height="40" viewBox="0 0 30 40" style={{position: 'absolute', left: x - 4, top: y - 3, transform: `scale(${pressed ? 0.86 : 1})`, transformOrigin: '4px 3px', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))'}}>
    <path d="M4 3 L4 31 L11 24.5 L15.6 35 L20.2 33 L15.7 22.8 L25 22.8 Z" fill="#111" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);
