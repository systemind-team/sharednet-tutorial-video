// Records the SharedNet tutorial against the real app running locally.
//
// The browser is driven like a person would drive it (eased, slightly curved
// mouse paths; uneven typing), while real CLI processes play the Agents: they
// join with the command the Dashboard hands out, talk in the Room, and ask for
// a Decision. Every screencast frame is saved with its timestamp, and so is
// every cursor position, so the compositor can draw a smooth cursor at 30 fps
// whatever rate the screencast delivered.
//
//   node record.mjs            -> rec/frames/*.jpg, rec/log.json
import { chromium } from "playwright-core";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3001";
const SHOWN_BASE = "https://www.sharednet.ai";
const SP = new URL("./.state", import.meta.url).pathname;
const OUT = path.resolve("rec");
const VIEW = { width: 1536, height: 864 };
const DPR = 2;
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(`${OUT}/frames`, { recursive: true });

const log = { view: VIEW, dpr: DPR, frames: [], cursor: [], clicks: [], marks: [], cues: [], data: {} };
const now = () => Date.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const cue = (name) => log.cues.push({ name, t: now() });
const mark = (name) => { log.marks.push({ name, t: now() }); console.log(`[mark] ${name}`); };

// ---- real CLI agents ----------------------------------------------------
function snFull(agent, args) {
  return new Promise((resolve, reject) => {
    execFile(new URL("./sn.sh", import.meta.url).pathname, [agent, ...args], { maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${agent} ${args.join(" ")}: ${stderr || stdout || err.message}`));
      else resolve({ stdout, stderr });
    });
  });
}
const sn = (agent, args) => snFull(agent, args).then((r) => r.stdout);
function psql(sql) {
  return new Promise((resolve, reject) => {
    execFile("psql", ["postgres://localhost:5432/sharednet_dev", "-Atc", sql], (err, stdout, stderr) => (err ? reject(new Error(stderr)) : resolve(stdout.trim())));
  });
}
// An Agent with a seat keeps a wait open, as a listening Agent would, so the
// Room shows its messages as received instead of "Waiting for … to receive".
const listeners = [];
function listen(agent, seat) {
  const state = { on: true };
  listeners.push(state);
  (async () => {
    while (state.on) {
      try { await sn(agent, ["wait", "--as", seat, "--timeout", "20", "--json"]); } catch (e) { await sleep(1000); }
    }
  })();
}
const say = async (agent, seat, text) => {
  const out = await sn(agent, ["say", text, "--as", seat]);
  console.log(`[say] ${agent}: ${text.slice(0, 60)}`);
  return out;
};

// Sam answering his own Decisions in his own browser session, off camera.
async function samAllowAll() {
  const cookie = fs.readFileSync(`${SP}/sam.cookies`, "utf8").split("\n").filter((l) => l.startsWith("#HttpOnly_") || (l && !l.startsWith("#"))).map((l) => { const p = l.replace(/^#HttpOnly_/, "").split("\t"); return `${p[5]}=${p[6]}`; }).join("; ");
  const headers = { cookie, origin: BASE, "content-type": "application/json" };
  const out = [];
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${BASE}/api/sharednet/decisions`, { headers })).json();
    const pending = (list.decisions || list.items || []).map((x) => x.decision ?? x).filter((x) => x.status === "pending");
    for (const d of pending) {
      const r = await fetch(`${BASE}/api/sharednet/decisions/${d.decision_id ?? d.id}`, { method: "PATCH", headers, body: JSON.stringify({ outcome: "approved", ...(d.contact ? { scope: "source_principal_action" } : {}) }) });
      out.push(`${d.decision_id ?? d.id} ${r.status}`);
    }
    if (pending.length) return out;
    await sleep(500);
  }
  return out;
}

// ---- browser ------------------------------------------------------------
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, permissions: ["clipboard-read", "clipboard-write"] });
const jar = fs.readFileSync(`${SP}/alex.cookies`, "utf8").split("\n").filter((l) => l.startsWith("#HttpOnly_") || (l && !l.startsWith("#")));
await ctx.addCookies(jar.map((l) => { const p = l.replace(/^#HttpOnly_/, "").split("\t"); return { name: p[5], value: p[6], domain: p[0], path: p[2], httpOnly: l.startsWith("#HttpOnly_") }; }));
// Cosmetic only: the dev build says 127.0.0.1:3001 where production says
// www.sharednet.ai. Swapped after hydration, on screen only (the clipboard
// keeps the real command, which the CLI below actually runs). Also hides the
// Next.js dev-mode badge.
await ctx.addInitScript(({ from, to }) => {
  const style = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(s); };
  if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
  const swap = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) for (const f of from) if (n.nodeValue.includes(f)) n.nodeValue = n.nodeValue.split(f).join(to);
  };
  window.addEventListener("load", () => setTimeout(() => {
    swap(document.body);
    new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") swap(m.target.parentNode || document.body); for (const a of m.addedNodes) swap(a.nodeType === 3 ? a.parentNode : a); } })
      .observe(document.body, { subtree: true, childList: true, characterData: true });
  }, 400));
}, { from: ["http://127.0.0.1:3001", "http://localhost:3001"], to: "https://www.sharednet.ai" });

const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
let recording = false;
let pending = null; // last frame seen while not recording
let n = 0;
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  const t = metadata.timestamp;
  if (!recording) { pending = { data, t }; return; }
  if (pending) { write(pending.data, pending.t); pending = null; }
  write(data, t);
});
function write(data, t) {
  const file = `frames/${String(n++).padStart(6, "0")}.jpg`;
  fs.writeFileSync(`${OUT}/${file}`, Buffer.from(data, "base64"));
  log.frames.push({ file, t });
}
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: VIEW.width * DPR, maxHeight: VIEW.height * DPR, everyNthFrame: 1 });
const rec = (on) => { recording = on; if (on && pending) { write(pending.data, now()); pending = null; } };

// ---- a person's hand ----------------------------------------------------
let cx = VIEW.width * 0.62, cy = VIEW.height * 0.78;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function moveTo(x, y, ms) {
  const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
  ms = ms ?? Math.min(1100, 320 + dist * 0.75);
  const bend = rand(-0.12, 0.12) * dist;
  const mx = cx + dx / 2 - (dy / (dist || 1)) * bend, my = cy + dy / 2 + (dx / (dist || 1)) * bend;
  const x0 = cx, y0 = cy, steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps), u = 1 - t;
    const px = u * u * x0 + 2 * u * t * mx + t * t * x, py = u * u * y0 + 2 * u * t * my + t * t * y;
    await page.mouse.move(px, py);
    log.cursor.push({ t: now(), x: px, y: py });
    await sleep(ms / steps);
  }
  cx = x; cy = y;
}
// Scroll with the wheel, a notch at a time, until the target sits inside
// every clipping ancestor and the viewport. Overlays (the home page's particle
// layer) do not count as hiding it, and a wheel that moves nothing ends it.
async function reveal(locator) {
  let last = null;
  for (let i = 0; i < 40; i++) {
    const st = await locator.evaluate((el, vh) => {
      const r = el.getBoundingClientRect();
      let top = 0, bottom = vh;
      for (let a = el.parentElement; a; a = a.parentElement) {
        const o = getComputedStyle(a).overflowY;
        if (o === "auto" || o === "scroll" || o === "hidden") { const b = a.getBoundingClientRect(); top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
      }
      const shown = r.top >= top - 1 && r.bottom <= bottom + 1;
      return { shown, down: r.bottom > bottom, y: r.top };
    }, VIEW.height).catch(() => ({ shown: true }));
    if (st.shown) return;
    if (last !== null && Math.abs(st.y - last) < 1) return; // nothing scrolls any further
    last = st.y;
    await page.mouse.wheel(0, st.down ? 90 : -90);
    await sleep(60);
  }
}
async function to(locator, { fx = 0.5, fy = 0.5, ms } = {}) {
  await locator.waitFor({ state: "visible", timeout: 20000 });
  await reveal(locator);
  await sleep(150);
  const b = await locator.boundingBox();
  await moveTo(b.x + b.width * fx + rand(-3, 3), b.y + b.height * fy + rand(-2, 2), ms);
}
async function click() {
  await sleep(rand(90, 180));
  log.clicks.push({ t: now(), x: cx, y: cy });
  await page.mouse.down(); await sleep(rand(60, 110)); await page.mouse.up();
}
async function clickOn(locator, opts) { await to(locator, opts); await click(); }
async function type(text) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(/[ ,.—]/.test(ch) ? rand(70, 190) : rand(35, 105));
  }
}
const hold = (ms) => sleep(ms);
// Keep the pointer alive while reading, as a hand on a trackpad does.
async function drift(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { await moveTo(cx + rand(-14, 14), cy + rand(-8, 8), rand(500, 900)); await sleep(rand(150, 400)); }
}

// ---- the take -----------------------------------------------------------
try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.mouse.move(cx, cy);
  await hold(2500);

  // 1. Home -> Dashboard
  rec(true); mark("home");
  await hold(1400);
  await to(page.locator("text=help me start with SharedNet").first(), { fx: 0.4 });
  await drift(1600);
  await clickOn(page.getByRole("link", { name: "Dashboard" }).first());
  await page.waitForURL(/\/chat/);
  await page.waitForLoadState("networkidle");
  await hold(1600);
  mark("home_end");

  // 2. New Room
  mark("create");
  const form = page.locator("section form.room-schedule-form").first();
  await to(form.locator('input[name="room-name"]'));
  await drift(700);
  await click();
  await type("checkout-redesign");
  await hold(300);
  cue("brief");
  await clickOn(form.locator('textarea[name="room-brief"]'));
  await type("Redesign the pricing page and wire up Stripe Checkout.");
  await hold(500);
  await clickOn(form.locator("button[type=submit]"));
  const copy = page.getByRole("button", { name: "Copy command" });
  await copy.waitFor();
  await sleep(500);
  await page.evaluate(() => { for (const el of document.querySelectorAll("dialog *, [role=dialog], [role=dialog] *, dialog")) if (el.scrollTop > 0) el.scrollTop = 0; });
  await hold(900);
  mark("create_end");

  // 3. Invite my Agents -> Copy command
  mark("invite");
  await to(page.getByText("Invite my Agents").first());
  await drift(900);
  await to(page.getByText("Always online").first());
  await drift(1000);
  await moveTo(cx + 40, cy + 60, 500);
  cue("scroll");
  await reveal(copy);
  await drift(600);
  await clickOn(copy);
  await hold(1500);
  const command = await page.evaluate(() => navigator.clipboard.readText());
  log.data.command = command;
  mark("invite_end");
  rec(false);

  // Off camera: the Agents join with exactly that command.
  const joinLine = command.split("\n")[0];
  const m = joinLine.match(/join '([^']+)' --claim (\S+)/);
  const roomId = m[1].match(/ROOM=(\S+)/)[1];
  log.data.roomId = roomId;
  const pj = await snFull("alex-claude", ["join", m[1], "--claim", m[2], "--name", "planner"]);
  const plannerOut = pj.stdout; log.data.plannerJoinErr = pj.stderr;
  log.data.plannerJoin = plannerOut;
  const planner = JSON.parse(plannerOut).member_id;
  const bj = await snFull("alex-codex", ["join", m[1], "--claim", m[2], "--name", "builder"]);
  const builderOut = bj.stdout; log.data.builderJoinErr = bj.stderr;
  log.data.builderJoin = builderOut;
  const builder = JSON.parse(builderOut).member_id;
  Object.assign(log.data, { planner, builder });
  listen("alex-claude", planner);
  listen("alex-codex", builder);
  log.data.plannerSay = await say("alex-claude", planner, "Joined as planner. Plan for checkout-redesign:\n1. Pricing table (Free / Pro / Team) — me\n2. Stripe Checkout session + webhook — @builder\n3. Receipts and the success page — after 1 and 2 land");
  await sleep(2500);
  log.data.builderSay = await say("alex-codex", builder, "builder here, on Codex in checkout-api. Taking #2: POST /api/checkout and the checkout.session.completed webhook.");
  await sn("alex-codex", ["reach", "private"]);
  await page.getByRole("button", { name: "Close" }).click().catch(() => {});
  await page.waitForTimeout(4000);

  // 6. The Room, live
  rec(true); mark("room");
  await hold(1200);
  await to(page.locator("text=Pricing table").first(), { fx: 0.3 });
  await drift(1800);
  const live = (ms, fn) => sleep(ms).then(fn).catch((e) => console.error(e.message));
  live(600, () => say("alex-codex", builder, "Webhook is in: it verifies the Stripe signature and marks the order paid. 4/4 tests green on feat/stripe-checkout."));
  await drift(3200);
  cue("compose");
  await clickOn(page.locator('button[aria-controls="room-composer"]'));
  await hold(600);
  await clickOn(page.locator('textarea[aria-label="Message to the Agents in this Room"]'), { fx: 0.3 });
  await type("Nice work. Let's get this on staging today. Ping me for anything about pricing.");
  await hold(400);
  await clickOn(page.locator('#room-composer button[type="submit"]'));
  await hold(2500);
  cue("mention");
  await say("alex-claude", planner, "@Alex Rivera one call before I lock the pricing table: Pro at $19/mo or $24/mo?");
  await hold(1500);
  await to(page.locator("text=Pro at $19/mo or $24/mo").first(), { fx: 0.4 });
  await drift(1500);
  await clickOn(page.locator('textarea[aria-label="Message to the Agents in this Room"]'), { fx: 0.3 });
  cue("reply");
  await type("$24/mo. Annual gets two months free.");
  await hold(300);
  await page.keyboard.press("Enter").catch(() => {});
  await hold(400);
  if (await page.locator('textarea[aria-label="Message to the Agents in this Room"]').inputValue().catch(() => "") !== "") await clickOn(page.locator('#room-composer button[type="submit"]'));
  await hold(2600);
  cue("locked");
  await say("alex-claude", planner, "Locked: Pro $24/mo, $240/yr. Updating the table now. @builder please create both prices in Stripe test mode.");
  await drift(2600);
  await say("alex-codex", builder, "Created price_pro_monthly ($24) and price_pro_yearly ($240) in test mode and wired them into /api/checkout ✅");
  await page.getByText("wired them into /api/checkout").filter({ visible: true }).first().waitFor({ timeout: 20000 });
  await drift(3000);
  mark("room_end");
  rec(false);

  // Off camera: Sam's design Agent asks for Alex's builder.
  const samSession = fs.readFileSync(`${SP}/sam.session`, "utf8").trim();
  const samRoom = fs.readFileSync(`${SP}/sam.room`, "utf8").trim();
  log.data.addRequest = await sn("sam-cursor", ["room", "add", samRoom, "--with", builder, "--session", samSession, "--json"]);
  log.data.samSeat = samSession;
  await page.waitForTimeout(6000);

  // 7. Decisions
  rec(true); mark("decide");
  await hold(1000);
  await to(page.locator('a[href="/decisions"]').first());
  await drift(900);
  await clickOn(page.locator('a[href="/decisions"]').first(), { ms: 260 });
  await page.waitForURL(/\/decisions/);
  await page.waitForLoadState("networkidle");
  await hold(1200);
  await to(page.getByText("Pro at $19/mo or $24/mo").filter({ visible: true }).last(), { fx: 0.4 });
  await drift(1500);
  await clickOn(page.getByRole("button", { name: "Mark done" }));
  cue("approval");
  await hold(1400);
  const approve = page.getByRole("button", { name: /^(Approve|Allow)$/ }).first();
  await approve.waitFor({ timeout: 20000 });
  await to(page.getByText(/wants to add builder to Room/).filter({ visible: true }).last(), { fx: 0.35 });
  await drift(2600);
  cue("approve");
  await clickOn(approve);
  await hold(2200);
  // Sam's Agent, now sharing a Room with builder, @-mentions it. Across
  // accounts that is held until builder's owner allows it.
  cue("consent");
  await sn("sam-cursor", ["room", "post", samRoom, "--content", "@builder welcome to design-system. Which price IDs should the pricing cards read?", "--session", samSession]);
  const always = page.getByRole("button", { name: "Always allow from this principal" });
  await always.waitFor({ timeout: 30000 });
  await hold(800);
  await to(page.getByText("Allow an agent to respond?").filter({ visible: true }).last(), { fx: 0.3 });
  await drift(2400);
  cue("always");
  await clickOn(always);
  await hold(2600);
  mark("decide_end");
  rec(false);

  // Off camera: builder answers, and Sam (the other owner) allows Alex's Agents
  // the same way, so the mention goes through both directions.
  await sn("alex-codex", ["join", samRoom, "--as", builder]);
  await say("alex-codex", builder, "@design-reviewer use price_pro_monthly and price_pro_yearly, both in test mode. Live IDs come after Alex signs off.");
  log.data.samAllowed = await samAllowAll();
  rec(true);

  // 8. Network
  mark("network");
  await clickOn(page.locator('a[href="/network"]').first());
  await page.waitForURL(/\/network/);
  await page.waitForLoadState("networkidle");
  await hold(1500);
  const node = (name) => page.locator("text=" + name).last();
  await to(node("planner")); await drift(1200);
  await to(node("builder")); await drift(1200);
  cue("switch");
  const select = page.locator("select").first();
  await clickOn(select);
  await sleep(500);
  await select.selectOption({ label: "design-system" });
  await page.keyboard.press("Escape").catch(() => {});
  await drift(6000);
  await to(node("design-reviewer")); await drift(1500);
  await to(node("builder")); 
  await drift(2500);
  mark("network_end");
  rec(false);
} catch (e) {
  console.error("TAKE FAILED:", e);
  await page.screenshot({ path: `${OUT}/failure.png` });
  log.error = String(e);
} finally {
  for (const l of listeners) l.on = false;
  await cdp.send("Page.stopScreencast").catch(() => {});
  fs.writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
  await browser.close();
  console.log(`frames: ${log.frames.length}`);
  setTimeout(() => process.exit(log.error ? 1 : 0), 500);
}
