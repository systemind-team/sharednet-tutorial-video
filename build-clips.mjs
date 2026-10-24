// rec/ (frames + log) -> video/public/clips/<scene>.mp4 and video/src/take.json
//
// The screencast only delivers a frame when the page changes, so each frame is
// held until the next one arrives (concat demuxer durations), then resampled
// to a constant 30 fps. Cursor samples and clicks are rebased to each scene's
// start so the compositor can draw them on its own clock.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const log = JSON.parse(fs.readFileSync("rec/log.json", "utf8"));
const SCENES = ["home", "create", "invite", "room", "decide", "network"];
const only = process.argv.slice(2);
fs.mkdirSync("video/public/clips", { recursive: true });
fs.mkdirSync("rec/lists", { recursive: true });

const markAt = (name) => log.marks.find((m) => m.name === name)?.t;
const take = { view: log.view, data: {}, scenes: {} };

for (const name of SCENES) {
  const t0 = markAt(name), t1 = markAt(`${name}_end`);
  if (t0 == null || t1 == null) { console.warn(`skip ${name}: no marks`); continue; }
  const before = log.frames.filter((f) => f.t <= t0).at(-1);
  const inside = log.frames.filter((f) => f.t > t0 && f.t <= t1);
  const frames = [...(before ? [{ ...before, t: t0 }] : []), ...inside];
  const lines = [];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : t1;
    lines.push(`file '${process.cwd()}/rec/${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${process.cwd()}/rec/${frames.at(-1).file}'`);
  fs.writeFileSync(`rec/lists/${name}.txt`, lines.join("\n"));
  const dur = t1 - t0;
  if (!only.length || only.includes(name)) {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `rec/lists/${name}.txt`,
      "-fps_mode", "cfr", "-r", "30", "-t", dur.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p",
      `video/public/clips/${name}.mp4`], { stdio: "inherit" });
  }
  const rel = (t) => +(t - t0).toFixed(3);
  // Last known pointer position before the scene, so it does not pop in.
  const prior = log.cursor.filter((c) => c.t <= t0).at(-1);
  take.scenes[name] = {
    dur: +dur.toFixed(3),
    cursor: [...(prior ? [{ t: 0, x: prior.x, y: prior.y }] : []), ...log.cursor.filter((c) => c.t > t0 && c.t <= t1).map((c) => ({ t: rel(c.t), x: +c.x.toFixed(1), y: +c.y.toFixed(1) }))],
    clicks: log.clicks.filter((c) => c.t > t0 && c.t <= t1).map((c) => ({ t: rel(c.t), x: +c.x.toFixed(1), y: +c.y.toFixed(1), ...(c.drag ? { drag: c.drag } : {}) })),
    marks: Object.fromEntries((log.cues || []).filter((c) => c.t > t0 && c.t <= t1).map((c) => [c.name, rel(c.t)])),
  };
  console.log(`${name}: ${dur.toFixed(1)}s, ${frames.length} frames, ${take.scenes[name].clicks.length} clicks`);
}

// What the terminal scenes print: the real ids, with the dev origin shown as production.
const shown = (s) => (s || "").replace(/\/private\/tmp\/\S*?\/machines\/[^/]+\/home/g, "~").replaceAll("http://127.0.0.1:3001", "https://www.sharednet.ai").replaceAll("http://localhost:3001", "https://www.sharednet.ai");
const d = log.data;
take.data = {
  command: shown(d.command),
  roomId: d.roomId, planner: d.planner, builder: d.builder,
  plannerJoinErr: shown(d.plannerJoinErr), builderJoinErr: shown(d.builderJoinErr),
  plannerJoinLines: (d.plannerJoin || "").split("\n").length, builderJoinLines: (d.builderJoin || "").split("\n").length,
  plannerMsg: d.plannerSay ? JSON.parse(d.plannerSay).message : null,
  builderMsg: d.builderSay ? JSON.parse(d.builderSay).message : null,
};
fs.writeFileSync("video/src/take.json", JSON.stringify(take, null, 1));
console.log("wrote video/src/take.json");
