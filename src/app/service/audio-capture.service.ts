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

  sampleQueue = new SampleQueue(1);

  constructor() { }

  setFrequency(frequency: number): void {
    if (!this.filterBandPass)
      return;

    let maxFrequency = this.audioContext.sampleRate / 2;
    if (frequency === undefined || frequency === null || frequency >= maxFrequency || frequency <= 0)
      return;

    this.filterBandPass.frequency.value = frequency;
  }

  getFrequency(): number {
    if (!this.filterBandPass)
      return undefined;

    return this.filterBandPass.frequency.value;
  }

  setBandWidth(bandwidth: number): void {
    if (!this.filterBandPass)
      return;

    this.filterBandPass.Q.value = bandwidth;
  }

  getBandWidth(): number {
    if (!this.filterBandPass)
      return 0;

    return this.filterBandPass.Q.value;
  }

  start(): Promise<void> {
    if (!this.audioContext) {

      this.audioContext = new AudioContext();

      let config: MediaStreamConstraints = {
        "audio": {
          echoCancellation: false
        },
      };

      return navigator.mediaDevices.getUserMedia(config).then(stream => this.configureStream(stream));
    } else {
      return Promise.resolve();
    }
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
    let sampleQueueMs = 3000;
    this.sampleQueue = new SampleQueue(Math.round(sampleQueueMs / 1000 * this.audioContext.sampleRate));

    this.filterBandPass = this.audioContext.createBiquadFilter();
    this.filterBandPass.type = "bandpass";
    this.filterBandPass.frequency.value = 1;
    this.filterBandPass.Q.value = 0;

    this.processor = this.audioContext.createScriptProcessor(Math.pow(2, 14));
    this.processor.onaudioprocess = (event) => this.audioProcess(event);
    this.filterBandPass.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.smoothingTimeConstant = 0;
    this.analyser.fftSize = 2048;

    this.filterBandPass.connect(this.analyser);


    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.mediaStreamSource.connect(this.filterBandPass);
  }

  private audioProcess(event: AudioProcessingEvent): void {
    let buf = event.inputBuffer.getChannelData(0);


    // Using Date.now() until chrome bug around performance time drift has been corrected
    // https://crbug.com/948384
    let timeEnd = (buf.length / (event.inputBuffer.sampleRate / 1000)) + event.timeStamp;
    // let timeEnd = (buf.length / (event.inputBuffer.sampleRate / 1000)) + Date.now();
    this.sampleQueue.add(timeEnd, buf);

    // let avg = this.sampleQueue.getRms();

    // let peakStartIndex = this.getPeakStartIndex(buf, avg, this.dbCutoff);


    // if (peakStartIndex) {
    //   let peakTime = timeEnd - ((buf.length - peakStartIndex) / (event.inputBuffer.sampleRate / 1000));
    //   this.peakTimes.push(peakTime);
    //   console.log(`${peakStartIndex}`);
    // }
  }
}
