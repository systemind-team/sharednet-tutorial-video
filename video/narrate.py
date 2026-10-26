"""Speak every cue in the edit, fitted to the time its caption is on screen.

    python3 narrate.py            # both languages
Reads the cue sheet straight from the edit (esbuild -> node), writes
public/audio/vo-<lang>-NN.mp3 and src/vo-<lang>.json, and prints how each line fits.
Lines start when their caption appears; a line that would outrun its caption
is re-spoken faster (up to MAX_RATE).
"""
import json, math, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TTS = os.environ.get("EDGE_TTS", "edge-tts")
PROXY = os.environ.get("TTS_PROXY")
VOICE = {"zh": "zh-CN-YunyangNeural", "en": "en-US-EmmaNeural"}
BASE_RATE = {"zh": 22, "en": 12}   # percent faster than the voice's default
MAX_RATE = 60
MARGIN = 0.35                      # leave this much air before the next caption


def cues():
    subprocess.run([f"{HERE}/node_modules/.bin/esbuild", "src/cues-entry.ts", "--bundle", "--platform=node", "--format=esm",
                    "--loader:.json=json", "--outfile=/tmp/sharednet-cues.mjs", "--log-level=warning"], cwd=HERE, check=True)
    return json.loads(subprocess.run(["node", "/tmp/sharednet-cues.mjs"], capture_output=True, text=True, check=True).stdout)


def spoken(text, lang):
    t = text.replace("「", "").replace("」", "")
    if lang == "zh":
        t = t.replace("@", " 艾特 ")
    else:
        t = t.replace("@-mentions", "at-mentions").replace("@", "at")
    return re.sub(r"\s+", " ", t).strip()


def say(text, voice, rate, out):
    cmd = [TTS, "--voice", voice, f"--rate=+{rate}%", "--text", text, "--write-media", out]
    if PROXY:
        cmd += ["--proxy", PROXY]
    subprocess.run(cmd, check=True, capture_output=True)
    # trim the silence edge-tts leaves at both ends
    tmp = out + ".trim.mp3"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", out, "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                    "-b:a", "160k", tmp], check=True)
    os.replace(tmp, out)
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                                capture_output=True, text=True, check=True).stdout)


def main(langs):
    sheet = cues()
    os.makedirs(f"{HERE}/public/audio", exist_ok=True)
    for lang in langs:
        rows = []
        for i, c in enumerate(sheet[lang]):
            rel = f"audio/vo-{lang}-{i:02d}.mp3"
            out = f"{HERE}/public/{rel}"
            text, budget = spoken(c["text"], lang), c["window"] - MARGIN
            rate = BASE_RATE[lang]
            dur = say(text, VOICE[lang], rate, out)
            if dur > budget:
                # duration scales ~1/(1+rate); solve for the rate that fits
                rate = min(MAX_RATE, math.ceil(((1 + rate / 100) * dur / budget - 1) * 100) + 2)
                dur = say(text, VOICE[lang], rate, out)
            fit = "OK " if dur <= budget else "OVER"
            print(f"{lang} {i:02d} {fit} at {c['at']:6.2f}  {dur:4.2f}s / {c['window']:4.2f}s  +{rate}%  {c['text'][:40]}")
            rows.append({"at": round(c["at"], 3), "file": rel, "dur": round(dur, 3)})
        with open(f"{HERE}/src/vo-{lang}.json", "w") as f:
            json.dump(rows, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1:] or ["zh", "en"])
