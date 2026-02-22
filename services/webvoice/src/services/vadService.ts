import { config } from '../config.js';

export class VADService {
  private lastSpeechTime: number = 0;
  private isSpeaking: boolean = false;

  constructor() {
    this.lastSpeechTime = Date.now();
  }

  processChunk(audioData: Buffer): { isSilent: boolean; shouldFinalize: boolean } {
    const energy = this.calculateEnergy(audioData);
    const now = Date.now();

    if (energy > config.vadEnergyThreshold) {
      this.isSpeaking = true;
      this.lastSpeechTime = now;
      return { isSilent: false, shouldFinalize: false };
    }

    const silenceDuration = now - this.lastSpeechTime;
    const shouldFinalize = this.isSpeaking && silenceDuration >= config.vadSilenceThresholdMs;

    if (shouldFinalize) {
      this.isSpeaking = false;
    }

    return { isSilent: true, shouldFinalize };
  }

  private calculateEnergy(audioData: Buffer): number {
    if (audioData.length < 2) return 0;

    let sum = 0;
    const samples = audioData.length / 2;
    for (let i = 0; i < audioData.length - 1; i += 2) {
      const sample = audioData.readInt16LE(i) / 32768;
      sum += sample * sample;
    }
    return Math.sqrt(sum / samples);
  }

  reset(): void {
    this.isSpeaking = false;
    this.lastSpeechTime = Date.now();
  }
}
