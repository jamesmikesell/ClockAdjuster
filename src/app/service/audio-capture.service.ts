import { Injectable } from '@angular/core';
import { SampleQueue } from '../model/sample-queue';

@Injectable({
  providedIn: 'root'
})
export class AudioCaptureService {

  private audioContext: AudioContext;
  private processor: ScriptProcessorNode;
  private mediaStreamSource: MediaStreamAudioSourceNode;
  private analyser: AnalyserNode;
  private filterBandPass: BiquadFilterNode;
  private fftSize = Math.pow(2, 5);
  private initiated = false;

  sampleQueue = new SampleQueue(1);

  constructor() { }

  setFrequency(frequency: number): void {
    if (!this.initiated)
      return;

    let maxFrequency = this.audioContext.sampleRate / 2;
    if (frequency === undefined || frequency === null || frequency >= maxFrequency || frequency <= 0)
      return;

    this.filterBandPass.frequency.value = frequency;
  }

  getFrequency(): number {
    if (!this.initiated)
      return undefined;

    return this.filterBandPass.frequency.value;
  }

  setBandWidth(bandwidth: number): void {
    if (!this.initiated)
      return;

    this.filterBandPass.Q.value = bandwidth;
  }

  getBandWidth(): number {
    if (!this.initiated)
      return 0;

    return this.filterBandPass.Q.value;
  }

  start(): Promise<void> {
    if (!this.audioContext) {
      this.configureAudioContext();

      let config: ExtendedMediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          sampleRate: 44100,
          autoGainControl: true,
          noiseSuppression: false
        }
      };

      return navigator.mediaDevices.getUserMedia(config).then(stream => this.configureStream(stream));
    } else {
      return Promise.resolve();
    }
  }

  private getScriptProcessorBufferSize(): number {
    return 16384;
  }

  private configureAudioContext(): void {
    this.audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ latencyHint: "playback" });
    this.filterBandPass = this.audioContext.createBiquadFilter();
    this.processor = this.audioContext.createScriptProcessor(this.getScriptProcessorBufferSize());
    this.analyser = this.audioContext.createAnalyser();

    let sampleQueueSeconds = 10;
    this.sampleQueue = new SampleQueue(Math.round(sampleQueueSeconds * this.audioContext.sampleRate));

    this.filterBandPass.type = "bandpass";
    this.filterBandPass.frequency.value = 1;
    this.filterBandPass.Q.value = 0;

    this.processor.onaudioprocess = (event) => this.audioProcess(event);
    this.filterBandPass.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.analyser.smoothingTimeConstant = 0;
    this.analyser.fftSize = this.fftSize;

    this.filterBandPass.connect(this.analyser);
  }

  setFFTBinCount(size: number): void {
    this.fftSize = size;

    if (this.analyser)
      this.analyser.fftSize = size;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser)
      return new Uint8Array();

    let freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freq);

    return freq;
  }

  stop(): void {
    if (this.audioContext)
      this.audioContext.close();
    if (this.processor)
      this.processor.disconnect();
    if (this.mediaStreamSource)
      this.mediaStreamSource.disconnect();

    this.audioContext = undefined;
  }

  getSampleRate(): number {
    return this.audioContext.sampleRate;
  }

  configureStream(stream: MediaStream): void {
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.mediaStreamSource.connect(this.filterBandPass);

    this.initiated = true;
  }

  private getAudioTime(event: AudioProcessingEvent): number {
    let anyWindow = window as any;
    let isChrome = !!anyWindow.chrome && (!!anyWindow.chrome.webstore || !!anyWindow.chrome.runtime);
    if (isChrome)
      return event.timeStamp;

    return performance.now();
  }

  private audioProcess(event: AudioProcessingEvent): void {
    let buf = event.inputBuffer.getChannelData(0);

    let timeEnd = ((buf.length - 1) / (event.inputBuffer.sampleRate / 1000)) + this.getAudioTime(event);
    this.sampleQueue.add(timeEnd, buf);
  }
}

interface ExtendedMediaStreamConstraints extends MediaStreamConstraints {
  audio: ExtendedMediaTrackConstraintSet;
}

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  autoGainControl: boolean;
  noiseSuppression: boolean;
}
