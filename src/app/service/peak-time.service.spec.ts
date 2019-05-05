import { TestBed } from '@angular/core/testing';

import { AudioCaptureService } from './audio-capture.service';
import { SignalProcessingService } from './signal-processing.service';
import { SampleQueue } from '../model/sample-queue';
import { TimeService } from './time.service';
import { PeakCaptureService } from './peak-capture.service';
import { PeakGroupingService } from './peak-grouping.service';

describe('PeakCaptureService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      {
        provide: AudioCaptureService,
        useClass: MockAudioService
      },
      {
        provide: TimeService,
        useClass: MockTimeService
      },
      {
        provide: SignalProcessingService,
        useClass: SignalProcessingService
      },
      {
        provide: PeakGroupingService,
        useClass: PeakGroupingService
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
      0, 0, 0, 0, -y, 0, 0, 0, 0, 0, // 30
      0, 0, 0, 0, 0, y, 0, 0, 0, 0,  // 40
      0, 0
    ]
  );


  it('not full buffer', () => {
    const service: PeakCaptureService = TestBed.get(PeakCaptureService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);
    const peakGroupingService: PeakGroupingService = TestBed.get(PeakGroupingService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(5200, sampleData);
    service.dbCutoff = 1; 
    service.findTickTimes();

    expect(service).toBeTruthy();
    console.log("expected", [500, 1400, 2400, 3500, 4600]);
    console.log("actual  ", service.tickTimes);
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(peakGroupingService.getFramesToDisplay().frames).toEqual([0, -100, -100, 0, 100]);
    expect(peakGroupingService.getFramesToDisplay().startTime).toEqual(0);
    expect(peakGroupingService.getFramesToDisplay().firstFrameTime).toEqual(0);
  });




  it('not full buffer, late time start', () => {
    const service: PeakCaptureService = TestBed.get(PeakCaptureService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);
    const peakGroupingService: PeakGroupingService = TestBed.get(PeakGroupingService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(16200, sampleData);
    service.dbCutoff = 1; 
    service.findTickTimes();

    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([11500, 12400, 13400, 14500, 15600]);
    expect(peakGroupingService.getFramesToDisplay().frames).toEqual([0, -100, -100, 0, 100]);
    expect(peakGroupingService.getFramesToDisplay().startTime).toEqual(11000);
    expect(peakGroupingService.getFramesToDisplay().firstFrameTime).toEqual(11000);
  });




  it('not full buffer, late time start, reduced display end', () => {
    const service: PeakCaptureService = TestBed.get(PeakCaptureService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);
    const peakGroupingService: PeakGroupingService = TestBed.get(PeakGroupingService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(16200, sampleData);
    service.dbCutoff = 1; 
    service.findTickTimes();

    peakGroupingService.maxFramesToDisplay = 3;


    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([11500, 12400, 13400, 14500, 15600]);
    expect(peakGroupingService.getFramesToDisplay().frames).toEqual([-100, 0, 100]);
    expect(peakGroupingService.getFramesToDisplay().startTime).toEqual(13000);
    expect(peakGroupingService.getFramesToDisplay().firstFrameTime).toEqual(11000);
  });





  it('reduced display set end', () => {
    const service: PeakCaptureService = TestBed.get(PeakCaptureService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);
    const peakGroupingService: PeakGroupingService = TestBed.get(PeakGroupingService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(5200, sampleData);
    service.dbCutoff = 1; 
    service.findTickTimes();

    peakGroupingService.maxFramesToDisplay = 3;

    console.log(service.tickTimes);
    console.log(peakGroupingService.getFramesToDisplay());
    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(peakGroupingService.getFramesToDisplay().frames).toEqual([-100, 0, 100]);
    expect(peakGroupingService.getFramesToDisplay().startTime).toEqual(2000);
    expect(peakGroupingService.getFramesToDisplay().firstFrameTime).toEqual(0);
  });


  it('reduced display set start', () => {
    const service: PeakCaptureService = TestBed.get(PeakCaptureService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);
    const peakGroupingService: PeakGroupingService = TestBed.get(PeakGroupingService);

    audioService.sampleRate = 10;
    audioService.sampleQueue.add(5200, sampleData);
    service.dbCutoff = 1; 
    service.findTickTimes();

    peakGroupingService.maxFramesToDisplay = 3;
    peakGroupingService.scrollPercent = 0;

    console.log(service.tickTimes);
    console.log(peakGroupingService.getFramesToDisplay());
    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(peakGroupingService.getFramesToDisplay().frames).toEqual([0, -100, -100]);
    expect(peakGroupingService.getFramesToDisplay().startTime).toEqual(0);
    expect(peakGroupingService.getFramesToDisplay().firstFrameTime).toEqual(0);
  });



  it('full buffer', () => {
    const service: PeakCaptureService = TestBed.get(PeakCaptureService);
    const audioService: MockAudioService = TestBed.get(AudioCaptureService);
    const peakGroupingService: PeakGroupingService = TestBed.get(PeakGroupingService);

    audioService.sampleQueue = new SampleQueue(24);

    let x = 1;
    audioService.sampleRate = 10;
    audioService.sampleQueue.add(2200, new Float32Array(
      [
        // 1, 2, 3, 4, 5, 6, 7, 8, 9   - Index
        // 2, 3, 4, 5, 6, 7, 8, 9, 10  - Time
        0, 0, 0, 0, x, 0, 0, 0, 0, 0, //  0
        0, 0, 0, x, 0, 0, 0, 0, 0, 0,  // 10
        0, 0
      ]
    ));
    service.dbCutoff = 1; 
    service.findTickTimes();

    audioService.sampleQueue.add(4300, new Float32Array(
      [
        // 1, 2, 3, 4, 5, 6, 7, 8, 9   - Index
        // 2, 3, 4, 5, 6, 7, 8, 9, 10  - Time
        0, x, 0, 0, 0, 0, 0, 0, // 20
        0, 0, 0, 0, x, 0, 0, 0, 0, 0,  // 30
        0, 0, 0
      ]
    ));
    service.findTickTimes();

    audioService.sampleQueue.add(5200, new Float32Array(
      [
        // 1, 2, 3, 4, 5, 6, 7, 8, 9   - Index
        // 2, 3, 4, 5, 6, 7, 8, 9, 10  - Time
        0, 0, x, 0, 0, 0, 0,  // 40
        0, 0
      ]
    ));
    service.findTickTimes();

    expect(service).toBeTruthy();
    expect(service.tickTimes).toEqual([500, 1400, 2400, 3500, 4600]);
    expect(peakGroupingService.getFramesToDisplay().frames).toEqual([0, -100, -100, 0, 100]);
    expect(peakGroupingService.getFramesToDisplay().startTime).toEqual(0);
    expect(peakGroupingService.getFramesToDisplay().firstFrameTime).toEqual(0);
  });
});


class MockAudioService {
  sampleRate: number;
  sampleQueue = new SampleQueue(30000);

  getSampleRate(): number {
    return this.sampleRate;
  }
}

class MockTimeService {
  getDriftRate(): number {
    return undefined;
  }
}
