import { logger } from '../utils/logger.js';

export class AudioBufferManager {
  private chunks: Buffer[] = [];
  private totalSize: number = 0;
  private maxBufferSize: number = 10 * 1024 * 1024; // 10MB max

  addChunk(chunk: Buffer): void {
    if (this.totalSize + chunk.length > this.maxBufferSize) {
      logger.warn({ totalSize: this.totalSize }, 'Audio buffer size limit reached, clearing old data');
      this.clear();
    }
    this.chunks.push(chunk);
    this.totalSize += chunk.length;
  }

  getBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  getBase64(): string {
    return this.getBuffer().toString('base64');
  }

  clear(): void {
    this.chunks = [];
    this.totalSize = 0;
  }

  get size(): number {
    return this.totalSize;
  }

  get chunkCount(): number {
    return this.chunks.length;
  }
}
