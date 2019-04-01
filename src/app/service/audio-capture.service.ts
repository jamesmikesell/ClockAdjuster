import { Injectable } from '@angular/core';
import { SampleQueue } from '../model/sample-queue';

@Injectable({
  providedIn: 'root'
})
export class AudioCaptureService {

  private audioContext: AudioContext;
  private processor: ScriptProcessorNode;
  private mediaStreamSource: MediaStreamAudioSourceNode;

  sampleQueue = new SampleQueue(1);

  constructor() { }


  start(): void {
    if (!this.audioContext) {

      this.audioContext = new AudioContext();

      let config: MediaStreamConstraints = {
        "audio": {},
      };


      navigator.getUserMedia(config,
        stream => this.configureStream(stream),
        (error: MediaStreamError) => console.error(error));
    }
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
    let bufferSize = 0; //16384 / 2;
    let sampleQueueMs = 3000;
    this.sampleQueue = new SampleQueue(Math.round(sampleQueueMs / 1000 * this.audioContext.sampleRate));

    this.processor = this.audioContext.createScriptProcessor(bufferSize);
    this.processor.onaudioprocess = (event) => this.audioProcess(event);
    this.processor.connect(this.audioContext.destination);

    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.mediaStreamSource.connect(this.processor);
  }

  private audioProcess(event: AudioProcessingEvent): void {
    let buf = event.inputBuffer.getChannelData(0);

    // Using Date.now() until chrome bug around performance time drift has been corrected
    // https://crbug.com/948384
    // let timeEnd = (buf.length / (event.inputBuffer.sampleRate / 1000)) + event.timeStamp;
    let timeEnd = (buf.length / (event.inputBuffer.sampleRate / 1000)) + Date.now();
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
