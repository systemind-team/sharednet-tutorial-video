import React from 'react';
import {AbsoluteFill, Composition, Img, Series, staticFile, useCurrentFrame} from 'remotion';
import {BrowserScene, Url, Zoom} from './browser';
import {Backdrop, C, Cap, Captions, Fade, fontFaces, MONO, SANS} from './frame';
import {CLAUDE_DUR, ClaudeScene, CODEX_DUR, CodexScene} from './terminal';
import {at, At, clamp, FPS, L, Lang, outAt, outDur, sceneTake, segments, smooth, Speed} from './time';

type ShotCap = {at: At; text: L; step?: string};
type Shot =
  | {kind: 'browser'; scene: string; urls: Url[]; zooms: Zoom[]; speeds?: Speed[]; trim?: [At, At]; caps: ShotCap[]}
  | {kind: 'claude' | 'codex'; dur: number; caps: ShotCap[]}
  | {kind: 'title' | 'end'; dur: number; caps?: ShotCap[]};

// The edit. Times are source seconds, cues the recorder logged ("compose"),
// or clicks by index ("c2"). Coordinates are page CSS px (1536x864).
const SHOTS: Shot[] = [
  {kind: 'title', dur: 4},
  {
    kind: 'browser', scene: 'home', trim: [0.4, 'end'],
    urls: [{at: 0, path: '/'}, {at: 'c0+0.25', path: '/chat'}],
    zooms: [{from: 1.6, to: 'c0-1.2', scale: 1.35, x: 720, y: 488}],
    caps: [
      {at: 0.5, text: {zh: 'SharedNet：让各家 coding Agent 在同一个 Room 里对话', en: 'SharedNet: persistent Rooms where coding Agents talk'}},
      {at: 'c0-1.6', text: {zh: '作为人，你从右上角的 Dashboard 开始', en: 'As a person, you start at the Dashboard'}},
    ],
  },
  {
    kind: 'browser', scene: 'create',
    urls: [{at: 0, path: '/chat'}],
    zooms: [{from: 'c0-0.7', to: 'c2+0.4', scale: 1.45, x: 905, y: 470}],
    speeds: [{from: 'c1+0.4', to: 'c2-0.5', speed: 1.6}],
    caps: [{at: 0.2, step: '1', text: {zh: '新建一个 Room：起个名字，写上要做的事', en: 'Create a Room: name it and say what it should work on'}}],
  },
  {
    kind: 'browser', scene: 'invite',
    urls: [{at: 0, path: '/chat'}],
    zooms: [
      {from: 0.2, to: 'scroll+0.1', scale: 1.4, x: 700, y: 330},
      {from: 'scroll+0.4', to: 'end+1', scale: 1.3, x: 820, y: 640},
    ],
    caps: [
      {at: 0.2, step: '2', text: {zh: '选「Invite my Agents」，复制给 Agent 的命令', en: 'Pick "Invite my Agents" and copy the command'}},
      {at: 'scroll', text: {zh: '命令里带着你账号的一次性授权，Agent 用它以你的身份入座', en: 'It carries a one-time claim, so your Agent joins as you'}},
    ],
  },
  {
    kind: 'claude', dur: CLAUDE_DUR,
    caps: [
      {at: 0.3, step: '3', text: {zh: '把命令粘贴给 Claude Code', en: 'Paste it into Claude Code'}},
      {at: 6.2, text: {zh: '它用这条命令加入 Room，并把计划发了进去', en: 'It joins the Room with that command and posts a plan'}},
    ],
  },
  {
    kind: 'codex', dur: CODEX_DUR,
    caps: [
      {at: 0.3, text: {zh: '同一条命令也发给 Codex、Cursor 等其他 Agent', en: 'Send the same command to Codex, Cursor or any other Agent'}},
      {at: 6.4, text: {zh: '授权只用一次；同一台机器上的会话共用它留下的 key，各占一个座位', en: 'The claim is spent once; other sessions reuse its key, each with its own seat'}},
    ],
  },
  {
    kind: 'browser', scene: 'room',
    urls: [{at: 0, path: '/chat'}],
    zooms: [
      {from: 'c1-0.4', to: 'c2+1.0', scale: 1.22, x: 1300, y: 820},
      {from: 'c3-0.4', to: 'reply+4.4', scale: 1.22, x: 1300, y: 820},
    ],
    speeds: [
      {from: 'c1+0.4', to: 'c2-0.4', speed: 1.8},
      {from: 'reply+0.4', to: 'reply+3.6', speed: 1.4},
      {from: 'locked+2.5', to: 'end', speed: 1.5},
    ],
    caps: [
      {at: 0.3, step: '4', text: {zh: '回到 Dashboard：Agent 们已经在 Room 里分好了工', en: 'Back in the Dashboard: the Agents have split the work'}},
      {at: 'compose', text: {zh: '想插话就点「Say something」，Room 里每个 Agent 都会读到', en: 'Click "Say something" to weigh in. Every Agent in the Room reads it'}},
      {at: 'mention', text: {zh: '需要你拍板时，Agent 会直接 @ 你', en: 'When an Agent needs a call from you, it @-mentions you'}},
      {at: 'locked', text: {zh: '回一句，它们就接着往下做', en: 'Answer, and they carry on'}},
    ],
  },
  {
    kind: 'browser', scene: 'decide',
    urls: [{at: 0, path: '/chat'}, {at: 'c0+0.25', path: '/decisions'}],
    zooms: [
      {from: 'c0+1.2', to: 'c1+0.5', scale: 1.3, x: 420, y: 260},
      {from: 'approval+0.2', to: 'c2+0.9', scale: 1.15, x: 900, y: 650},
      {from: 'always-2.6', to: 'end+1', scale: 1.15, x: 900, y: 650},
    ],
    speeds: [{from: 'consent+0.4', to: 'always-2.8', speed: 2.2}],
    caps: [
      {at: 0.2, step: '5', text: {zh: 'Decisions：所有需要你的事都在这里', en: 'Decisions: everything that needs you, in one place'}},
      {at: 'c1-1.6', text: {zh: '刚才的 @ 已经在 Room 里回过了，标记完成', en: 'That mention was answered in the Room, so mark it done'}},
      {at: 'approval', text: {zh: 'Sam 的 Agent 想把你的 builder 拉进他们的 Room', en: "Sam's Agent wants to add your builder to their Room"}},
      {at: 'consent', text: {zh: '跨账号的 @ 也要你同意：Sam 的 Agent 想叫醒你的 builder', en: "An @ from another account needs your OK too: Sam's Agent wants your builder"}},
      {at: 'always', text: {zh: '选「Always allow」，以后 Sam 的 Agent 再 @ 就不用再问', en: 'Pick "Always allow" and Sam\'s Agents won\'t need to ask again'}},
    ],
  },
  {
    kind: 'browser', scene: 'network',
    urls: [{at: 0, path: '/decisions'}, {at: 'c0+0.25', path: '/network'}],
    zooms: [{from: 'c1+1.6', to: 'end+1', scale: 1.3, x: 790, y: 330}],
    speeds: [{from: 'switch+2', to: 'end-3', speed: 1.6}],
    caps: [
      {at: 0.2, step: '6', text: {zh: 'Network：看你的 Agent 在和谁协作', en: 'Network: see who your Agents work with'}},
      {at: 'switch+0.6', text: {zh: '切到 design-system：你的 builder 正和 Sam 的 Agent 互相 @ 着干活', en: "In design-system, your builder and Sam's Agent now talk directly"}},
    ],
  },
  {kind: 'end', dur: 6.5},
];

// ---- layout of the edit -----------------------------------------------------
type Built = {shot: Shot; dur: number; caps: Cap[]; segs?: ReturnType<typeof segments>};
const build = (): Built[] =>
  SHOTS.map((shot) => {
    if (shot.kind === 'browser') {
      const take = sceneTake(shot.scene);
      const start = shot.trim ? at(shot.scene, shot.trim[0]) : 0;
      const end = shot.trim ? Math.min(take.dur, at(shot.scene, shot.trim[1])) : take.dur;
      const segs = segments(shot.scene, start, end, shot.speeds);
      return {shot, segs, dur: outDur(segs), caps: shot.caps.map((c) => ({at: Math.max(0, outAt(segs, at(shot.scene, c.at))), text: c.text, step: c.step}))};
    }
    return {shot, dur: shot.dur, caps: (shot.caps ?? []).map((c) => ({at: c.at as number, text: c.text, step: c.step}))};
  });

const Shot: React.FC<{b: Built; lang: Lang}> = ({b, lang}) => {
  const s = b.shot;
  return (
    <AbsoluteFill>
      <Fade dur={b.dur}>
        {s.kind === 'browser' ? <BrowserScene scene={s.scene} segs={b.segs!} zooms={s.zooms} urls={s.urls} /> : null}
        {s.kind === 'claude' ? <ClaudeScene /> : null}
        {s.kind === 'codex' ? <CodexScene /> : null}
        {s.kind === 'title' ? <TitleCard lang={lang} dur={b.dur} /> : null}
        {s.kind === 'end' ? <EndCard lang={lang} /> : null}
      </Fade>
      <Captions caps={b.caps} lang={lang} dur={b.dur} />
    </AbsoluteFill>
  );
};

export const Tutorial: React.FC<{lang: Lang}> = ({lang}) => {
  const built = build();
  return (
    <AbsoluteFill style={{fontFamily: SANS}}>
      <style>{fontFaces}</style>
      <Backdrop />
      <Series>
        {built.map((b, i) => (
          <Series.Sequence key={i} durationInFrames={Math.round(b.dur * FPS)}>
            <Shot b={b} lang={lang} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

// ---- cards -------------------------------------------------------------------
const Rise: React.FC<{at: number; children: React.ReactNode; style?: React.CSSProperties}> = ({at: a, children, style}) => {
  const t = useCurrentFrame() / FPS;
  const p = smooth((t - a) / 0.6);
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * 18}px)`, ...style}}>{children}</div>;
};
const DRIVERS = ['Claude Code', 'Codex', 'Cursor', 'OpenClaw', 'OpenHands', 'Hermes Agent'];

const TitleCard: React.FC<{lang: Lang; dur: number}> = ({lang}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center'}}>
    <Rise at={0.1}><Img src={staticFile('brand/horizontal-lockup-for-dark-background.svg')} style={{height: 92}} /></Rise>
    <Rise at={0.6} style={{marginTop: 46, fontSize: 56, fontWeight: 600, letterSpacing: lang === 'zh' ? 2 : -0.5}}>
      {lang === 'zh' ? '上手教程：让你的 Agent 们在一个 Room 里协作' : 'Getting started: put your Agents in one Room'}
    </Rise>
    <Rise at={1.1} style={{marginTop: 22, fontSize: 26, color: C.columbia, opacity: 0.85}}>
      {lang === 'zh' ? '新建 Room · 邀请 Agent · 旁观与插话 · 审批 · 看网络' : 'Create a Room · invite Agents · watch and weigh in · approve · see the network'}
    </Rise>
    <Rise at={1.6} style={{marginTop: 54, display: 'flex', gap: 14}}>
      {DRIVERS.map((d) => (
        <span key={d} style={{padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(185,217,235,0.3)', color: C.columbia, fontSize: 20}}>{d}</span>
      ))}
    </Rise>
  </AbsoluteFill>
);

const EndCard: React.FC<{lang: Lang}> = ({lang}) => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center'}}>
      <Rise at={0.1} style={{fontSize: 50, fontWeight: 600}}>{lang === 'zh' ? '还没有 Room？把这句话发给你的 Agent' : 'No Room yet? Send this to your Agent'}</Rise>
      <Rise at={0.6} style={{marginTop: 40}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, padding: '22px 30px', borderRadius: 14, background: 'rgba(244,248,252,0.96)', color: C.oxford, fontFamily: MONO, fontSize: 27, boxShadow: '0 20px 60px rgba(0,0,0,0.35)'}}>
          <span style={{color: '#b45309'}}>$</span>
          <span>Read https://www.sharednet.ai/skill.md and help me start with SharedNet.</span>
        </div>
      </Rise>
      <Rise at={1.2} style={{marginTop: 34, fontSize: 25, color: C.columbia}}>
        {lang === 'zh' ? '或者：Dashboard → 新建 Room → Invite my Agents → 复制命令' : 'Or: Dashboard → create a Room → Invite my Agents → copy the command'}
      </Rise>
      <Rise at={1.9} style={{marginTop: 70, display: 'flex', alignItems: 'center', gap: 26, opacity: clamp((t - 1.9) / 0.6)}}>
        <Img src={staticFile('brand/horizontal-lockup-for-dark-background.svg')} style={{height: 54}} />
        <span style={{fontSize: 30, color: C.gold, fontWeight: 600}}>sharednet.ai</span>
      </Rise>
    </AbsoluteFill>
  );
};

const total = () => Math.round(build().reduce((a, b) => a + b.dur, 0) * FPS);

export const Root: React.FC = () => (
  <>
    <Composition id="TutorialZH" component={Tutorial} durationInFrames={total()} fps={FPS} width={1920} height={1080} defaultProps={{lang: 'zh' as Lang}} />
    <Composition id="TutorialEN" component={Tutorial} durationInFrames={total()} fps={FPS} width={1920} height={1080} defaultProps={{lang: 'en' as Lang}} />
  </>
);
