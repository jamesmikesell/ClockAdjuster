import { Component, OnInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { AudioCaptureService } from '../../service/audio-capture.service';
import { HammerInput } from '@angular/material';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-spectrogram',
  templateUrl: './spectrogram.component.html',
  styleUrls: ['./spectrogram.component.css']
})
export class SpectrogramComponent implements OnInit, OnDestroy {

  private static _graphIsLog = false;
  private static _colorGraph = true;
  private static _logIntensity = false;

  @ViewChild('canvas')
  private canvasRef: ElementRef;
  private speed = 1;
  private canvasCtx: CanvasRenderingContext2D;
  private graphCtx: CanvasRenderingContext2D;
  private lineCtx: CanvasRenderingContext2D;
  private run = true;
  private intensityShadeMap = new Map<number, string>();
  private clickY = 0;
  private frequencyBinCount: number;
  private dragging = false;
  private lineRemovalTimer: Subscription;


  constructor(private audioCaptureService: AudioCaptureService) { }

  ngOnInit(): void {
    this.audioCaptureService.start();

    this.configFFTSize();

    let canvas = this.canvasRef.nativeElement as HTMLCanvasElement;
    this.canvasCtx = canvas.getContext("2d");

    this.graphCtx = this.initOffscreenCanvasCtx(canvas);
    this.lineCtx = this.initOffscreenCanvasCtx(canvas);

    this.resizeAllCanvases();

    requestAnimationFrame(() => this.render());
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.resizeAllCanvases();
  }

  @HostListener('window:touchend', ['$event'])
  @HostListener('window:mouseup', ['$event'])
  onPointerUp(): void {
    this.dragging = false;

    if (this.clickY) {
      if (this.lineRemovalTimer && !this.lineRemovalTimer.closed)
        this.lineRemovalTimer.unsubscribe();

      this.lineRemovalTimer = timer(3000)
        .subscribe(() => {
          if (!this.dragging)
            this.clickY = undefined;
        });
    }
  }

  private resizeAllCanvases(): void {
    this.resizeCanvas(this.graphCtx.canvas);
    this.resizeCanvas(this.lineCtx.canvas);
    this.resizeCanvas(this.canvasCtx.canvas);
  }

  private resizeCanvas(canvas: HTMLCanvasElement): void {
    let cssWidth = this.canvasRef.nativeElement.clientWidth;
    let cssHeight = this.canvasRef.nativeElement.clientHeight;

    let displayWidth = Math.floor(cssWidth * window.devicePixelRatio);
    let displayHeight = Math.floor(cssHeight * window.devicePixelRatio);

    canvas.width = displayWidth;
    canvas.height = displayHeight;
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
    let height = this.canvasRef.nativeElement.clientHeight;
    let y = (height - (event.center.y - top)) * window.devicePixelRatio;

    event.preventDefault();

    this.setY(y);
    this.dragging = true;
  }

  mouseDown(event: MouseEvent): void {
    let height = this.canvasRef.nativeElement.clientHeight;
    let y = (height - event.offsetY) * window.devicePixelRatio;

    this.setY(y);
    this.dragging = true;
  }

  private setY(y: number): void {
    this.clickY = Math.floor(y);

    let height = this.graphCtx.canvas.height;
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

  get graphIsLog(): boolean {
    return SpectrogramComponent._graphIsLog;
  }
  set graphIsLog(value: boolean) {
    SpectrogramComponent._graphIsLog = value;
    this.configFFTSize();
  }

  get colorGraph(): boolean {
    return SpectrogramComponent._colorGraph;
  }
  set colorGraph(value: boolean) {
    SpectrogramComponent._colorGraph = value;
    this.intensityShadeMap.clear();
  }

  get logIntensity(): boolean {
    return SpectrogramComponent._logIntensity;
  }
  set logIntensity(value: boolean) {
    SpectrogramComponent._logIntensity = value;
    this.intensityShadeMap.clear();
  }


  private configFFTSize(): void {
    if (SpectrogramComponent._graphIsLog)
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
    if (SpectrogramComponent._logIntensity)
      percent = Math.log(value + 1) / Math.log(256);
    else
      percent = value / 255;

    let string: string;
    if (SpectrogramComponent._colorGraph) {
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
    this.lineCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.lineCtx.clearRect(0, 0, this.lineCtx.canvas.width, this.lineCtx.canvas.height);

    if (this.clickY) {
      let lineY = this.lineCtx.canvas.height - this.clickY;

      this.lineCtx.beginPath();
      this.lineCtx.moveTo(0, lineY);
      this.lineCtx.lineTo(this.lineCtx.canvas.width, lineY);
      this.lineCtx.strokeStyle = "rgb(255, 0, 0)";
      this.lineCtx.lineWidth = Math.floor(2 * window.devicePixelRatio);
      this.lineCtx.stroke();
    }
  }

}
