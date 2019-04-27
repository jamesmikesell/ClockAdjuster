import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SignalProcessingService {

  constructor() { }

  getFirstPeakStartIndex(sample: Float32Array, avg: number, dbCutoff: number): number {
    let bufferLength = sample.length;

    let deviation: number;
    let startOfPeak: number;
    let snrDb: number;
    for (let i = 0; i < bufferLength && !startOfPeak; i++) {
      deviation = Math.abs(sample[i] - avg);
      snrDb = 10 * Math.log10(deviation / avg);
      if (snrDb > dbCutoff) {
        return i;
      }
    }

    return undefined;
  }

  getMaxPeakIndex(sample: Float32Array): number {
    let bufferLength = sample.length;

    let value: number;
    let maxValue = Number.MIN_VALUE;
    let minValue = Number.MAX_VALUE;
    let maxIndex: number;
    for (let i = 0; i < bufferLength; i++) {
      value = Math.abs(sample[i]);
      if (value < minValue)
        minValue = value;

      if (value > maxValue) {
        maxIndex = i;
        maxValue = value;
      }
    }

    if (maxValue === minValue)
      return undefined;

    return maxIndex;
  }

}
