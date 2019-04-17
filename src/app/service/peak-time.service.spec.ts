import { TestBed } from '@angular/core/testing';

import { PeakTimeService } from './peak-time.service';
import { AudioCaptureService } from './audio-capture.service';
import { SignalProcessingService } from './signal-processing.service';
import { SampleQueue } from '../model/sample-queue';

describe('PeakTimeService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      {
        provide: AudioCaptureService,
        useClass: MockAudioService
      },
      {
        provide: SignalProcessingService,
        useClass: SignalProcessingService
      }
    ]
  }));

  let y = 1;
  let sampleData = new Float32Array(
    [
      // 1, 2, 3, 4, 5, 6, 7, 8, 9   - Index
      // 2, 3, 4, 5, 6, 7, 8, 9, 10  - Time
      0, 0, 0, 0, y, 0, 0, 0, 0, 0, //  0
      0, 0, 0, y, 0, 0, 0, 0, 0, 0, // 10
      0, 0, 0, y, 0, 0, 0, 0, 0, 0, // 20
      0, 0, 0, 0, y, 0, 0, 0, 0, 0, // 30
      0, 0, 0, 0, 0, y, 0, 0, 0, 0  // 40
    ]
  );


  it('not full buffer', () => {
    const service: PeakTimeService = TestBed.get(PeakTimeService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(5000, sampleData);
    service.findTickTimes();

    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(service.getFramesToDisplay().frames).toEqual([0, -100, -100, 0, 100]);
  });



  it('reduced display set end', () => {
    const service: PeakTimeService = TestBed.get(PeakTimeService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(5000, sampleData);
    service.findTickTimes();

    service.maxFramesToDisplay = 3;

    console.log(service.tickTimes);
    console.log(service.getFramesToDisplay());
    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(service.getFramesToDisplay().frames).toEqual([-100, 0, 100]);
  });


  it('reduced display set start', () => {
    const service: PeakTimeService = TestBed.get(PeakTimeService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(5000, sampleData);
    service.findTickTimes();

    service.maxFramesToDisplay = 3;
    service.scrollPercent = 0;

    console.log(service.tickTimes);
    console.log(service.getFramesToDisplay());
    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(service.getFramesToDisplay().frames).toEqual([0, -100, -100]);
  });



  it('full buffer', () => {
    const service: PeakTimeService = TestBed.get(PeakTimeService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);

    audioService.sampleQueue = new SampleQueue(20);

    let x = 1;
    audioService.sampleRate = 10;
    audioService.sampleQueue.add(2000, new Float32Array(
      [
        // 1, 2, 3, 4, 5, 6, 7, 8, 9   - Index
        // 2, 3, 4, 5, 6, 7, 8, 9, 10  - Time
        0, 0, 0, 0, x, 0, 0, 0, 0, 0, //  0
        0, 0, 0, x, 0, 0, 0, 0, 0, 0  // 10
      ]
    ));
    service.findTickTimes();

    audioService.sampleQueue.add(4000, new Float32Array(
      [
        // 1, 2, 3, 4, 5, 6, 7, 8, 9   - Index
        // 2, 3, 4, 5, 6, 7, 8, 9, 10  - Time
        0, 0, 0, x, 0, 0, 0, 0, 0, 0, // 20
        0, 0, 0, 0, x, 0, 0, 0, 0, 0  // 30
      ]
    ));
    service.findTickTimes();

    audioService.sampleQueue.add(5000, new Float32Array(
      [
        // 1, 2, 3, 4, 5, 6, 7, 8, 9   - Index
        // 2, 3, 4, 5, 6, 7, 8, 9, 10  - Time
        0, 0, 0, 0, 0, x, 0, 0, 0, 0  // 40
      ]
    ));
    service.findTickTimes();

    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(service.getFramesToDisplay().frames).toEqual([0, -100, -100, 0, 100]);
  });
});


class MockAudioService {
  sampleRate: number;
  sampleQueue = new SampleQueue(30000);

  getSampleRate(): number {
    return this.sampleRate;
  }
}
