"""Voice-over for the factory short: OpenAI TTS -> voice.wav, then whisper-1 word timings -> words.json.
Usage: python make_voice.py [voice] [speed]   (API key is injected by the environment's network secret)"""
import json, os, re, sys, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "SCRIPT.md")
VOICE = sys.argv[1] if len(sys.argv) > 1 else "onyx"
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 1.3  # natural TTS pace runs ~95 s for this script
HDR = {"Authorization": "Bearer sk-injected-by-proxy"}

INSTRUCTIONS = ("Narrator of a 60-second vertical animated short. One steady, warm, dry tone throughout: clear, "
                "confident, slightly deadpan, never salesy. Brisk pace, about 230 words per minute, with momentum. "
                "Keep pauses between sentences very short; only a small beat before 'Unluckily' and before the "
                "last line.")
# spellings that steer pronunciation only; the script text stays as written
SAY = {"Tymshare": "Time-share", "READMEs": "read-mees", "env file": "dot-env file", "CI bot's": "C-I bot's"}


def vo_text():
    t = open(SCRIPT, encoding="utf-8").read()
    vo = t.split("## Voice-over")[1].split("## Claim")[0].split("\n", 1)[1]
    vo = re.sub(r"\*\*[A-Z]+\*\*", "\n", vo)
    paras = [" ".join(p.split()) for p in re.split(r"\n\s*\n", vo) if p.strip()]
    return " ".join(paras)  # paragraph breaks make the model pause ~1 s


def post(url, data, headers, files=None):
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def main():
    text = vo_text()
    for a, b in SAY.items():
        text = text.replace(a, b)
    open(os.path.join(HERE, "tts_input.txt"), "w").write(text)
    body = json.dumps({"model": "gpt-4o-mini-tts", "voice": VOICE, "input": text,
                       "instructions": INSTRUCTIONS, "response_format": "wav", "speed": SPEED}).encode()
    raw = os.path.join(HERE, "voice_raw.wav")
    open(raw, "wb").write(post("https://api.openai.com/v1/audio/speech", body,
                               {**HDR, "Content-Type": "application/json"}))
    out = os.path.join(HERE, "voice.wav")  # 48 kHz mono for the mix
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-ar", "48000", "-ac", "1", out], check=True)

    # word timings (multipart by hand to avoid extra deps)
    b = "----voiceboundary"
    parts = []
    for k, v in (("model", "whisper-1"), ("response_format", "verbose_json"), ("timestamp_granularities[]", "word")):
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="voice.wav"\r\n'
                 f'Content-Type: audio/wav\r\n\r\n'.encode() + open(out, "rb").read() + b"\r\n")
    parts.append(f"--{b}--\r\n".encode())
    res = json.loads(post("https://api.openai.com/v1/audio/transcriptions", b"".join(parts),
                          {**HDR, "Content-Type": f"multipart/form-data; boundary={b}"}))
    words = [{"word": w["word"], "start": round(w["start"], 3), "end": round(w["end"], 3)} for w in res["words"]]
    json.dump({"duration": res.get("duration"), "voice": VOICE, "words": words},
              open(os.path.join(HERE, "words.json"), "w"), indent=1)
    print(f"voice={VOICE} duration={res.get('duration'):.2f}s words={len(words)} (script words: {len(vo_text().split())})")


if __name__ == "__main__":
    main()
