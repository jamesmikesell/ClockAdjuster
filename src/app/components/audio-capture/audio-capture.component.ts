import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { timer, Subscription } from 'rxjs';
import { ChartOptions } from 'chart.js';
import { AudioCaptureService } from '../../service/audio-capture.service';
import { environment } from '../../../environments/environment';
import { NoSleepService } from '../../service/no-sleep.service';
import { PeakTimeService, PeakDetectionMethod } from '../../service/peak-time.service';
import { TimeService } from '../../service/time.service';

@Component({
  selector: 'app-audio-capture',
  templateUrl: './audio-capture.component.html',
  styleUrls: ['./audio-capture.component.css']
})
export class AudioCaptureComponent implements OnInit, OnDestroy {

  lineData: number[] = [];
  labelData: string[] = [];
  chartOptions: ChartOptions;
  runningTime: string;
  PeakDetectionMethod = PeakDetectionMethod;
  targetBph: number;
  targetDelta: string;

  private periodicUpdate: Subscription;
  private _bph = 3600;
  private readonly scrollMax = 1000000;
  private scrollValue: number = this.scrollMax;
  private _beatAdjuster = 0;
  private beatAdjustmentStartBpm: number;
  private beatAdjustmentUpdateDelayTimer: Subscription;
  private _chartScrollerDown = false;
  private _beatAdjusterDown = false;

  constructor(public audioCaptureService: AudioCaptureService,
    public noSleep: NoSleepService,
    public timeService: TimeService,
    public peakTimeService: PeakTimeService) { }

  ngOnInit(): void {
    this.peakTimeService.maxFramesToDisplay = this.getMaxFramesToDisplay();
    this.peakTimeService.frameTimeSpanMs = this.getFrameTimeSpanMs();
    this.peakTimeService.scrollPercentChange.subscribe(() => this.tryUpdateScrollerPosition());
  }

  ngOnDestroy(): void {
    if (this.periodicUpdate && !this.periodicUpdate.closed)
      this.periodicUpdate.unsubscribe();

    this.audioCaptureService.stop();
  }


  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: any): void {
    this._beatAdjusterDown = false;
    this._chartScrollerDown = false;

    timer(100).toPromise().then(() => {
      this.tryResetBeatAdjuster();
      this.tryUpdateScrollerPosition();
    });
  }

  @HostListener('window:resize', ['$event'])
  windowResize(): void {
    this.peakTimeService.maxFramesToDisplay = this.getMaxFramesToDisplay();
    this.displayTicks();
  }


  getVersion(): string {
    return environment.version;
  }

  getNetworkTimeStatus(): string {
    if (!this.useNetworkTime) {
      return "";
    } else {
      if (this.timeService.estimatedDriftErrorSecondsPerDay) {
        return "[Enabled]";
      } else {
        return "[Pending]";
      }
    }

  }

  get useNetworkTime(): boolean {
    return this.peakTimeService.useNetworkTime;
  }
  set useNetworkTime(value: boolean) {
    this.peakTimeService.useNetworkTime = value;
    this.timeService.setEnabled(value);
    this.resetChart();
  }

  get beatAdjuster(): number {
    return this._beatAdjuster;
  }
  set beatAdjuster(value: number) {
    if (this.targetBph === undefined)
      this.targetBph = this._bph;
    if (this.beatAdjustmentStartBpm === undefined)
      this.beatAdjustmentStartBpm = this._bph;

    this._beatAdjuster = value;
    let beatAdjusterMax = 1000001;
    let adjustmentProportion = 1 - (Math.log(beatAdjusterMax - Math.abs(value)) / Math.log(beatAdjusterMax));
    if (value < 0)
      adjustmentProportion = adjustmentProportion * -1;

    let newBph = (this.beatAdjustmentStartBpm * adjustmentProportion / 400) + this.beatAdjustmentStartBpm;
    this._bph = Math.round(newBph * 10000) / 10000;


    let secondsDelta = ((this._bph / this.targetBph) - 1) * 24 * 60 * 60;
    secondsDelta = Math.round(secondsDelta * 100) / 100;
    let fastSlow = "";
    if (secondsDelta >= 0)
      fastSlow = " fast";
    else if (secondsDelta < 0)
      fastSlow = " slow";
    this.targetDelta = `${fastSlow} by ${Math.abs(secondsDelta)} seconds / day.`;

    //Using a timer to the amounts of UI updates as the slider slides
    if (!this.beatAdjustmentUpdateDelayTimer || this.beatAdjustmentUpdateDelayTimer.closed)
      this.beatAdjustmentUpdateDelayTimer = timer(100).subscribe(() => this.resetChart());
  }

  beatAdjusterDown(): void {
    this._beatAdjusterDown = true;
  }

  get bph(): number {
    return this._bph;
  }
  set bph(bph: number) {
    if (!bph || bph < 0)
      return;

    this.targetBph = undefined;
    this._bph = bph;
    this.resetChart();
  }


  private tryResetBeatAdjuster(): void {
    if (!this._beatAdjusterDown) {
      this._beatAdjuster = 0;
      this.beatAdjustmentStartBpm = undefined;
    }
  }

  private startUpdateTimer(): void {
    this.periodicUpdate = timer(1000, 100).subscribe(() => {
      this.findAndDisplayTicks();
    });
  }

  private updateRunTime(): void {
    if (!this.periodicUpdate.closed) {
      let msUntilNextUpdate: number;
      let firstTickTime = this.peakTimeService.getFirstTickTime();
      if (firstTickTime) {
        let elapsedMs = Math.round(performance.now() - firstTickTime);

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
    this.findAndDisplayTicks();
  }

  reset(): void {
    this.audioCaptureService.sampleQueue.clear();
    this.labelData = [];
    this.lineData = [];
    this.peakTimeService.clear();
    this.runningTime = undefined;
    this.configureChart();
  }

  private resetChart(): void {
    this.configureChart();
    this.peakTimeService.frameTimeSpanMs = this.getFrameTimeSpanMs();
    this.displayTicks();
  }

  private getFrameTimeSpanMs(): number {
    let bpm = this._bph / 60;
    let bps = bpm / 60;
    let periodSeconds = 1 / bps;
    return periodSeconds * 1000;
  }

  private configureChart(): void {
    let chartYMax = this.getFrameTimeSpanMs();

    this.chartOptions = {
      responsive: true,
      legend: {
        display: false
      },
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

  private findAndDisplayTicks(): void {
    this.peakTimeService.findTickTimes();
    this.displayTicks();
  }

  private getMaxFramesToDisplay(): number {
    let chartMargins = 50;
    let maxPointsPerPixel = 150 / 1000;
    return Math.round((window.innerWidth - chartMargins) * maxPointsPerPixel);
  }

  get scroll(): number { return this.scrollValue; }
  set scroll(value: number) {
    this.scrollValue = value;
    this.peakTimeService.scrollPercent = this.scrollValue / this.scrollMax;

    this.displayTicks();
  }

  chartScrollerDown(): void {
    this._chartScrollerDown = true;
  }

  private tryUpdateScrollerPosition(): void {
    if (!this._chartScrollerDown)
      this.scrollValue = this.peakTimeService.scrollPercent * this.scrollMax;
  }

  private displayTicks(): void {
    let frames = this.peakTimeService.getFramesToDisplay();
    if (frames)
      this.syncFramesWithGraph(frames.frames, frames.startTime, frames.firstFrameTime);
  }

  private syncFramesWithGraph(frames: number[], windowStartTime: number, firstFrameTime: number): void {
    // Most recent graph data doesn't equal it's counter part in frame data (likely change in BPH);
    // clear and start over
    let maxFrames = this.getMaxFramesToDisplay();
    if (this.lineData.length !== maxFrames)
      this.lineData.length = maxFrames;
    if (this.labelData.length !== maxFrames)
      this.labelData.length = maxFrames;

    // We're syncing arrays as just resetting the array each time has performance implications when the graph re-renders
    for (let i = 0; i < maxFrames; i++) {
      if (i >= frames.length) {
        this.labelData[i] = "";
        this.lineData[i] = undefined;
      } else {
        let seconds = (Math.round((windowStartTime - firstFrameTime + (this.getFrameTimeSpanMs() * i)) / 10) / 100).toString();

        if (this.labelData[i] !== seconds)
          this.labelData[i] = seconds;
        if (this.lineData[i] !== frames[i])
          this.lineData[i] = frames[i];
      }
    }
  }

}
