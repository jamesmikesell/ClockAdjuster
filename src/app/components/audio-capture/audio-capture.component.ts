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
  bph = 3600;
  showSpectrogram = false;
  runningTime: string;

  private periodicUpdate: Subscription;
  private firstPeakTimeMs: number;

  constructor(public audioCaptureService: AudioCaptureService,
    private signalProcessingService: SignalProcessingService) { }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    if (this.periodicUpdate && !this.periodicUpdate.closed)
      this.periodicUpdate.unsubscribe();

    this.audioCaptureService.stop();
  }

  private get frameTimeSpanMs(): number {
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

  private getLineDataEndTime(): number {
    return (this.lineData.length * this.frameTimeSpanMs) + this.firstPeakTimeMs;
  }

  start(): void {
    this.audioCaptureService
      .start()
      .then(() => {
        this.audioCaptureService.sampleQueue.clear();
        this.startUpdateTimer();
        this.configureChart(this.audioCaptureService.getSampleRate());
        this.updateRunTime();
      });
  }

  stop(): void {
    if (this.periodicUpdate && !this.periodicUpdate.closed)
      this.periodicUpdate.unsubscribe();

    // Do one last run just to catch up on anything in cache
    this.fillLabelData();
  }

  reset(): void {
    this.audioCaptureService.sampleQueue.clear();
    this.lineData = [];
    this.labelData = [];
    this.firstPeakTimeMs = 0;
    this.runningTime = undefined;
  }

  private configureChart(chartYMax: number): void {
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
        duration: 0
      },
      hover: {
        animationDuration: 0
      },
      responsiveAnimationDuration: 0,
      showLines: false,
      scales: {
        yAxes: [{
          ticks: {
            beginAtZero: true,
            max: chartYMax
          }
        }]
      }
    };
  }


  private fillLabelData(): void {
    let sampleRateSeconds = this.audioCaptureService.getSampleRate();
    let sampleRateMs = sampleRateSeconds / 1000;
    let timeAndSamples = this.audioCaptureService.sampleQueue.getData();
    let dataEndTime = timeAndSamples[0];
    let samples = timeAndSamples[1];

    if (samples.length < sampleRateSeconds * 1.5)
      return;

    if (!this.firstPeakTimeMs) {
      let firstPeakIndex = this.signalProcessingService.getMaxPeakIndex(samples);
      if (firstPeakIndex !== undefined) {
        let firstPeakStartTime = dataEndTime - ((samples.length - firstPeakIndex) / sampleRateMs);
        // Set the `startTime` so that the fist peak is in the middle of the y-axis
        let chartMidpoint = 25000 / sampleRateSeconds;
        this.firstPeakTimeMs = firstPeakStartTime - (this.frameTimeSpanMs * chartMidpoint);
        this.lineData.push(sampleRateMs * 1000 * chartMidpoint);
      }
    }


    if (!this.firstPeakTimeMs)
      return;


    let dataStartTime = dataEndTime - (samples.length / sampleRateMs);
    //Fill in missing data
    let missingFrames = Math.ceil((dataStartTime - this.getLineDataEndTime()) / this.frameTimeSpanMs);
    missingFrames = missingFrames < 0 ? 0 : missingFrames;
    if (missingFrames)
      console.log("adding missing frames " + missingFrames);
    for (let i = 0; i < missingFrames; i++)
      this.lineData.push();



    //Chunk data in whole frames
    while (true) {
      let frameStartTime = this.getLineDataEndTime();
      let frameEndTime = frameStartTime + this.frameTimeSpanMs;
      if (frameEndTime > dataEndTime)
        break;

      let frameStartIndex = Math.round(samples.length - ((dataEndTime - frameStartTime) * sampleRateMs));
      let frameEndIndex = Math.round(frameStartIndex + (this.frameTimeSpanMs * sampleRateMs));


      let frameSamples = samples.slice(frameStartIndex, frameEndIndex);
      let peakStartIndex = this.signalProcessingService.getMaxPeakIndex(frameSamples);

      this.lineData.push(peakStartIndex);
    }

    this.labelData.length = this.lineData.length;
  }
}
