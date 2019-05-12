import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { timer, Subscription } from 'rxjs';
import { ChartOptions } from 'chart.js';
import { AudioCaptureService } from '../../service/audio-capture.service';
import { NoSleepService } from '../../service/no-sleep.service';
import { PeakCaptureService, PeakDetectionMethod } from '../../service/peak-capture.service';
import { TimeService } from '../../service/time.service';
import { PeakGroupingService } from '../../service/peak-grouping.service';
import { Color } from 'ng2-charts';

@Component({
  selector: 'app-audio-capture',
  templateUrl: './audio-capture.component.html',
  styleUrls: ['./audio-capture.component.css']
})
export class AudioCaptureComponent implements OnInit, OnDestroy {
  lineData: ScatterData[] = [];
  chartOptions: ChartOptions;
  runningTime: string;
  PeakDetectionMethod = PeakDetectionMethod;
  targetBph: number;
  targetDelta: string;
  chartColors: Color[] = [];

  private color: Color = { backgroundColor: "#3f51b5", borderColor: "#ffffff" };
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
    public peakGroupingService: PeakGroupingService,
    public peakCaptureService: PeakCaptureService) { }

  ngOnInit(): void {
    this.peakGroupingService.maxFramesToDisplay = this.getMaxFramesToDisplay();
    this.peakCaptureService.frameTimeSpanMs = this.getFrameTimeSpanMs();
    this.peakGroupingService.scrollPercentChange.subscribe(() => this.tryUpdateScrollerPosition());
  }

  ngOnDestroy(): void {
    if (this.periodicUpdate && !this.periodicUpdate.closed)
      this.periodicUpdate.unsubscribe();

    this.audioCaptureService.stop();
  }


  @HostListener('window:touchend', ['$event'])
  @HostListener('window:mouseup', ['$event'])
  onPointerUp(): void {
    this._beatAdjusterDown = false;
    this._chartScrollerDown = false;

    timer(100).toPromise().then(() => {
      this.tryResetBeatAdjuster();
      this.tryUpdateScrollerPosition();
    });
  }

  @HostListener('window:resize', ['$event'])
  windowResize(): void {
    this.peakGroupingService.maxFramesToDisplay = this.getMaxFramesToDisplay();
    this.displayTicks();
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
    return this.peakGroupingService.useNetworkTime;
  }
  set useNetworkTime(value: boolean) {
    this.peakGroupingService.useNetworkTime = value;
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
    this.periodicUpdate = timer(0, 500).subscribe(() => {
      this.findAndDisplayTicks();
    });
  }

  private updateRunTime(): void {
    if (!this.periodicUpdate.closed) {
      let msUntilNextUpdate: number;
      let firstTickTime = this.peakCaptureService.getFirstTickTime();
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

  private isPaused(): boolean {
    return !this.periodicUpdate || this.periodicUpdate.closed;
  }

  playPauseResumeText(): string {
    if (!this.peakCaptureService.isRunning())
      return "Start Capture";

    if (this.isPaused())
      return "Resume Displaying";

    return "Pause Displaying";
  }

  toggleCaptureUpdate(): void {
    if (!this.peakCaptureService.isRunning() || this.isPaused())
      this.start();
    else
      this.pause();
  }

  private start(): void {
    this.audioCaptureService
      .start()
      .then(() => {
        this.audioCaptureService.sampleQueue.clear();
        this.peakCaptureService.startTimer();
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
    this.lineData = [];
    this.peakCaptureService.clear();
    this.runningTime = undefined;
    this.configureChart();
  }

  private resetChart(): void {
    this.configureChart();
    this.peakCaptureService.frameTimeSpanMs = this.getFrameTimeSpanMs();
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
      scales: {
        yAxes: [{
          ticks: {
            max: chartYMax / 2,
            min: -chartYMax / 2
          }
        }],
        xAxes: [{
          ticks: {
            stepSize: chartYMax / 1000
          }
        }]
      }
    };
  }

  private findAndDisplayTicks(): void {
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
    this.peakGroupingService.scrollPercent = this.scrollValue / this.scrollMax;

    this.displayTicks();
  }

  chartScrollerDown(): void {
    this._chartScrollerDown = true;
  }

  private tryUpdateScrollerPosition(): void {
    if (!this._chartScrollerDown)
      this.scrollValue = this.peakGroupingService.scrollPercent * this.scrollMax;
  }

  private displayTicks(): void {
    let frames = this.peakGroupingService.getFramesToDisplay();
    if (frames)
      this.syncFramesWithGraph(frames.frames, frames.startTime, frames.firstFrameTime);
  }



  private syncFramesWithGraph(frames: number[][], windowStartTime: number, firstFrameTime: number): void {
    let maxFrames = this.getMaxFramesToDisplay();
    this.lineData = [];
    for (let i = 0; i < maxFrames; i++) {
      let seconds = (Math.abs((windowStartTime - firstFrameTime + (this.getFrameTimeSpanMs() * i)) / 10) / 100);
      if (i >= frames.length || frames[i].length === 0) {
        this.lineData.push({
          x: seconds,
          y: undefined
        });
      } else {
        frames[i].forEach(singleTime => this.lineData.push({
          x: seconds,
          y: singleTime
        }));
      }
    }

    this.chartColors.length = this.lineData.length;
    for (let i = 0; i < this.chartColors.length; i++)
      this.chartColors[i] = this.color;
  }

}

interface ScatterData {
  x: number;
  y: number;
}
