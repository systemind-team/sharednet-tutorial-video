"""Five more beds, same rules as synth.py: synthesized from scratch, any length.

    python3 music/styles2.py <style> <seconds> <out.wav>

Styles: piano (felt piano, slow and cinematic), synthwave (80s arps, gated
snare), marimba (bouncy mallets and pizzicato), garage (chill two-step with
side-chained pads), guitar (plucked acoustic strums, claps, folk-pop).
"""
import sys

import numpy as np
from scipy.io import wavfile

from synth import SR, clap, env, hat, highpass, kick, lowpass, midi, pad, place, reverb, rng, saw, snare


def piano(f, dur, vel=1.0):
    """Felt piano: slightly inharmonic partials, soft hammer, two-stage decay."""
    t = np.arange(int(dur * SR)) / SR
    B = 0.0004
    out = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (0.9 ** k) / k ** 0.6
        decay = 0.9 + 0.35 * k
        out += amp * np.sin(2 * np.pi * fk * t + rng.random()) * (0.7 * np.exp(-t * decay) + 0.3 * np.exp(-t * decay * 0.25))
    hammer = lowpass(rng.standard_normal(len(t)), 1800) * np.exp(-t * 60) * 0.05
    return lowpass(out + hammer, 2600 + 2400 * vel) * vel * env(len(t), 0.002, 0.05, 1, 0.12)


def karplus(f, dur, bright=0.5):
    """Karplus–Strong plucked string."""
    n = int(dur * SR)
    p = max(2, int(SR / f))
    buf = lowpass(rng.uniform(-1, 1, p), 2000 + 6000 * bright)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.4985 * (buf[i % p] + buf[(i + 1) % p])
    return out * env(n, 0.001, 0.05, 1, 0.05)


def marimba(f, dur=0.6):
    t = np.arange(int(dur * SR)) / SR
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 6)
         + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 18)
         + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 40))
    return s * env(len(t), 0.002, 0.05, 1, 0.05)


def pizz(f, dur=0.35):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 for k in range(1, 7))
    return lowpass(s, 2500) * np.exp(-t * 11)


def sine_bass(f, dur, a=0.01, r=0.08):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * env(len(t), a, 0.1, 0.8, r)


PROG = {
    "piano": [[41, 53, 57, 60, 64], [40, 52, 55, 59, 62], [38, 50, 53, 57, 60], [36, 48, 52, 55, 59]],      # Fmaj7 Em7 Dm7 Cmaj7
    "synthwave": [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]],                 # Am F C G
    "marimba": [[48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69]],                   # C G Am F
    "garage": [[38, 53, 57, 60, 64], [43, 53, 58, 62, 65], [36, 52, 55, 59, 62], [45, 52, 55, 60, 64]],    # Dm9 Gm9 Cmaj9 Am7
    "guitar": [[43, 55, 59, 62, 67], [38, 54, 57, 62, 66], [40, 55, 59, 64, 67], [36, 55, 60, 64, 67]],    # G D Em C
}
BPM = {"piano": 70, "synthwave": 100, "marimba": 108, "garage": 124, "guitar": 96}


def render(style, seconds):
    beat = 60 / BPM[style]
    bar = beat * 4
    n = int(seconds * SR)
    L, R = np.zeros(n), np.zeros(n)
    both = lambda s, t, pan=0.5: (place(L, s * (1 - pan) * 2 * 0.5 ** 0.5, t), place(R, s * pan * 2 * 0.5 ** 0.5, t))
    for b in range(int(np.ceil(seconds / bar)) + 1):
        t0, ch = b * bar, PROG[style][b % 4]
        if style == "piano":
            both(piano(midi(ch[0]), bar * 1.3, 0.6) * 0.30, t0, 0.42)
            for k, x in enumerate(ch[1:]):
                both(piano(midi(x), bar * 1.2, 0.5) * 0.16, t0 + 0.012 * k, 0.4 + 0.06 * k)
            melody = [ch[4] + 12, ch[3] + 12, ch[2] + 12, ch[3] + 12]
            for i, x in enumerate(melody):
                both(piano(midi(x), beat * 2, 0.75) * 0.2, t0 + i * beat + (0.02 if i else 0), 0.6)
            p = pad([x + 12 for x in ch[1:]], bar + 0.6, 1200) * 0.05
            both(p, t0)
        elif style == "synthwave":
            for i in range(4):
                both(kick(0.3, 130, 55) * 0.32, t0 + i * beat)
            for hit in (1, 3):
                s = snare(0.5, 0.35)
                tail = reverb(np.pad(s, (0, int(0.3 * SR))), 0.8, 0.6)[: int(0.32 * SR)]  # gated
                both(tail * 0.4, t0 + hit * beat)
            for i in range(8):
                both(hat(0.04) * 0.05, t0 + i * beat / 2 + beat / 4, 0.6)
            for i in range(8):
                bt = np.arange(int(beat / 2 * 0.85 * SR)) / SR
                both(lowpass(saw(midi(ch[0]), bt, 2, 0.06), 800) * env(len(bt), 0.004, 0.1, 0.6, 0.04) * 0.14, t0 + i * beat / 2)
            arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24]
            for i in range(16):
                bt = np.arange(int(beat / 4 * 0.9 * SR)) / SR
                s = lowpass(saw(midi(arp[i % 4]), bt, 2, 0.1), 3200) * env(len(bt), 0.003, 0.05, 0.6, 0.03) * 0.11
                both(s, t0 + i * beat / 4, 0.3 if i % 2 else 0.7)
            both(pad([x + 12 for x in ch[1:]], bar, 2400) * 0.13, t0)
        elif style == "marimba":
            both(kick(0.25, 140, 60) * 0.22, t0); both(kick(0.25, 140, 60) * 0.22, t0 + 2.5 * beat)
            for hit in (1, 3):
                both(clap() * 0.22, t0 + hit * beat)
            for i in range(8):
                both(hat(0.03) * 0.04, t0 + i * beat / 2 + beat / 4, 0.65)
            pat = [1, 2, 3, 2, 1, 3, 2, 3]
            for i, k in enumerate(pat):
                both(marimba(midi(ch[k] + 12)) * 0.22, t0 + i * beat / 2, 0.35 + 0.3 * (i % 2))
            for i in (0, 1.5, 2, 3):
                both(pizz(midi(ch[0] + 12)) * 0.2, t0 + i * beat, 0.45)
            both(marimba(midi(ch[3] + 24), 0.4) * 0.12, t0 + 3.5 * beat, 0.7)
        elif style == "garage":
            sw = beat / 4 * 0.33
            for hit in (0, 1.75, 2.5):
                both(kick(0.3, 120, 50) * 0.3, t0 + hit * beat)
            for hit in (1, 3):
                both(lowpass(snare(0.25, 0.2), 6000) * 0.2, t0 + hit * beat + 0.01)
            for i in range(16):
                both(hat(0.03) * (0.05 if i % 2 else 0.025), t0 + i * beat / 4 + (sw if i % 2 else 0), 0.6)
            p = pad([x + 12 for x in ch[1:]], bar, 2800) * 0.22
            # side-chain pump: duck on every beat
            tp = np.arange(len(p)) / SR
            p *= 0.35 + 0.65 * np.clip((tp % beat) / (beat * 0.6), 0, 1) ** 0.7
            both(p, t0)
            for i, x in enumerate([ch[0] + 12, ch[0] + 12, ch[0] + 24, ch[0] + 12]):
                both(sine_bass(midi(x), beat * 0.45) * 0.16, t0 + i * beat + beat / 2)
            both(piano(midi(ch[4] + 12), beat, 0.6) * 0.08, t0 + 1.5 * beat, 0.7)
        else:  # guitar
            for hit in (0, 2, 2.5):
                both(kick(0.3, 100, 50) * 0.28, t0 + hit * beat)
            for hit in (1, 3):
                both(clap() * 0.24, t0 + hit * beat)
            for i in range(8):
                both(hat(0.04) * 0.035, t0 + i * beat / 2, 0.7)
            strum = [0, 1, 1.5, 2.5, 3, 3.5]
            for j, s_at in enumerate(strum):
                down = j % 2 == 0
                notes = ch if down else ch[::-1]
                for k, x in enumerate(notes):
                    both(karplus(midi(x + (12 if x < 50 else 0)), beat * 1.1, 0.55 if down else 0.35) * (0.10 if down else 0.07), t0 + s_at * beat + k * 0.011, 0.3 + 0.08 * k)
            both(sine_bass(midi(ch[0]), beat * 1.8) * 0.14, t0)
            both(sine_bass(midi(ch[0]), beat * 1.2) * 0.12, t0 + 2.5 * beat)
    L, R = reverb(L, 2.3 if style == "piano" else 1.6, 0.3 if style == "piano" else 0.2), reverb(R, 2.4 if style == "piano" else 1.7, 0.3 if style == "piano" else 0.2)
    L, R = highpass(L, 60), highpass(R, 60)
    st = np.stack([L, R], 1)
    fade = int(1.5 * SR)
    st[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))[:, None]
    st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    st = np.tanh(st * 1.1)
    return st / (np.abs(st).max() / 0.85)


if __name__ == "__main__":
    style, seconds, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    wavfile.write(out, SR, (render(style, seconds) * 32767).astype(np.int16))
    print(out)
