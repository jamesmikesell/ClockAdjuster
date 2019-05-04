import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { AudioCaptureService } from '../../service/audio-capture.service';
import { HammerInput } from '@angular/material';

@Component({
  selector: 'app-spectrogram',
  templateUrl: './spectrogram.component.html',
  styleUrls: ['./spectrogram.component.css']
})
export class SpectrogramComponent implements OnInit, OnDestroy {

  dragging = false;

  @ViewChild('canvas')
  private canvasRef: ElementRef;
  private speed = 1;
  private canvasCtx: CanvasRenderingContext2D;
  private graphCtx: CanvasRenderingContext2D;
  private lineCtx: CanvasRenderingContext2D;
  private run = true;
  private intensityShadeMap = new Map<number, string>();
  private clickY = 0;
  private clickTime: number;
  private frequencyBinCount: number;

  private _graphIsLog = false;
  private _colorGraph = true;
  private _logIntensity = true;


  constructor(private audioCaptureService: AudioCaptureService) { }

  ngOnInit(): void {
    this.audioCaptureService.start();

    this.configFFTSize();

    let canvas = this.canvasRef.nativeElement as HTMLCanvasElement;
    this.canvasCtx = canvas.getContext("2d");

    this.graphCtx = this.initOffscreenCanvasCtx(canvas);
    this.lineCtx = this.initOffscreenCanvasCtx(canvas);

    requestAnimationFrame(() => this.render());
  }

  private initOffscreenCanvasCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    let newCanvas = document.createElement("canvas");
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    return newCanvas.getContext("2d");
  }

  ngOnDestroy(): void {
    this.run = false;
  }

  slide(event: HammerInput): void {
    let top = this.canvasRef.nativeElement.getBoundingClientRect().top;
    let height = this.graphCtx.canvas.height;
    let y = height - (event.center.y - top);

    event.preventDefault();

    this.setY(y);
  }

  private setY(y: number): void {
    let height = this.graphCtx.canvas.height;

    this.clickTime = performance.now();
    this.clickY = y;

    let maxFrequency = this.audioCaptureService.getSampleRate() / 2;
    let frequency: number;
    if (this.graphIsLog) {
      let percent = y / (height - 1);
      let binIndex = Math.pow(this.frequencyBinCount, percent) - 1;
      frequency = maxFrequency * (binIndex / this.frequencyBinCount);
    } else {
      frequency = (y / height) * maxFrequency;
    }

    this.audioCaptureService.setFrequency(Math.round(frequency));
  }

  mouseDown(event: MouseEvent): void {
    let height = this.graphCtx.canvas.height;
    let y = height - event.offsetY;

    this.setY(y);
  }

  get graphIsLog(): boolean {
    return this._graphIsLog;
  }
  set graphIsLog(value: boolean) {
    this._graphIsLog = value;
    this.configFFTSize();
  }

  get colorGraph(): boolean {
    return this._colorGraph;
  }
  set colorGraph(value: boolean) {
    this._colorGraph = value;
    this._logIntensity = value;
    this.intensityShadeMap.clear();
  }

  get logIntensity(): boolean {
    return this._logIntensity;
  }
  set logIntensity(value: boolean) {
    this._logIntensity = value;
    this.intensityShadeMap.clear();
  }


  private configFFTSize(): void {
    if (this._graphIsLog)
      this.audioCaptureService.setFFTBinCount(Math.pow(2, 14));
    else
      this.audioCaptureService.setFFTBinCount(Math.pow(2, 9));
  }

  private render(): void {
    let width = this.canvasCtx.canvas.width;
    let height = this.canvasCtx.canvas.height;
    this.canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasCtx.clearRect(0, 0, width, height);

    this.renderGraph();
    this.drawSelectionLine();

    this.canvasCtx.drawImage(this.graphCtx.canvas, 0, 0, width, height);
    this.canvasCtx.drawImage(this.lineCtx.canvas, 0, 0, width, height);

    if (this.run)
      requestAnimationFrame(() => this.render());
  }


  private renderGraph(): void {
    let width = this.graphCtx.canvas.width;
    let height = this.graphCtx.canvas.height;

    // Duplicate the currently displayed graph, but shifted over
    // to make space for the new frequency data
    this.graphCtx.drawImage(this.graphCtx.canvas, -this.speed, 0, width, height);

    let frequencies = this.audioCaptureService.getFrequencyData();
    this.frequencyBinCount = frequencies.length;

    if (this.graphIsLog)
      this.graphLogarithmicScale(width, height, frequencies);
    else
      this.graphLinearScale(width, height, frequencies);
  }



  private graphLinearScale(width: number, height: number, frequencies: Uint8Array): void {
    let frequencyBinCount = frequencies.length;

    let barHeight = height / frequencyBinCount;

    for (let i = 0; i < frequencyBinCount; i++) {
      let value = frequencies[i];

      this.graphCtx.fillStyle = this.getGraphShade(value);
      this.graphCtx.fillRect(width - this.speed, height - (i * barHeight), this.speed, barHeight);
    }
  }


  private graphLogarithmicScale(width: number, height: number, frequencies: Uint8Array): void {
    let frequencyBinCount = frequencies.length;

    let logMax = Math.log(frequencyBinCount + 1);
    let locationMap = new Map<number, Map<number, number>>();
    for (let i = 0; i < frequencyBinCount; i++) {
      let yEnd = height - (height * (Math.log(i + 1) / logMax));
      let yStart = height - (height * (Math.log(i + 2) / logMax));

      let sectionHeight = Math.ceil(yEnd - yStart);
      yStart = Math.ceil(yStart);


      // The log scale means that many higher frequencies will all try to be displayed
      // in the same location on y-axis. For these overlapping frequencies we're
      // displaying the intensity of the most peaked frequency.
      let existingHeightMap = locationMap.get(yStart);
      if (!existingHeightMap) {
        existingHeightMap = new Map<number, number>();
        locationMap.set(yStart, existingHeightMap);
      }

      let value = frequencies[i];
      let existingValue = existingHeightMap.get(sectionHeight);
      if (!existingValue || existingValue < value) {
        existingHeightMap.set(sectionHeight, value);
      }
    }

    Array.from(locationMap.keys()).sort((a, b) => b - a).forEach(yLocation => {
      let existingHeightMep = locationMap.get(yLocation);
      Array.from(existingHeightMep.keys()).sort((a, b) => a - b).forEach(sectionHeight => {
        let value = existingHeightMep.get(sectionHeight);
        this.graphCtx.fillStyle = this.getGraphShade(value);
        this.graphCtx.fillRect(width - this.speed, yLocation, this.speed, sectionHeight);
      });
    });
  }

  private getGraphShade(value: number): string {
    let existing = this.intensityShadeMap.get(value);
    if (existing)
      return existing;

    let percent: number;
    if (this._logIntensity)
      percent = Math.log(value + 1) / Math.log(256);
    else
      percent = value / 255;

    let string: string;
    if (this._colorGraph) {
      string = `hsla(${-percent * 240 + 240}, 100%, 50%, 1)`;
    } else {
      let minLum = .259;
      let lum = ((1 - minLum) * (percent)) + minLum;
      string = `hsla(0, 0%, ${lum * 100}%, 1)`;
    }

    this.intensityShadeMap.set(value, string);
    return string;
  }

  private drawSelectionLine(): void {
    if (this.clickTime) {
      this.lineCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.lineCtx.clearRect(0, 0, this.lineCtx.canvas.width, this.lineCtx.canvas.height);

      if (this.clickTime > performance.now() - 3000) {
        let lineY = this.lineCtx.canvas.height - this.clickY;

        this.lineCtx.beginPath();
        this.lineCtx.moveTo(0, lineY);
        this.lineCtx.lineTo(this.lineCtx.canvas.width, lineY);
        this.lineCtx.strokeStyle = "rgb(255, 0, 0)";
        this.lineCtx.stroke();
      } else {
        this.clickTime = 0;
      }
    }
  }

}
