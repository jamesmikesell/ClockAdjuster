import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { AudioCaptureService } from '../../service/audio-capture.service';

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
  private colors = new Map<number, string>();
  private clickY = 0;
  private clickTime: number;
  private frequencyBinCount: number;
  
 graphIsLog = false;


  constructor(private audioCaptureService: AudioCaptureService) { }

  ngOnInit(): void {
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


  mouseMove(event: MouseEvent): void {
    if (this.dragging) {
      let height = this.graphCtx.canvas.height;
      let y = height - event.offsetY;

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

      // let percent = y / height;
      // let binIndex = Math.pow(this.frequencyBinCount, percent) - 1;
      // let maxFrequency = this.audioCaptureService.getSampleRate() / 2;
      // let frequency = maxFrequency * (binIndex / (this.frequencyBinCount - 1));


      this.audioCaptureService.setFrequency(Math.round(frequency));
    }
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
      this.graphLogarithmic(width, height, frequencies);
    else
      this.graphLinear(width, height, frequencies);
  }



  private graphLinear(width: number, height: number, frequencies: Uint8Array): void {
    let frequencyBinCount = frequencies.length;

    let barHeight = height / frequencyBinCount;

    for (let i = 0; i < frequencyBinCount; i++) {
      let value = frequencies[i];

      this.graphCtx.fillStyle = this.getGraphColor(value);
      this.graphCtx.fillRect(width - this.speed, height - (i * barHeight), this.speed, barHeight);
    }
  }


  private graphLogarithmic(width: number, height: number, frequencies: Uint8Array): void {
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
        this.graphCtx.fillStyle = this.getGraphColor(value);
        this.graphCtx.fillRect(width - this.speed, yLocation, this.speed, sectionHeight);
      });
    });
  }

  private getGraphColor(value: number): string {
    let existing = this.colors.get(value);
    if (existing)
      return existing;

    let i = 255 - value;
    let string = `rgb(${i}, ${i}, ${i})`;
    this.colors.set(value, string);
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
