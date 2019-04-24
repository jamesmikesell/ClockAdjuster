import { Injectable } from '@angular/core';
import { SignalProcessingService } from './signal-processing.service';
import { AudioCaptureService } from './audio-capture.service';
import { Subject } from 'rxjs';
import { TimeService } from './time.service';

@Injectable({
  providedIn: 'root'
})
export class PeakTimeService {
  peakDetectionMethod = PeakDetectionMethod.maxPeak;
  frameTimeSpanMs = 1000;
  maxFramesToDisplay = 100;
  dbCutoff = 7;
  scrollPercentChange = new Subject<number>();
  tickTimes: number[] = [];
  
  private scrolledToStartFrame: number;
  private _useNetworkTime = false;
  private _scrollPercent = 1;
  private audioCaptureStartTime: number;
  private startingFrameIndex = 0;
  private dataEndTime: number;

  constructor(private signalProcessingService: SignalProcessingService,
    private timeService: TimeService,
    private audioCaptureService: AudioCaptureService) { }


  get useNetworkTime(): boolean {
    return this._useNetworkTime;
  }

  set useNetworkTime(value: boolean) {
    this._useNetworkTime = value;
  }

  get scrollPercent(): number {
    return this._scrollPercent;
  }

  set scrollPercent(value: number) {
    this._scrollPercent = value;
    this.scrolledToStartFrame = undefined;
  }


  getFirstTickTime(): number {
    if (this.tickTimes.length)
      return this.tickTimes[0];
    return undefined;
  }

  clear(): void {
    this.tickTimes = [];
    this.audioCaptureStartTime = undefined;
    this.startingFrameIndex = 0;
  }


  findTickTimes(): void {
    let sampleRateSeconds = this.audioCaptureService.getSampleRate();
    let sampleRateMs = sampleRateSeconds / 1000;
    let timeAndSamples = this.audioCaptureService.sampleQueue.getData();
    let averageRms = this.audioCaptureService.sampleQueue.getRms();
    let dataEndTime = timeAndSamples[0];
    let samples = timeAndSamples[1];

    if (samples.length < sampleRateSeconds * 1.5)
      return;

    if (!this.tickTimes.length) {
      let firstPeakIndex = this.signalProcessingService.getMaxPeakIndex(samples);
      if (firstPeakIndex !== undefined) {
        let firstPeakStartTime = dataEndTime - ((samples.length - firstPeakIndex - 1) / sampleRateMs);
        this.tickTimes.push(firstPeakStartTime);
        this.audioCaptureStartTime = dataEndTime - ((samples.length - 1) / sampleRateMs);
        this.startingFrameIndex = 1;
      } else {
        return;
      }
    }

    this.dataEndTime = dataEndTime;

    //Find peak in each frame
    while (true) {
      let frameStartTime = this.startingFrameIndex * this.frameTimeSpanMs + this.audioCaptureStartTime;
      let sampleStartIndex = Math.round(samples.length - 1 - ((dataEndTime - frameStartTime) * sampleRateMs));
      let sampleEndIndex = Math.round(sampleStartIndex + (this.frameTimeSpanMs * sampleRateMs));

      //Break if we're analyzing the last 200 ms of sample data (we don't want to analyze a peak that potentially isn't finished peaking)
      if (sampleEndIndex > samples.length - (200 * sampleRateMs))
        break;

      let frameSamples = samples.slice(sampleStartIndex, sampleEndIndex);
      let peakStartIndex;
      if (this.peakDetectionMethod === PeakDetectionMethod.maxPeak)
        peakStartIndex = this.signalProcessingService.getMaxPeakIndex(frameSamples);
      else {
        peakStartIndex = this.signalProcessingService.getFirstPeakStartIndex(frameSamples, averageRms, this.dbCutoff);
      }

      if (peakStartIndex !== undefined) {
        let peakMsIntoFrame = peakStartIndex / sampleRateMs;
        let peakTime = peakMsIntoFrame + frameStartTime;

        this.tickTimes.push(peakTime);
      }
      this.startingFrameIndex++;
    }
  }


  getFramesToDisplay(): FramesToDisplay {
    if (this.tickTimes.length <= 0)
      return undefined;

    let maxFramesToDisplay = this.maxFramesToDisplay;
    let frameTimeSpan = this.frameTimeSpanMs;
    let firstTickTime = this.tickTimes[0];
    let tickTimeSpan = this.dataEndTime - firstTickTime;
    let framesInTimeSpan = Math.round(tickTimeSpan / frameTimeSpan);
    let windowStartFrameIndex: number;
    let frameCount: number;

    if (framesInTimeSpan <= maxFramesToDisplay) {
      windowStartFrameIndex = 0;
      frameCount = framesInTimeSpan;
    } else {
      let scrollPercent = this._scrollPercent;
      let firstFrameIndex: number;
      if (this.scrolledToStartFrame !== undefined) {
        firstFrameIndex = this.scrolledToStartFrame;
      } else {
        firstFrameIndex = Math.round(scrollPercent * (framesInTimeSpan - maxFramesToDisplay));
      }

      if (scrollPercent !== 1) {
        this.scrolledToStartFrame = firstFrameIndex;
        // Move scroll bar so that it's location accurately reflects the displayed frame as time progresses / mores ticks get added
        this._scrollPercent = firstFrameIndex / (framesInTimeSpan - maxFramesToDisplay);
        this.scrollPercentChange.next(this._scrollPercent);
      }

      windowStartFrameIndex = firstFrameIndex;
      frameCount = maxFramesToDisplay;
    }

    let framesToDisplay = this.splitTickTimesIntoFrames(windowStartFrameIndex, frameCount);

    let firstFrameStartTime = firstTickTime - (frameTimeSpan / 2);
    let windowStartTime = (windowStartFrameIndex * frameTimeSpan) + firstFrameStartTime;
    return new FramesToDisplay(framesToDisplay, windowStartTime, firstFrameStartTime);
  }


  private splitTickTimesIntoFrames(startingFrameIndex: number, frameCount: number): number[] {
    if (this.tickTimes.length) {
      let frameTimeSpan = this.frameTimeSpanMs;
      let firstTickTime = this.tickTimes[0];

      let frames = new Array<number>(frameCount);
      for (let i = 0; i < frames.length; i++)
        frames[i] = undefined;

      for (let i = 0; i < this.tickTimes.length; i++) {
        const tickTime = this.tickTimes[i];
        let tickTimeSinceFirstTick = tickTime - firstTickTime;
        if (this._useNetworkTime && this.timeService.driftRate) 
          tickTimeSinceFirstTick = (this.timeService.driftRate * tickTimeSinceFirstTick) + tickTimeSinceFirstTick;

        let frameIndex = Math.round(tickTimeSinceFirstTick / frameTimeSpan) - startingFrameIndex;

        if (frameIndex >= 0 && frameIndex < frameCount) {
          let frameTime = (frameIndex + startingFrameIndex) * frameTimeSpan;
          frames[frameIndex] = tickTimeSinceFirstTick - frameTime;
        }
      }

      return frames;
    } else {
      return undefined;
    }
  }


}


export enum PeakDetectionMethod {
  firstPeak,
  maxPeak
}

class FramesToDisplay {
  constructor(public frames: number[],
    public startTime: number,
    public firstFrameTime: number) { }

}
