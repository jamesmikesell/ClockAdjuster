import { Injectable } from '@angular/core';
import { SignalProcessingService } from './signal-processing.service';
import { AudioCaptureService } from './audio-capture.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PeakTimeService {
  peakDetectionMethod = PeakDetectionMethod.maxPeak;
  frameTimeSpanMs = 1000;
  maxFramesToDisplay = 100;
  dbCutoff = 7;
  scrollPercentChange = new Subject<number>();

  private tickTimes: number[] = [];
  private scrolledToStartFrame: number;
  private _scrollPercent = 1;


  constructor(private signalProcessingService: SignalProcessingService,
    private audioCaptureService: AudioCaptureService) { }


  get scrollPercent(): number {
    return this._scrollPercent;
  }

  set scrollPercent(value: number) {
    this._scrollPercent = value;
    this.scrolledToStartFrame = undefined;
  }


  getFirstTickTime(): number {
    if (this.tickTimes.length)
      return this.tickTimes[this.tickTimes.length - 1];
    return undefined;
  }

  clear(): void {
    this.tickTimes = [];
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
        let firstPeakStartTime = dataEndTime - ((samples.length - firstPeakIndex) / sampleRateMs);
        this.tickTimes.push(firstPeakStartTime);
      } else {
        return;
      }
    }


    let firstPeakStartTime = this.tickTimes[0];
    let lineDataEndTime = this.tickTimes[this.tickTimes.length - 1];
    let dataStartTime = dataEndTime - (samples.length / sampleRateMs);
    let minStart = Math.max(lineDataEndTime, dataStartTime);
    let startingFrameIndex = Math.floor((minStart - firstPeakStartTime) / this.frameTimeSpanMs);
    //Find peak in each frame
    while (true) {
      startingFrameIndex++;
      let frameStartTime = startingFrameIndex * this.frameTimeSpanMs + firstPeakStartTime;

      let frameEndTime = frameStartTime + this.frameTimeSpanMs;
      if (frameEndTime > dataEndTime)
        break;

      let sampleStartIndex = Math.round(samples.length - ((dataEndTime - frameStartTime) * sampleRateMs));
      let sampleEndIndex = Math.round(sampleStartIndex + (this.frameTimeSpanMs * sampleRateMs));

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
    }
  }


  getFramesToDisplay(): FramesToDisplay {
    if (this.tickTimes.length <= 0)
      return undefined;

    let maxFramesToDisplay = this.maxFramesToDisplay;

    let frameTimeSpan = this.frameTimeSpanMs;
    let firstTickTime = this.tickTimes[0];
    let lastTickTime = this.tickTimes[this.tickTimes.length - 1];
    let tickTimeSpan = lastTickTime - firstTickTime;
    let framesInTimeSpan = Math.floor(tickTimeSpan / frameTimeSpan);

    let windowStartFrameIndex: number;
    let windowStartTime: number;
    let windowEndTime: number;
    if (framesInTimeSpan <= maxFramesToDisplay) {
      windowStartTime = firstTickTime;
      windowEndTime = lastTickTime;
      windowStartFrameIndex = 0;
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
        this.scrollPercentChange.next(firstFrameIndex / (framesInTimeSpan - maxFramesToDisplay));
      }

      let lastFrameIndex = firstFrameIndex + maxFramesToDisplay;

      windowStartTime = (firstFrameIndex * frameTimeSpan) + firstTickTime;
      windowEndTime = (lastFrameIndex * frameTimeSpan) + firstTickTime;
      windowStartFrameIndex = firstFrameIndex;
    }

    let framesToDisplay = this.splitTickTimesIntoFrames(windowStartTime, windowEndTime, windowStartFrameIndex);

    return new FramesToDisplay(framesToDisplay, windowStartTime - firstTickTime);
  }


  private splitTickTimesIntoFrames(startTime: number, endTime: number, startingFrameIndex: number): number[] {
    if (this.tickTimes.length) {
      let frameTimeSpan = this.frameTimeSpanMs;
      let firstTickTime = this.tickTimes[0];

      let timeSpan = endTime - startTime;
      let frameCount = Math.floor(timeSpan / frameTimeSpan) + 1;

      let frames = new Array<number>(frameCount);
      for (let i = 0; i < frames.length; i++)
        frames[i] = undefined;

      for (let i = 0; i < this.tickTimes.length; i++) {
        const tickTime = this.tickTimes[i];
        if (tickTime >= startTime && tickTime <= endTime) {
          let tickTimeSinceFirstTick = tickTime - firstTickTime;
          let frameIndex = Math.round(tickTimeSinceFirstTick / frameTimeSpan) - startingFrameIndex;

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
    public startTime: number) { }

}
