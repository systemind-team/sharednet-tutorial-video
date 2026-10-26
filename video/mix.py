"""Lay the narration and the swing trio under a rendered (silent) cut.

    python3 mix.py <lang> <video.mp4> <out.mp4>

Each line starts exactly at its caption's time (src/vo-<lang>.json); the music
ducks under the voice with a side-chain compressor; the result is normalised
to -16 LUFS (streaming level) and muxed with the picture untouched.
"""
import json, subprocess, sys

MUSIC = "public/audio/music-swing.wav"
MUSIC_GAIN = float(__import__("os").environ.get("MG", "0.26"))
VOICE_GAIN = 2.8      # TTS comes out around -25 dB; bring it ~9 dB above the bed


def main(lang, video, out):
    vo = json.load(open(f"src/vo-{lang}.json"))
    args = ["ffmpeg", "-loglevel", "error", "-y", "-i", video, "-i", MUSIC]
    for v in vo:
        args += ["-i", f"public/{v['file']}"]
    parts, labels = [], []
    for i, v in enumerate(vo):
        ms = int(round(v["at"] * 1000))
        parts.append(f"[{i + 2}:a]aresample=44100,aformat=channel_layouts=stereo,volume={VOICE_GAIN},adelay={ms}|{ms}[v{i}]")
        labels.append(f"[v{i}]")
    parts.append(f"{''.join(labels)}amix=inputs={len(vo)}:normalize=0:duration=longest,apad,asplit[vo][key]")
    parts.append(f"[1:a]volume={MUSIC_GAIN}[bed]")
    parts.append("[bed][key]sidechaincompress=threshold=0.015:ratio=8:attack=40:release=600:makeup=1[ducked]")
    parts.append(f"[ducked][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95:level=disabled{",loudnorm=I=-16:TP=-1.5:LRA=11" if __import__("os").environ.get("NORM","1")=="1" else ""}[a]")
    args += ["-filter_complex", ";".join(parts), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-ar", "48000", "-shortest", out]
    subprocess.run(args, check=True)
    print(out)


if __name__ == "__main__":
    main(*sys.argv[1:4])
