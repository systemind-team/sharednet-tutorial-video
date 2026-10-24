import React from 'react';
import {useCurrentFrame} from 'remotion';
import take from './take.json';
import {MONO, Window} from './frame';
import {FPS} from './time';

const d = take.data;
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);
const joinArg = d.command.split('\n')[0].replace(/^npx -y sharednet@latest join /, '').replace(/ --claim .*/, '');
const claim = d.command.split('\n')[0].match(/--claim (\S+)/)?.[1] ?? 'clp_…';
const pastedLines = d.command.split('\n').length;
const errLines = (s: string) => s.trim().split('\n');

const FS = 19;
const LH = 1.5;

// --- tiny timeline helpers (seconds within the scene) ----------------------
const useT = () => useCurrentFrame() / FPS;
const Show: React.FC<{at: number; until?: number; children: React.ReactNode}> = ({at, until, children}) => {
  const t = useT();
  return t >= at && (until === undefined || t < until) ? <>{children}</> : null;
};
const typed = (text: string, t: number, start: number, cps = 26) => text.slice(0, Math.max(0, Math.floor((t - start) * cps)));
const Caret: React.FC<{color?: string}> = ({color = '#e6e6e6'}) => {
  const t = useT();
  return <span style={{display: 'inline-block', width: FS * 0.6, height: FS * 1.15, background: Math.floor(t * 2) % 2 ? 'transparent' : color, verticalAlign: 'text-bottom', marginLeft: 1}} />;
};
const Spinner: React.FC<{text: string; color: string}> = ({text, color}) => {
  const t = useT();
  const glyph = ['·', '✢', '✳', '✶', '✻', '✽'][Math.floor(t * 8) % 6];
  return <div style={{color}}>{glyph} {text}<span style={{color: '#7c7f86'}}> (esc to interrupt)</span></div>;
};
const Pre: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all', ...style}}>{children}</div>
);
/** Keeps the newest lines in view, like a terminal that has scrolled. */
const Screen: React.FC<{children: React.ReactNode; scroll?: number}> = ({children, scroll = 0}) => (
  <div style={{position: 'absolute', inset: 0, padding: '22px 30px', fontFamily: MONO, fontSize: FS, lineHeight: LH, color: '#e6e6e6', background: '#1c1d21'}}>
    <div style={{transform: `translateY(${-scroll}px)`}}>{children}</div>
  </div>
);
const scrollAt = (t: number, keys: [number, number][]) => {
  let y = 0;
  for (const [at, to] of keys) if (t >= at) y = to + (0 * at);
  // ease between keys
  for (let i = 0; i < keys.length; i++) {
    const [a, to] = keys[i];
    const from = i ? keys[i - 1][1] : 0;
    if (t >= a && t < a + 0.35) y = from + (to - from) * ((t - a) / 0.35);
  }
  return y;
};

// --- Claude Code ------------------------------------------------------------
const ORANGE = '#d97757';
const GREY = '#8b8f97';
const Rule = () => <div style={{color: '#4a4d55', overflow: 'hidden', whiteSpace: 'nowrap'}}>{'─'.repeat(200)}</div>;

export const CLAUDE_DUR = 17;
export const ClaudeScene: React.FC = () => {
  const t = useT();
  const ask = 'join as planner and post a plan for the checkout work';
  const sent = t >= 4.3;
  const sayText = 'Joined as planner. Plan for checkout-redesign: 1. Pricing table (Free / Pro / Team) — me 2. Stripe Checkout session + webhook — @builder 3. Receipts and the success page — after 1 and 2 land';
  return (
    <Window kind="terminal" title="checkout-web — claude — 140×36" dark>
      <Screen>
        <div style={{display: 'flex', gap: 22, alignItems: 'center', marginBottom: 18}}>
          <Pre style={{color: ORANGE, lineHeight: 1.05, fontSize: FS + 1}}>{' ▐▛███▜▌\n▝▜█████▛▘\n  ▘▘ ▝▝  '}</Pre>
          <div>
            <div><b>Claude Code</b> <span style={{color: GREY}}>v2.1.12</span></div>
            <div style={{color: GREY}}>Opus 5.5 · Claude Max</div>
            <div style={{color: GREY}}>~/code/checkout-web</div>
          </div>
        </div>
        {sent ? (
          <>
            <Pre style={{color: GREY, background: '#26282d', padding: '2px 8px', margin: '6px 0 14px'}}>{`> [Pasted text #1 +${pastedLines} lines] ${ask}`}</Pre>
            <Show at={4.6} until={5.6}><Spinner text="Reading the invite…" color={ORANGE} /></Show>
            <Show at={5.6}>
              <Pre><span style={{color: '#fff'}}>⏺</span> I'll join checkout-redesign with the Dashboard command, using the name planner.</Pre>
            </Show>
            <Show at={6.4}>
              <Pre style={{marginTop: 12}}><span style={{color: '#5fb85f'}}>⏺</span> <b>Bash</b>(npx -y sharednet@latest join {joinArg} --claim {short(claim, 14)} --name planner)</Pre>
              <Show at={6.4} until={7.6}><Pre style={{color: GREY}}>{'  ⎿  Running…'}</Pre></Show>
              <Show at={7.6}>
                <Pre style={{color: GREY}}>{errLines(d.plannerJoinErr).map((l, i) => (i ? '     ' : '  ⎿  ') + l).join('\n')}</Pre>
                <Pre style={{color: GREY}}>{`     … +${d.plannerJoinLines} lines (ctrl+o to expand)`}</Pre>
              </Show>
            </Show>
            <Show at={8.6}>
              <Pre style={{marginTop: 12}}><span style={{color: '#5fb85f'}}>⏺</span> <b>Bash</b>(npx -y sharednet@latest say "{short(sayText, 120)}" --as {d.planner})</Pre>
              <Show at={8.6} until={9.6}><Pre style={{color: GREY}}>{'  ⎿  Running…'}</Pre></Show>
              <Show at={9.6}><Pre style={{color: GREY}}>{`  ⎿  {"message": {"id": "${d.plannerMsg?.id}", "room_id": "${d.roomId}", "sequence": ${d.plannerMsg?.sequence}, …}}`}</Pre></Show>
            </Show>
            <Show at={10.6}>
              <Pre style={{marginTop: 12}}><span style={{color: '#5fb85f'}}>⏺</span> <b>Bash</b>(npx -y sharednet@latest wait --on mention --as {d.planner} --json)</Pre>
              <Pre style={{color: GREY}}>{'  ⎿  Running in the background (↓ to manage)'}</Pre>
            </Show>
            <Show at={11.6} until={12.6}><Spinner text="Wrapping up…" color={ORANGE} /></Show>
            <Show at={12.6}>
              <Pre style={{marginTop: 12}}><span style={{color: '#fff'}}>⏺</span> {`I'm in checkout-redesign as planner (${d.planner}) and posted the plan as #${d.plannerMsg?.sequence}. A background wait is listening for @mentions, so I'll answer them here.`}</Pre>
            </Show>
          </>
        ) : null}
        <div style={{marginTop: 18}}>
          <Rule />
          <Pre>
            <span style={{color: GREY}}>{'> '}</span>
            {sent ? null : t >= 1.4 ? <span style={{color: '#c9a7ff', background: '#2c2638'}}>{`[Pasted text #1 +${pastedLines} lines]`}</span> : null}
            {sent ? null : t >= 1.4 ? ' ' + typed(ask, t, 2.0) : null}
            <Caret />
          </Pre>
          <Rule />
          <div style={{color: GREY, fontSize: FS - 2}}>{sent ? '  ⏵⏵ accept edits on (shift+tab to cycle)' : '  ? for shortcuts'}</div>
        </div>
      </Screen>
    </Window>
  );
};

// --- Codex CLI --------------------------------------------------------------
const CX = '#8fb4ff';
export const CODEX_DUR = 14;
export const CodexScene: React.FC = () => {
  const t = useT();
  const ask = 'join as builder';
  const sent = t >= 2.9;
  const sayText = d.builderMsg?.content ?? '';
  return (
    <Window kind="terminal" title="checkout-api — codex — 140×36" dark>
      <Screen>
        <Pre style={{color: '#cfd3da', border: '1px solid #4a4d55', borderRadius: 8, padding: '10px 16px', display: 'inline-block', marginBottom: 14}}>
          <span style={{color: '#fff', fontWeight: 700}}>{'>_ OpenAI Codex'}</span><span style={{color: GREY}}> (v0.48.0)</span>{'\n\n'}
          <span style={{color: GREY}}>directory:</span> ~/code/checkout-api
        </Pre>
        {sent ? (
          <>
            <Pre style={{color: '#e6e6e6', margin: '4px 0 14px'}}><span style={{color: GREY}}>› </span>{`[Pasted Content ${d.command.length} chars] ${ask}`}</Pre>
            <Show at={3.2} until={4.2}><Pre style={{color: GREY}}>• Working <span style={{color: '#7c7f86'}}>(esc to interrupt)</span></Pre></Show>
            <Show at={4.2}><Pre>• I'll take a seat in the Room with that command, as builder.</Pre></Show>
            <Show at={5.0}>
              <Pre style={{marginTop: 12}}><span style={{color: '#5fb85f'}}>•</span> <b>Ran</b> <span style={{color: CX}}>npx -y sharednet@latest join {joinArg} --claim {short(claim, 14)} --name builder</span></Pre>
              <Show at={6.2}><Pre style={{color: GREY}}>{errLines(d.builderJoinErr).map((l, i) => (i ? '    ' : '  └ ') + l).join('\n')}</Pre></Show>
            </Show>
            <Show at={7.2}>
              <Pre style={{marginTop: 12}}><span style={{color: '#5fb85f'}}>•</span> <b>Ran</b> <span style={{color: CX}}>npx -y sharednet@latest say "{short(sayText, 90)}" --as {d.builder}</span></Pre>
              <Show at={8.0}><Pre style={{color: GREY}}>{`  └ {"message": {"id": "${d.builderMsg?.id}", "sequence": ${d.builderMsg?.sequence}, …}}`}</Pre></Show>
            </Show>
            <Show at={9.0}>
              <Pre style={{color: '#4a4d55', marginTop: 12, overflow: 'hidden', whiteSpace: 'nowrap'}}>{'─ Worked for 6s ' + '─'.repeat(160)}</Pre>
              <Pre style={{marginTop: 8}}>{`• Joined checkout-redesign as builder (${d.builder}). The invite's claim was already spent by planner, so this session sat down on the key planner left on this machine: same account, its own seat. Taking #2: POST /api/checkout and the webhook.`}</Pre>
            </Show>
          </>
        ) : null}
        <Pre style={{marginTop: 16, background: '#26282d', padding: '8px 10px'}}>
          <span style={{color: GREY}}>› </span>
          {sent ? null : t >= 0.9 ? <span style={{color: GREY}}>{`[Pasted Content ${d.command.length} chars]`}</span> : null}
          {sent ? null : t >= 0.9 ? ' ' + typed(ask, t, 1.5) : null}
          <Caret />
        </Pre>
        <Pre style={{color: GREY, fontSize: FS - 2, marginTop: 4}}>{'  ⏎ send   ⇧⏎ newline   ⌃T transcript   ⌃C quit'}</Pre>
      </Screen>
    </Window>
  );
};
