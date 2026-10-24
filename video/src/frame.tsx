import React from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {clamp, FPS, L, Lang, smooth} from './time';

// SysteMind brand: Oxford ink, Atlantic accent, Columbia wash, Crown Gold for one decisive thing.
export const C = {
  oxford: '#002147',
  ink: '#04142b',
  atlantic: '#2E6FA8',
  columbia: '#B9D9EB',
  gold: '#E9A83E',
  paper: '#F4F8FC',
};
export const SANS = '"Albert Sans", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif';
export const MONO = 'Menlo, "SF Mono", Monaco, monospace';

export const fontFaces = `
@font-face { font-family: 'Albert Sans'; src: url(${staticFile('fonts/albert-sans.woff2')}) format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'Anybody'; src: url(${staticFile('fonts/anybody.woff2')}) format('woff2'); font-weight: 800; font-stretch: 50% 150%; }
`;

// Window geometry on the 1920x1080 canvas. The page is 1536x864 CSS px,
// shown at 1600x900; the 114px band under the window holds the captions.
export const WIN = {x: 160, y: 22, w: 1600, bar: 40};
export const K = WIN.w / 1536;
export const WIN_H = WIN.bar + 900;

export const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const drift = Math.sin(f / 240) * 40;
  return (
    <AbsoluteFill style={{background: `radial-gradient(1200px 700px at ${30 + drift / 20}% 0%, #0f3a6b 0%, transparent 60%), radial-gradient(1000px 800px at 100% 100%, #0b2b52 0%, transparent 55%), ${C.ink}`}}>
      <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(185,217,235,0.10) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.6}} />
    </AbsoluteFill>
  );
};

/** A window on the desktop: browser chrome with a URL, or a terminal title bar. */
export const Window: React.FC<{kind: 'browser' | 'terminal'; title: string; children: React.ReactNode; dark?: boolean}> = ({kind, title, children, dark}) => {
  const barBg = kind === 'browser' ? '#e9eef4' : '#2b2d31';
  return (
    <div style={{position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: WIN_H, borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)', background: dark ? '#1c1d21' : '#fff'}}>
      <div style={{height: WIN.bar, background: barBg, display: 'flex', alignItems: 'center', padding: '0 16px', position: 'relative', borderBottom: kind === 'browser' ? '1px solid #d5dde6' : '1px solid #1a1b1e'}}>
        <div style={{display: 'flex', gap: 8}}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div key={c} style={{width: 12, height: 12, borderRadius: 6, background: c}} />
          ))}
        </div>
        {kind === 'browser' ? (
          <>
            <div style={{display: 'flex', gap: 14, marginLeft: 22, color: '#8a96a3', fontSize: 18, fontFamily: SANS}}>
              <span>‹</span>
              <span>›</span>
            </div>
            <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 560, height: 26, borderRadius: 13, background: '#fff', border: '1px solid #d5dde6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: SANS, fontSize: 14.5, color: '#3b4a5a'}}>
              <svg width="11" height="13" viewBox="0 0 11 13"><rect x="1" y="5.5" width="9" height="7" rx="1.5" fill="#7d8a97" /><path d="M3 5.5V4a2.5 2.5 0 015 0v1.5" stroke="#7d8a97" strokeWidth="1.4" fill="none" /></svg>
              <span>
                <span style={{color: '#0b1b2e'}}>www.sharednet.ai</span>
                <span style={{color: '#7d8a97'}}>{title === '/' ? '' : title}</span>
              </span>
            </div>
          </>
        ) : (
          <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#a9adb5', fontFamily: SANS, fontSize: 14.5, fontWeight: 500, pointerEvents: 'none'}}>{title}</div>
        )}
      </div>
      <div style={{position: 'absolute', top: WIN.bar, left: 0, width: WIN.w, height: 900, overflow: 'hidden'}}>{children}</div>
    </div>
  );
};

export type Cap = {at: number; out?: number; text: L; step?: string};

/** One caption at a time in the band under the window, in output seconds. */
export const Captions: React.FC<{caps: Cap[]; lang: Lang; dur: number}> = ({caps, lang, dur}) => {
  const t = useCurrentFrame() / FPS;
  const sorted = [...caps].sort((a, b) => a.at - b.at);
  const i = sorted.findLastIndex((c) => c.at <= t);
  if (i < 0) return null;
  const c = sorted[i];
  const end = c.out ?? (i + 1 < sorted.length ? sorted[i + 1].at : dur);
  if (t > end) return null;
  const inP = smooth((t - c.at) / 0.35), outP = smooth((end - t) / 0.25);
  const p = Math.min(inP, outP);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: WIN.y + WIN_H + 26, display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${(1 - inP) * 10}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '10px 26px 10px 12px', borderRadius: 999, background: 'rgba(4,20,43,0.78)', border: '1px solid rgba(185,217,235,0.22)', backdropFilter: 'blur(8px)'}}>
        {c.step ? (
          <div style={{minWidth: 34, height: 34, padding: '0 10px', borderRadius: 17, background: C.gold, color: C.ink, fontFamily: SANS, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{c.step}</div>
        ) : (
          <div style={{width: 10}} />
        )}
        <div style={{color: '#fff', fontFamily: SANS, fontSize: lang === 'zh' ? 27 : 25, fontWeight: 500, letterSpacing: lang === 'zh' ? 0.5 : 0, whiteSpace: 'nowrap'}}>{c.text[lang]}</div>
      </div>
    </div>
  );
};

/** Fade a scene in and out so cuts between windows read as one desktop. */
export const Fade: React.FC<{dur: number; children: React.ReactNode; inS?: number; outS?: number}> = ({dur, children, inS = 0.35, outS = 0.3}) => {
  const t = useCurrentFrame() / FPS;
  const o = Math.min(clamp(t / inS), clamp((dur - t) / outS));
  const s = interpolate(clamp(t / inS), [0, 1], [0.985, 1]);
  return <AbsoluteFill style={{opacity: o, transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};
