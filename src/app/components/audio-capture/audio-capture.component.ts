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

  dbCutoff: number = 9;
  lineData: number[] = [];
  labelData: string[] = [];
  chartOptions: ChartOptions;
  bph = 3600;

  private periodicUpdate: Subscription;
  private startTimeMs: number;

  // private startDrift = Date.now() - window.performance.now();

  constructor(private audioCaptureService: AudioCaptureService,
    private signalProcessingService: SignalProcessingService) { }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    if (this.periodicUpdate && !this.periodicUpdate.closed)
      this.periodicUpdate.unsubscribe();

    this.audioCaptureService.stop();
  }

  private get frameTimeSpanMs(): number {
    return (this.bph / 60 / 60) * 1000;
  }

  private startUpdateTimer(): void {
    this.periodicUpdate = timer(1000, 100).subscribe(() => {
      this.fillLabelData();

      // console.log((Date.now() - window.performance.now()) - this.startDrift);
    });
  }

  private getLineDataEndTime(): number {
    return (this.lineData.length * this.frameTimeSpanMs) + this.startTimeMs;
  }

  start(): void {
    this.audioCaptureService.start();
    this.startUpdateTimer();
    this.configureChart(this.audioCaptureService.getSampleRate());
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

    let sampleRateMs = this.audioCaptureService.getSampleRate() / 1000;
    // let averageRms = this.audioCaptureService.sampleQueue.getRms();
    let timeAndSamples = this.audioCaptureService.sampleQueue.getData();
    let dataEndTime = timeAndSamples[0];
    let samples = timeAndSamples[1];

    if (!this.startTimeMs) {
      let firstPeakIndex = this.signalProcessingService.getMaxPeakIndex(samples);
      if (firstPeakIndex !== undefined) {
        let firstPeakStartTime = dataEndTime - ((samples.length - firstPeakIndex) / sampleRateMs);
        // Set the `startTime` so that the fist peak is in the middle of the y-axis
        let chartMidpoint = 25000 / 44100;
        this.startTimeMs = firstPeakStartTime - (this.frameTimeSpanMs * chartMidpoint);
        this.lineData.push(sampleRateMs * 1000 * chartMidpoint);
      }
    }


    if (!this.startTimeMs)
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
