"""Jazz beds, synthesized like the others.

    python3 music/jazz.py <style> <seconds> <out.wav>

Styles: swing (piano trio: walking bass, ride, brushes, rootless comping),
bossa (nylon guitar, rim click, shaker, Rhodes), latenight (slow swing,
Rhodes pads, muted-trumpet line, brushes).
"""
import sys

import numpy as np
from scipy.io import wavfile

from styles2 import karplus, piano, sine_bass
from synth import SR, env, epiano, highpass, lowpass, midi, place, reverb, rng


def ride(dur=0.9, accent=1.0):
    """Metallic cluster of detuned squares through a high-pass, long shimmer."""
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (329, 431, 547, 669, 811, 1013))
    s = highpass(s, 5000) * (0.6 * np.exp(-t * 4) + 0.4 * np.exp(-t * 25))
    ping = np.sin(2 * np.pi * 3170 * t) * np.exp(-t * 9) * 0.25
    return (s * 0.15 + ping) * accent


def brush_tap(dur=0.18):
    t = np.arange(int(dur * SR)) / SR
    return lowpass(highpass(rng.standard_normal(len(t)), 1200), 6000) * np.exp(-t * 22)


def brush_swish(dur):
    t = np.arange(int(dur * SR)) / SR
    n = lowpass(highpass(rng.standard_normal(len(t)), 2000), 7000)
    return n * (0.5 + 0.5 * np.sin(np.pi * t / dur)) * 0.25


def rim(dur=0.08):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * 1700 * t) * 0.6 + highpass(rng.standard_normal(len(t)), 3000) * 0.4) * np.exp(-t * 60)


def shaker(dur=0.07):
    t = np.arange(int(dur * SR)) / SR
    return highpass(rng.standard_normal(len(t)), 6000) * np.sin(np.pi * t / dur) ** 2


def upright(f, dur):
    """Plucked upright: string plus a round body thump."""
    s = karplus(f * 2, dur, 0.15) * 0.6
    t = np.arange(len(s)) / SR
    body = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.5) * env(len(t), 0.004, 0.05, 1, 0.06)
    return lowpass(s + body * 0.9, 1400)


def trumpet(f, dur, vib=5.2):
    """Harmon-muted trumpet: bright saw, nasal band-pass, delayed vibrato, breath."""
    t = np.arange(int(dur * SR)) / SR
    depth = 0.006 * np.clip((t - 0.25) / 0.3, 0, 1)
    ph = np.cumsum(f * (1 + depth * np.sin(2 * np.pi * vib * t))) / SR
    s = sum(np.sin(2 * np.pi * k * ph) / k ** 0.9 for k in range(1, 12))
    s = lowpass(highpass(s, 700), 2600)
    breath = lowpass(highpass(rng.standard_normal(len(t)), 1500), 4000) * 0.04
    return (s + breath) * env(len(t), 0.06, 0.15, 0.75, 0.18)


SWING = 2 / 3  # off-beat eighth lands two-thirds of the way through the beat


def render(style, seconds):
    bpm = {"swing": 132, "bossa": 128, "latenight": 66}[style]
    beat = 60 / bpm
    bar = beat * 4
    n = int(seconds * SR)
    L, R = np.zeros(n), np.zeros(n)

    def put(s, t, pan=0.5):
        place(L, s * np.sqrt(1 - pan) * 1.41, t)
        place(R, s * np.sqrt(pan) * 1.41, t)

    if style == "swing":
        # | Dm9 | G13 | Cmaj9 | A7b13 |  rootless left-hand voicings + walking bass
        comp = [[53, 57, 60, 64], [53, 57, 59, 64], [52, 55, 59, 62], [55, 58, 61, 65]]
        walk = [[38, 41, 45, 42], [43, 47, 50, 49], [36, 40, 43, 46], [45, 44, 43, 39]]
        hits = [[(1 + SWING) * 1, 3], [0 + SWING, 2 + SWING], [1, 2 + SWING], [0 + SWING, 3]]
        line = [[69, 72, 76, None], [77, 76, 74, 71], [72, None, 67, 69], [70, 73, 77, 76]]
    elif style == "bossa":
        comp = [[52, 55, 59, 62], [48, 55, 57, 60], [50, 53, 57, 60], [49, 53, 55, 59]]  # Cmaj9 Am9 Dm9 G13(b9)-ish
        walk = [[36, 43], [45, 40], [38, 45], [43, 38]]
    else:
        comp = [[53, 57, 60, 64], [52, 55, 59, 62], [51, 55, 58, 62], [50, 53, 57, 60]]  # Fmaj9 Em9 Ebmaj7#11 Dm9
        walk = [[41, 36], [40, 47], [39, 46], [38, 43]]
        melody = [[(0, 72, 1.6), (2, 74, 0.6), (2 + SWING, 76, 1.2)], [(0.5, 74, 1.4), (2.5, 71, 1.4)],
                  [(0, 70, 0.6), (1, 74, 0.6), (1 + SWING, 77, 2.0)], [(1, 76, 0.5), (1 + SWING, 74, 0.5), (2, 72, 1.8)]]

    for b in range(int(np.ceil(seconds / bar)) + 1):
        t0, k = b * bar, b % 4
        if style == "swing":
            for i, x in enumerate(walk[k]):
                put(upright(midi(x), beat * 0.95) * 0.3, t0 + i * beat, 0.45)
            # ride: ding, ding-a, ding, ding-a
            for i in range(4):
                put(ride(0.9, 0.9 if i % 2 else 0.7) * 0.85, t0 + i * beat, 0.68)
                if i % 2:
                    put(ride(0.5, 0.5) * 0.75, t0 + (i + SWING) * beat, 0.68)
            for hit in (1, 3):
                put(brush_tap() * 0.09, t0 + hit * beat, 0.55)
            put(brush_swish(bar) * 0.05, t0, 0.4)
            for h in hits[k]:
                for j, x in enumerate(comp[k]):
                    put(piano(midi(x), beat * 0.8, 0.65) * 0.22, t0 + h * beat + j * 0.006, 0.35 + 0.05 * j)
            if b % 2 == 1:  # a short right-hand answer every other bar
                for i, x in enumerate(line[k]):
                    if x is not None:
                        put(piano(midi(x), beat * 0.9, 0.85) * 0.24, t0 + (i * 0.5 + (SWING - 0.5 if i % 2 else 0)) * beat + beat * 2, 0.6)
        elif style == "bossa":
            put(karplus(midi(walk[k][0] + 12), beat * 1.8, 0.25) * 0.28, t0, 0.45)
            put(karplus(midi(walk[k][1] + 12), beat * 1.8, 0.25) * 0.28, t0 + 2 * beat, 0.45)
            for e8 in (1, 3, 4, 6):
                for j, x in enumerate(comp[k]):
                    put(karplus(midi(x), beat * 0.9, 0.3) * 0.075, t0 + e8 * beat / 2 + j * 0.005, 0.35 + 0.06 * j)
            for e8 in (0, 3, 6):
                put(rim() * 0.12, t0 + e8 * beat / 2, 0.6)
            for i in range(16):
                put(shaker() * (0.05 if i % 4 == 2 else 0.03), t0 + i * beat / 4, 0.7)
            for j, x in enumerate(comp[k]):
                put(epiano(midi(x + 12), bar * 0.95) * 0.06, t0 + j * 0.01, 0.55)
            put(sine_bass(midi(walk[k][0]), beat * 1.4) * 0.16, t0)
            put(sine_bass(midi(walk[k][1]), beat * 1.4) * 0.14, t0 + 2 * beat)
        else:
            for i, x in enumerate(walk[k]):
                put(upright(midi(x), beat * 1.9) * 0.5, t0 + i * 2 * beat, 0.45)
            for j, x in enumerate(comp[k]):
                put(epiano(midi(x), bar * 1.0) * 0.12, t0 + j * 0.02, 0.4 + 0.05 * j)
            put(brush_swish(bar) * 0.10, t0, 0.35)
            for i in range(4):
                put(ride(1.0, 0.6) * 0.30, t0 + i * beat, 0.7)
                put(ride(0.4, 0.35) * 0.30, t0 + (i + SWING) * beat, 0.7)
                if i % 2:
                    put(brush_tap() * 0.07, t0 + i * beat, 0.5)
            for at_, x, d in melody[k]:
                put(trumpet(midi(x), d * beat) * 0.16, t0 + at_ * beat, 0.58)

    wet = 0.28 if style == "latenight" else 0.18
    L, R = reverb(L, 2.0, wet), reverb(R, 2.1, wet)
    L, R = highpass(L, 55), highpass(R, 55)
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
