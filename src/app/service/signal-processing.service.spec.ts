import { TestBed } from '@angular/core/testing';

import { SignalProcessingService } from './signal-processing.service';

describe('Signal Processing', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: []
  }));


  it('service to exist', () => {
    const service: SignalProcessingService = TestBed.get(SignalProcessingService);
    expect(service).toBeTruthy();
  });

  it('undefined when all values are the same 0', () => {
    const service: SignalProcessingService = TestBed.get(SignalProcessingService);
    expect(service.getMaxPeakIndex(new Float32Array([0, 0, 0, 0, 0, 0]))).toEqual(undefined);
  });

  it('undefined when all values are the same 1', () => {
    const service: SignalProcessingService = TestBed.get(SignalProcessingService);
    expect(service.getMaxPeakIndex(new Float32Array([1, 1, 1, 1, 1, 1]))).toEqual(undefined);
  });

  it('undefined when all values are the same -2', () => {
    const service: SignalProcessingService = TestBed.get(SignalProcessingService);
    expect(service.getMaxPeakIndex(new Float32Array([-2, -2, -2, -2, -2]))).toEqual(undefined);
  });


  it('find min', () => {
    const service: SignalProcessingService = TestBed.get(SignalProcessingService);
    expect(service.getMaxPeakIndex(new Float32Array([-2, -2, -2, -3, -2]))).toEqual(3);
  });

  it('find max', () => {
    const service: SignalProcessingService = TestBed.get(SignalProcessingService);
    expect(service.getMaxPeakIndex(new Float32Array([-2, -2, -2, 3, -2]))).toEqual(3);
  });

});
