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
  private dataEndTime: number;

  constructor(
    private signalProcessingService: SignalProcessingService,
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
