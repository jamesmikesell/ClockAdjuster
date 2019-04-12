import { Injectable } from '@angular/core';
import NoSleep from 'nosleep.js';

@Injectable({
  providedIn: 'root'
})
export class NoSleepService {

  private _keepAwake = false;

  constructor() { }

  private noSleep = new NoSleep();

  start(): void {
    this.noSleep.enable();
    this._keepAwake = true;
  }

  stop(): void {
    this.noSleep.disable();
    this._keepAwake = false;
  }

  get keepAwake(): boolean {
    return this._keepAwake;
  }

  set keepAwake(value: boolean) {
    this._keepAwake = value;
    if (value)
      this.noSleep.enable();
    else
      this.noSleep.disable();
  }
}
