import { Injectable } from '@angular/core';
import NoSleep from 'nosleep.js';

@Injectable({
  providedIn: 'root'
})
export class NoSleepService {

  constructor() { }
 
  private noSleep = new NoSleep();

  start(): void {
    this.noSleep.enable();
  }

  stop(): void {
    this.noSleep.disable();
  }
}
