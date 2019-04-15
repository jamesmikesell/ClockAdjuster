import { TestBed } from '@angular/core/testing';

import { PeakTimeService } from './peak-time.service';

describe('PeakTimeService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: PeakTimeService = TestBed.get(PeakTimeService);
    expect(service).toBeTruthy();
  });
});
