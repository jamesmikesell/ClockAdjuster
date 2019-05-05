import { Injectable } from '@angular/core';
import { SignalProcessingService } from './signal-processing.service';
import { AudioCaptureService } from './audio-capture.service';
import { timer, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PeakCaptureService {
  peakDetectionMethod = PeakDetectionMethod.maxPeak;
  frameTimeSpanMs = 1000;
  dbCutoff = 7;
  tickTimes: number[] = [];
  dataEndTime: number;

  private updateTimerSubscription: Subscription;

  constructor(
    private signalProcessingService: SignalProcessingService,
    private audioCaptureService: AudioCaptureService) { }


  startTimer(): void {
    if (!this.updateTimerSubscription)
      this.updateTimerSubscription = timer(0, 500)
        .subscribe(() => this.findTickTimes());
  }

  getFirstTickTime(): number {
    if (this.tickTimes.length)
      return this.tickTimes[0];
    return undefined;
  }

  clear(): void {
    this.tickTimes = [];
  }

  findTickTimes(): void {
    let sampleRateSeconds = this.audioCaptureService.getSampleRate();
    let sampleRateMs = sampleRateSeconds / 1000;
    let timeAndSamples = this.audioCaptureService.sampleQueue.getData();
    let dataEndTime = timeAndSamples[0];
    let samples = timeAndSamples[1];

    if (samples.length < sampleRateSeconds * 1.5)
      return;

    this.dataEndTime = dataEndTime;

    let sampleStartIndex = 0;
    if (this.tickTimes.length) {
      sampleStartIndex = Math.round(samples.length - 1 - ((dataEndTime - this.tickTimes[this.tickTimes.length - 1]) * sampleRateMs));
      sampleStartIndex = Math.min(Math.abs(sampleStartIndex), 0);
    }

    let averageRms = this.audioCaptureService.sampleQueue.getRms();
    let sampleCount = samples.length;
    const msToJump = this.frameTimeSpanMs / 10;
    let sampleSet = new Set<number>();
    for (let i = sampleStartIndex; i < sampleCount; i++) {
      let sampleEndIndex = i + Math.round(this.frameTimeSpanMs * sampleRateMs);
      if (sampleEndIndex > sampleCount)
        break;

      let slice = samples.slice(i, sampleEndIndex);

      let peakIndex: number;
      if (this.peakDetectionMethod === PeakDetectionMethod.firstPeak)
        peakIndex = this.signalProcessingService.getFirstPeakStartIndex(slice, averageRms, this.dbCutoff);
      else
        peakIndex = this.signalProcessingService.getMaxPeakIndex(slice);

      if (peakIndex !== undefined) {
        peakIndex += i;
        sampleSet.add(dataEndTime - ((samples.length - peakIndex - 1) / sampleRateMs));
        i = Math.round(sampleRateMs * msToJump) + peakIndex;
      } else {
        i += Math.round(this.frameTimeSpanMs * sampleRateMs);
      }
    }

    if (sampleSet.size) {
      let sampleList = Array.from(sampleSet.values());
      sampleList.sort((a, b) => a - b);

      let lastKnownTime = this.tickTimes.length ? this.tickTimes[this.tickTimes.length - 1] : 0;
      let dataStartTime = dataEndTime - ((samples.length - 1) / sampleRateMs);

      //Ignore the first tick time if it's at the very beginning of the sample 
      // window (could be the trailing edge of an already known tick time)
      //
      // Also, because averageRms varies each time we try to find ticks, we may get slightly different start times for what
      // are actually the same tick, so we need to ensure we add msToJump even if we're starting at the last known tick time
      let minSampleTime = Math.max(dataStartTime, lastKnownTime) + msToJump;

      let count = sampleList.length;
      for (let i = 0; i < count; i++) {
        const singleTime = sampleList[i];
        if (singleTime > minSampleTime)
          this.tickTimes.push(singleTime);
      }
    }
  }
}


export enum PeakDetectionMethod {
  firstPeak,
  maxPeak
}
