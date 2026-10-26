"""Background beds for the tutorial, synthesized from scratch (no samples, no licences).

    python3 music/synth.py <style> <seconds> <out.wav>

Styles: calm (ambient pads + soft arpeggio), lofi (electric piano, dusty drums),
upbeat (plucks, four-on-the-floor, pulsing bass). Every bar repeats the same
four-chord loop, so any length works and the end fades out.
"""
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter

SR = 44100
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.01, d=0.2, s=0.6, r=0.3, length=None):
    """ADSR over n samples."""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.full(n, float(s))
    e[:a] = np.linspace(0, 1, a) if a else 1
    e[a:a + d] = np.linspace(1, s, len(e[a:a + d]))
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "low")
    return lfilter(b, a, x)


def highpass(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "high")
    return lfilter(b, a, x)


def reverb(x, seconds=2.2, wet=0.25):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = lowpass(ir, 5000)
    ir /= np.abs(ir).sum() ** 0.5 * 30
    return x * (1 - wet) + fftconvolve(x, ir)[: len(x)] * wet * 6


def saw(f, t, voices=3, detune=0.12):
    out = np.zeros_like(t)
    for k in range(voices):
        fk = f * 2 ** ((k - (voices - 1) / 2) * detune / 12)
        ph = (t * fk + rng.random()) % 1
        out += 2 * ph - 1
    return out / voices


def place(buf, sig, start):
    i = int(start * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i]


# I–vi–IV–V flavoured loop in C, voiced as 7ths/9ths.
CHORDS = [
    [48, 55, 59, 62, 64],  # Cmaj9
    [45, 52, 55, 59, 60],  # Am9
    [41, 48, 52, 55, 57],  # Fmaj9
    [43, 50, 53, 57, 59],  # G9sus-ish
]


def kick(dur=0.35, f0=110, f1=42):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare(dur=0.25, tone=0.3):
    t = np.arange(int(dur * SR)) / SR
    n = highpass(rng.standard_normal(len(t)), 1500) * np.exp(-t * 18)
    b = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return n * (1 - tone) + b * tone


def hat(dur=0.06, open_=False):
    t = np.arange(int((0.25 if open_ else dur) * SR)) / SR
    return highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * (14 if open_ else 70))


def clap():
    t = np.arange(int(0.3 * SR)) / SR
    n = lowpass(highpass(rng.standard_normal(len(t)), 900), 4000)
    e = np.zeros_like(t)
    for off in (0, 0.011, 0.023):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: len(t) - i]) * 30)
    return n * e * 0.6


def epiano(f, dur):
    """Two-operator FM, a Rhodes-ish bell that softens as it decays."""
    t = np.arange(int(dur * SR)) / SR
    idx = 1.8 * np.exp(-t * 3)
    mod = np.sin(2 * np.pi * f * t) * idx
    car = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.6)
    tine = np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 12) * 0.15
    return (car + tine) * env(len(t), 0.003, 0.1, 1, 0.08)


def pluck(f, dur=0.5, bright=3500):
    t = np.arange(int(dur * SR)) / SR
    s = saw(f, t, 2, 0.08) * np.exp(-t * 7)
    return lowpass(s, bright)


def pad(notes, dur, cutoff=1800):
    t = np.arange(int(dur * SR)) / SR
    s = sum(saw(midi(n), t, 3, 0.15) for n in notes) / len(notes)
    s = lowpass(s, cutoff, 2)
    return s * env(len(t), 0.6, 0.4, 0.85, 0.7)


def render(style, seconds):
    if style == "calm":
        bpm = 84
    elif style == "lofi":
        bpm = 78
    else:
        bpm = 112
    beat = 60 / bpm
    bar = beat * 4
    n = int(seconds * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    bars = int(np.ceil(seconds / bar)) + 1
    for b in range(bars):
        t0 = b * bar
        ch = CHORDS[b % 4]
        if style == "calm":
            p = pad([x + 12 for x in ch[1:]], bar + 0.8, 2600) * 0.22
            place(L, p, t0); place(R, p * 0.95, t0 + 0.012)
            bass = np.sin(2 * np.pi * midi(ch[0]) * np.arange(int(bar * SR)) / SR) * env(int(bar * SR), 0.2, 0.3, 0.7, 0.4) * 0.10
            place(L, bass, t0); place(R, bass, t0)
            arp = [ch[1] + 24, ch[2] + 24, ch[3] + 24, ch[4] + 24, ch[3] + 24, ch[2] + 24, ch[1] + 24, ch[2] + 24]
            for i, a in enumerate(arp):
                s = pluck(midi(a), 0.7, 3800) * 0.30
                pan = 0.5 + 0.35 * np.sin(i)
                place(L, s * (1 - pan), t0 + i * beat / 2); place(R, s * pan, t0 + i * beat / 2)
            for i in range(8):
                h = hat(0.05) * 0.06
                place(L, h * 0.6, t0 + i * beat / 2 + beat / 4); place(R, h, t0 + i * beat / 2 + beat / 4)
        elif style == "lofi":
            sw = beat / 2 * 0.12  # swing
            for i, hit in enumerate([0, 1.5, 2.5]):
                place(L, kick(0.4, 95, 52) * 0.35, t0 + hit * beat); place(R, kick(0.4, 95, 52) * 0.35, t0 + hit * beat)
            for hit in (1, 3):
                s = lowpass(snare(0.3, 0.4), 5000) * 0.28
                place(L, s, t0 + hit * beat); place(R, s, t0 + hit * beat)
            for i in range(8):
                h = lowpass(hat(0.05), 9000) * (0.05 if i % 2 else 0.035)
                place(L, h, t0 + i * beat / 2 + (sw if i % 2 else 0)); place(R, h * 0.8, t0 + i * beat / 2 + (sw if i % 2 else 0))
            for k, note in enumerate(ch[1:]):
                e = epiano(midi(note + 12), bar * 0.9) * 0.2
                place(L, e, t0 + k * 0.018); place(R, e, t0 + k * 0.022)
            e2 = sum(epiano(midi(x + 24), beat * 1.2) for x in ch[2:]) * 0.09
            place(L, e2, t0 + beat * 2.5 + sw); place(R, e2, t0 + beat * 2.5 + sw)
            bt = np.arange(int(bar * 0.95 * SR)) / SR
            bass = lowpass(np.sin(2 * np.pi * midi(ch[0]) * bt) + 0.4 * np.sin(4 * np.pi * midi(ch[0]) * bt), 600) * env(len(bt), 0.02, 0.4, 0.6, 0.2) * 0.14
            place(L, bass, t0); place(R, bass, t0)
        else:  # upbeat
            for i in range(4):
                place(L, kick(0.3, 120, 55) * 0.33, t0 + i * beat); place(R, kick(0.3, 120, 55) * 0.33, t0 + i * beat)
            for hit in (1, 3):
                c = clap() * 0.35
                place(L, c, t0 + hit * beat); place(R, c, t0 + hit * beat + 0.008)
            for i in range(8):
                h = hat(0.04) * 0.06
                place(L, h, t0 + i * beat / 2 + beat / 4); place(R, h * 0.7, t0 + i * beat / 2 + beat / 4)
            for i in range(8):
                bt = np.arange(int(beat / 2 * 0.9 * SR)) / SR
                s = lowpass(saw(midi(ch[0]), bt, 2, 0.05), 900) * env(len(bt), 0.005, 0.1, 0.5, 0.05) * 0.12
                place(L, s, t0 + i * beat / 2); place(R, s, t0 + i * beat / 2)
            pattern = [0, 2, 3, 1, 4, 3, 2, 3, 1, 2, 4, 3, 2, 1, 3, 4]
            for i, k in enumerate(pattern):
                s = pluck(midi(ch[k] + 24), 0.3, 5500) * 0.2
                pan = 0.3 if i % 2 else 0.7
                place(L, s * (1 - pan), t0 + i * beat / 4); place(R, s * pan, t0 + i * beat / 4)
            p = pad([x + 12 for x in ch[1:]], bar, 2200) * 0.12
            place(L, p, t0); place(R, p, t0 + 0.01)
    L, R = reverb(L, 2.0, 0.22), reverb(R, 2.1, 0.22)
    L, R = highpass(L, 70), highpass(R, 70)
    if style == "lofi":
        crackle = (rng.random(n) > 0.9993) * rng.standard_normal(n) * 0.25 + lowpass(rng.standard_normal(n), 3000) * 0.006
        L += crackle; R += crackle
        L, R = lowpass(L, 7500), lowpass(R, 7500)
    st = np.stack([L, R], 1)
    fade = int(1.5 * SR)
    st[:int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))[:, None]
    st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    st = np.tanh(st * 1.1)
    st /= np.abs(st).max() / 0.85
    return st


if __name__ == "__main__":
    style, seconds, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    wavfile.write(out, SR, (render(style, seconds) * 32767).astype(np.int16))
    print(out)
