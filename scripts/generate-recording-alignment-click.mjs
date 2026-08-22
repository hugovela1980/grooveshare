import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULTS = {
  bpm: 120,
  numerator: 4,
  denominator: 4,
  bars: 8,
  sampleRate: 48000,
};

function readNumberFlag(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));

  if (!arg) return fallback;

  const value = Number(arg.slice(prefix.length));
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a finite number.`);
  }

  return value;
}

function readStringFlag(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function validatePositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
}

function writeAscii(buffer, offset, text) {
  buffer.write(text, offset, "ascii");
}

function createWav({ bpm, numerator, denominator, bars, sampleRate }) {
  if (!(bpm > 0)) throw new Error("--bpm must be greater than 0.");
  validatePositiveInteger("numerator", numerator);
  validatePositiveInteger("denominator", denominator);
  validatePositiveInteger("bars", bars);
  validatePositiveInteger("sampleRate", sampleRate);

  const secondsPerQuarter = 60 / bpm;
  const secondsPerGridBeat = secondsPerQuarter * (4 / denominator);
  const beatCount = numerator * bars;
  const durationSeconds = beatCount * secondsPerGridBeat;
  const sampleCount = Math.ceil(durationSeconds * sampleRate);
  const samples = new Float64Array(sampleCount);
  const clickLengthSamples = Math.max(1, Math.round(sampleRate * 0.012));

  for (let beatIndex = 0; beatIndex < beatCount; beatIndex += 1) {
    const beatInBar = beatIndex % numerator;
    const onsetSeconds = beatIndex * secondsPerGridBeat;
    const onsetSample = Math.round(onsetSeconds * sampleRate);
    const frequency = beatInBar === 0 ? 1760 : 880;
    const amplitude = beatInBar === 0 ? 0.95 : 0.65;

    for (let i = 0; i < clickLengthSamples; i += 1) {
      const sampleIndex = onsetSample + i;
      if (sampleIndex >= sampleCount) break;

      const time = i / sampleRate;
      const envelope = Math.exp(-time * 260);
      const value = Math.sin(2 * Math.PI * frequency * time) * envelope * amplitude;
      samples[sampleIndex] = Math.max(-1, Math.min(1, samples[sampleIndex] + value));
    }
  }

  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const wav = Buffer.alloc(44 + dataSize);
  writeAscii(wav, 0, "RIFF");
  wav.writeUInt32LE(36 + dataSize, 4);
  writeAscii(wav, 8, "WAVE");
  writeAscii(wav, 12, "fmt ");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * bytesPerSample, 28);
  wav.writeUInt16LE(bytesPerSample, 32);
  wav.writeUInt16LE(16, 34);
  writeAscii(wav, 36, "data");
  wav.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    const int16 = sample < 0
      ? Math.round(sample * 32768)
      : Math.round(sample * 32767);
    wav.writeInt16LE(int16, 44 + i * bytesPerSample);
  }

  return {
    wav,
    secondsPerGridBeat,
    durationSeconds,
  };
}

const bpm = readNumberFlag("bpm", DEFAULTS.bpm);
const numerator = readNumberFlag("numerator", DEFAULTS.numerator);
const denominator = readNumberFlag("denominator", DEFAULTS.denominator);
const bars = readNumberFlag("bars", DEFAULTS.bars);
const sampleRate = readNumberFlag("sampleRate", DEFAULTS.sampleRate);
const defaultFilename = `alignment-click-${bpm}bpm-${numerator}-${denominator}-${bars}bars.wav`;
const output = resolve(
  readStringFlag("output") ?? `sandbox/recording-alignment/${defaultFilename}`,
);

const result = createWav({
  bpm,
  numerator,
  denominator,
  bars,
  sampleRate,
});
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, result.wav);

console.log("Generated recording-alignment click reference:");
console.log(`  file: ${output}`);
console.log(`  BPM: ${bpm} quarter-note BPM`);
console.log(`  time signature: ${numerator}/${denominator}`);
console.log(`  bars: ${bars}`);
console.log(`  grid-beat duration: ${(result.secondsPerGridBeat * 1000).toFixed(3)} ms`);
console.log(`  total duration: ${result.durationSeconds.toFixed(3)} s`);
console.log("  Bar 1 / Beat 1 transient begins at WAV sample 0.");
