import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { TimeService } from './time.service';
import { PeakCaptureService } from './peak-capture.service';

@Injectable({
  providedIn: 'root'
})
export class PeakGroupingService {
  maxFramesToDisplay = 100;
  scrollPercentChange = new Subject<number>();

  private scrolledToStartFrame: number;
  private _useNetworkTime = false;
  private _scrollPercent = 1;

  constructor(
    private peakCaptureService: PeakCaptureService,
    private timeService: TimeService) { }


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



  getFramesToDisplay(): FramesToDisplay {
    if (this.peakCaptureService.tickTimes.length <= 0)
      return undefined;

    let maxFramesToDisplay = this.maxFramesToDisplay;
    let frameTimeSpan = this.peakCaptureService.frameTimeSpanMs;
    let firstTickTime = this.peakCaptureService.tickTimes[0];
    let tickTimeSpan = this.peakCaptureService.dataEndTime - firstTickTime;
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


  private splitTickTimesIntoFrames(startingFrameIndex: number, frameCount: number): number[][] {
    if (this.peakCaptureService.tickTimes.length) {
      let frameTimeSpan = this.peakCaptureService.frameTimeSpanMs;
      let firstTickTime = this.peakCaptureService.tickTimes[0];

      let frames = new Array<Array<number>>(frameCount);
      for (let i = 0; i < frames.length; i++)
        frames[i] = [];

      for (let i = 0; i < this.peakCaptureService.tickTimes.length; i++) {
        const tickTime = this.peakCaptureService.tickTimes[i];
        let tickTimeSinceFirstTick = tickTime - firstTickTime;
        if (this._useNetworkTime && this.timeService.driftRate)
          tickTimeSinceFirstTick = (this.timeService.driftRate * tickTimeSinceFirstTick) + tickTimeSinceFirstTick;

        let frameIndex = Math.round(tickTimeSinceFirstTick / frameTimeSpan) - startingFrameIndex;

        if (frameIndex >= 0 && frameIndex < frameCount) {
          let frameTime = (frameIndex + startingFrameIndex) * frameTimeSpan;
          frames[frameIndex].push(tickTimeSinceFirstTick - frameTime);
        }
      }

      return frames;
    } else {
      return undefined;
    }
  }


}


class FramesToDisplay {
  constructor(public frames: number[][],
    public startTime: number,
    public firstFrameTime: number) { }

}
