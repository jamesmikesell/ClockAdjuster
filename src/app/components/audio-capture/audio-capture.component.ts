import { Component, OnInit, OnDestroy } from '@angular/core';
import { timer, Subscription } from 'rxjs';
import { ChartOptions } from 'chart.js';
import { AudioCaptureService } from '../../service/audio-capture.service';
import { SignalProcessingService } from '../../service/signal-processing.service';

@Component({
  selector: 'app-audio-capture',
  templateUrl: './audio-capture.component.html',
  styleUrls: ['./audio-capture.component.css']
})
export class AudioCaptureComponent implements OnInit, OnDestroy {

  lineData: number[] = [];
  labelData: string[] = [];
  chartOptions: ChartOptions;
  showSpectrogram = false;
  runningTime: string;

  private periodicUpdate: Subscription;
  private firstPeakTimeMs: number;
  private bph = 3600;
  private tickTimes: number[] = [];
  private frames: number[] = [];
  private scrollValue: number = 1000000;


  constructor(public audioCaptureService: AudioCaptureService,
    private signalProcessingService: SignalProcessingService) { }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    if (this.periodicUpdate && !this.periodicUpdate.closed)
      this.periodicUpdate.unsubscribe();

    this.audioCaptureService.stop();
  }

  private getFrameTimeSpanMs(): number {
    let bpm = this.bph / 60;
    let bps = bpm / 60;
    let periodSeconds = 1 / bps;
    return periodSeconds * 1000;
  }

  private startUpdateTimer(): void {
    this.periodicUpdate = timer(1000, 100).subscribe(() => {
      this.fillLabelData();
    });
  }

  private updateRunTime(): void {
    if (!this.periodicUpdate.closed) {
      let msUntilNextUpdate: number;
      if (this.firstPeakTimeMs) {
        let elapsedMs = Math.round(performance.now() - this.firstPeakTimeMs);

        let hours = Math.floor(elapsedMs / 1000 / 60 / 60);
        let minutes = Math.floor((elapsedMs / 1000 / 60) % 60);
        let seconds = Math.round((elapsedMs / 1000) % 60);

        let minutesString = minutes < 10 ? `0${minutes}` : minutes;
        let secondsString = seconds < 10 ? `0${seconds}` : seconds;

        this.runningTime = `${hours}:${minutesString}:${secondsString}`;

        msUntilNextUpdate = 1000 - (elapsedMs % 1000);
      } else {
        msUntilNextUpdate = 1000;
      }

      setTimeout(() => {
        this.updateRunTime();
      }, msUntilNextUpdate);
    }
  }

  start(): void {
    this.audioCaptureService
      .start()
      .then(() => {
        this.audioCaptureService.sampleQueue.clear();
        this.startUpdateTimer();
        this.configureChart();
        this.updateRunTime();
      });
  }

  pause(): void {
    if (this.periodicUpdate && !this.periodicUpdate.closed)
      this.periodicUpdate.unsubscribe();

    // Do one last run just to catch up on anything in cache
    this.fillLabelData();
  }

  reset(): void {
    this.audioCaptureService.sampleQueue.clear();
    this.labelData = [];
    this.lineData = [];
    this.tickTimes = [];
    this.firstPeakTimeMs = 0;
    this.runningTime = undefined;
    this.configureChart();
  }

  getBph(): number {
    return this.bph;
  }

  setBph(bph: number): void {
    this.bph = bph;
    this.configureChart();
  }

  private configureChart(): void {
    let chartYMax = this.getFrameTimeSpanMs();

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      elements: {
        line: {
          tension: 0,
          fill: false,
          borderWidth: 0
        },
        point: {
          radius: 2
        }
      },
      animation: {
        duration: 0,
        // onComplete: () => { console.log("asdf"); }

      },
      hover: {
        animationDuration: 0
      },
      responsiveAnimationDuration: 0,
      showLines: false,
      scales: {
        yAxes: [{
          ticks: {
            max: chartYMax / 2,
            min: -chartYMax / 2
          }
        }]
      }
    };
  }

  private fillLabelData(): void {
    this.findTickTimes();

    if (!this.tickTimes.length)
      return;

    this.frames = this.splitTickTimesIntoFrames();

    this.updateDisplayedFrames();
  }


  private findTickTimes(): void {
    let sampleRateSeconds = this.audioCaptureService.getSampleRate();
    let sampleRateMs = sampleRateSeconds / 1000;
    let timeAndSamples = this.audioCaptureService.sampleQueue.getData();
    let dataEndTime = timeAndSamples[0];
    let samples = timeAndSamples[1];

    if (samples.length < sampleRateSeconds * 1.5)
      return;

    if (!this.tickTimes.length) {
      let firstPeakIndex = this.signalProcessingService.getMaxPeakIndex(samples);
      if (firstPeakIndex !== undefined) {
        let firstPeakStartTime = dataEndTime - ((samples.length - firstPeakIndex) / sampleRateMs);
        this.firstPeakTimeMs = firstPeakStartTime;
        this.tickTimes.push(firstPeakStartTime);
      } else {
        return;
      }
    }

    //Find peak in each frame
    while (true) {
      let lineDataEndTime = this.tickTimes[this.tickTimes.length - 1];
      let dataStartTime = dataEndTime - (samples.length / sampleRateMs);

      let minStart = Math.max(lineDataEndTime + (1 / sampleRateMs), dataStartTime);
      let frameStartTime = Math.ceil(minStart / this.getFrameTimeSpanMs()) * this.getFrameTimeSpanMs();
      let frameEndTime = frameStartTime + this.getFrameTimeSpanMs();
      if (frameEndTime > dataEndTime)
        break;

      let frameStartIndex = Math.round(samples.length - ((dataEndTime - frameStartTime) * sampleRateMs));
      let frameEndIndex = Math.round(frameStartIndex + (this.getFrameTimeSpanMs() * sampleRateMs));

      let frameSamples = samples.slice(frameStartIndex, frameEndIndex);
      let peakStartIndex = this.signalProcessingService.getMaxPeakIndex(frameSamples);

      let peakMsIntoFrame = peakStartIndex / sampleRateMs;
      let peakTime = peakMsIntoFrame + frameStartTime;
      this.tickTimes.push(peakTime);
    }
  }

  private splitTickTimesIntoFrames(): number[] {
    if (this.tickTimes.length) {
      let frameTimeSpan = this.getFrameTimeSpanMs();
      let firstTickTime = this.tickTimes[0];
      let lastTickTime = this.tickTimes[this.tickTimes.length - 1];

      let timeSpan = lastTickTime - firstTickTime;
      let frameCount = Math.floor(timeSpan / frameTimeSpan) + 1;

      let frames = new Array<number>(frameCount);
      for (let i = 0; i < frames.length; i++)
        frames[i] = undefined;

      for (let i = 0; i < this.tickTimes.length; i++) {
        const tickTime = this.tickTimes[i];
        let tickTimeSinceFirstTick = tickTime - firstTickTime;
        let frameIndex = Math.round(tickTimeSinceFirstTick / frameTimeSpan);

        let frameTime = frameIndex * frameTimeSpan;

        frames[frameIndex] = tickTimeSinceFirstTick - frameTime;
      }

      return frames;
    } else {
      return undefined;
    }
  }

  get scroll(): number { return this.scrollValue; }
  set scroll(value: number) {
    this.scrollValue = value;
    this.updateDisplayedFrames();
  }

  private updateDisplayedFrames(): void {
    let chartMargins = 50;
    let maxPointsPerPixel = 150 / 1000;
    let windowSize = (window.innerWidth - chartMargins) * maxPointsPerPixel;
    let scrollMax = 1000000;

    let indexStart: number;
    let indexEnd: number;
    if (this.frames.length > windowSize) {
      indexStart = Math.round((this.scrollValue / scrollMax) * (this.frames.length - windowSize));
      indexEnd = indexStart + windowSize - 1;
    } else {
      indexStart = 0;
      indexEnd = this.frames.length - 1;
    }

    let framesToDisplay = this.frames.slice(indexStart, indexEnd);

    this.syncFramesWithGraph(framesToDisplay, true, indexStart);
  }

  private syncFramesWithGraph(frames: number[], clear = false, windowStartIndex = 0): void {
    // Most recent graph data doesn't equal it's counter part in frame data (likely change in BPH);
    // clear and start over
    if (this.lineData.length > frames.length || clear) {
      this.lineData = [];
      this.labelData = [];
    }

    // We're syncing arrays as just resetting the array each time has performance implications when the graph re-renders
    for (let i = 0; i < frames.length; i++) {
      let seconds = Math.round((i + windowStartIndex) * this.getFrameTimeSpanMs() / 10) / 100;

      if (i < this.lineData.length) {
        this.labelData[i] = seconds.toString();
        this.lineData[i] = frames[i];
      } else {
        this.labelData.push(seconds.toString());
        this.lineData.push(frames[i]);
      }
    }
  }

}
