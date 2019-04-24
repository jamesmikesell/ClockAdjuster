import { Injectable } from '@angular/core';
import { Subscription, timer, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class TimeService {

    private offsetTimes: number[] = [];
    private refreshTimes: number[] = [];
    private periodicResyncTimer: Subscription;
    private largeDriftCheckTimer: Subscription;
    private performanceTimeOffsetAtSync: number;
    private enabled = false;

    samplesPerRefresh = 10;
    refreshIntervalMinutes = 10;

    /**
    Usage: realTimeDuration = (driftRate * localTimeDuration) + localTimeDuration

    Note: Network related errors can cause far greater error than the actual local clock drift.  As such,
    this should only be used when there is a sufficient time span between the last check of server time and first check
    of server time (IE 30+ minutes).
    */
    driftRate: number;

    /** +/- seconds per day error
     * 
     * Gets the estimated error ratio of the drift.  If drift has only been calculated over a short
     * period of time (few minutes), the error will be quite high.  As such
     * using the drift rate should only be used after a long period of time.
     */
    estimatedDriftErrorSecondsPerDay: number;


    constructor(private http: HttpClient) {
        this.calculateOffset();
    }

    getRealTime(): Date {
        if (!this.offsetTimes.length)
            return undefined;
        return new Date(performance.now() + this.offsetTimes[this.offsetTimes.length - 1]);
    }

    private updateDriftError(): void {
        if (this.refreshTimes.length >= 2) {
            let msErrorPerCheck = 100;
            let localTimeDuration = this.refreshTimes[this.refreshTimes.length - 1] - this.refreshTimes[0];
            this.estimatedDriftErrorSecondsPerDay = (msErrorPerCheck / localTimeDuration) * 60 * 60 * 24;
        } else {
            this.estimatedDriftErrorSecondsPerDay = undefined;
        }
    }


    private updateDriftRate(): void {
        /**
        firstOffset = 101; firstLocalTime = 10, firstServerTime = 111
        lastOffset = 102; lastLocalTime = 999, lastServerTime = 1101
    
        localTimeDuration = 989   (999 - 10)
        drift = 1                 (102 - 101)
        driftRate = 1/989
    
        realTimeDuration = (driftRate * localTimeDuration) + localTimeDuration
        calculatedCurrentTime = realTimeDuration + firstOffset + firstLocalTime
        1101 = (1/989)*989 + 989 + 101 + 10
         */

        if (this.offsetTimes.length < 2)
            return undefined;

        let drift = this.offsetTimes[this.offsetTimes.length - 1] - this.offsetTimes[0];
        let localTimeDuration = this.refreshTimes[this.refreshTimes.length - 1] - this.refreshTimes[0];
        let driftRate = drift / localTimeDuration;
        this.driftRate = driftRate;
    }


    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.cancelLargeDriftCheckTimer();
        this.cancelPeriodicResync();
        if (enabled) {
            if (this.refreshTimes.length) {
                let lastCheck = performance.now() - this.refreshTimes[this.refreshTimes.length - 1];
                let lastCheckMinutes = lastCheck / 1000 / 60;
                if (lastCheckMinutes > this.refreshIntervalMinutes) {
                    this.calculateOffset();
                } else {
                    let checkInMinutes = this.refreshIntervalMinutes - lastCheckMinutes;
                    this.scheduleResync(checkInMinutes * 60 * 1000);
                }
            }
        }
    }

    private scheduleResync(delayMs?: number): void {
        this.cancelPeriodicResync();
        delayMs = delayMs === undefined ? this.refreshIntervalMinutes * 60 * 1000 : delayMs;
        this.periodicResyncTimer = timer(delayMs).subscribe(() => {
            this.calculateOffset();
        });
    }

    private cancelPeriodicResync(): void {
        if (this.periodicResyncTimer && !this.periodicResyncTimer.closed)
            this.periodicResyncTimer.unsubscribe();
    }


    private scheduleLargeDriftCheck(): void {
        this.cancelLargeDriftCheckTimer();
        this.largeDriftCheckTimer = interval(1000).subscribe(() => {
            this.checkForLargeDrifts();
        });
    }

    private cancelLargeDriftCheckTimer(): void {
        if (this.largeDriftCheckTimer && !this.largeDriftCheckTimer.closed)
            this.largeDriftCheckTimer.unsubscribe();
    }


    private checkForLargeDrifts(): void {
        // This will get triggered on either a system clock change, or if the device sleeps / wakes
        if (this.performanceTimeOffsetAtSync) {
            let deltaWithPerformanceSync = Math.abs((Date.now() - performance.now()) - this.performanceTimeOffsetAtSync);
            if (deltaWithPerformanceSync > 30 * 1000) {
                console.log("Large drift detected, resyncing, resetting drift calculations");
                this.resetDriftCalculations();
                this.calculateOffset();
            }
        }
    }

    private resetDriftCalculations(): void {
        this.offsetTimes = [];
        this.refreshTimes = [];
    }

    private async calculateOffset(): Promise<void> {
        this.cancelPeriodicResync();
        this.cancelLargeDriftCheckTimer();

        let serverTime: number;
        let callStart: number;
        let callEnd: number;

        let offsets: number[] = [];
        let successfulAttempts = 0;

        while (successfulAttempts < this.samplesPerRefresh) {
            let serverCold = true;
            while (serverCold) {
                callStart = performance.now();
                let response = <ServerTime>await this.getServerResponse();
                callEnd = performance.now();

                if (response.date) {
                    serverTime = new Date(response.date).getTime();
                    serverCold = response.serverCold;
                    if (!serverCold) {
                        successfulAttempts++;
                    } else {
                        console.log("server cold");
                    }

                    await this.sleep(1000);

                } else {
                    await this.sleep(10000);
                }
            }

            if (!serverCold) {
                let halfFlightTime = ((callEnd - callStart) / 2);
                let offset = (serverTime + halfFlightTime) - callEnd;

                offsets.push(offset);
            }
        }

        let avgOffset = this.getAverage(offsets);
        this.offsetTimes.push(avgOffset);
        this.refreshTimes.push(callEnd);
        this.performanceTimeOffsetAtSync = Date.now() - performance.now();

        if (this.enabled) {
            this.scheduleResync();
            this.scheduleLargeDriftCheck();
        }

        this.updateDriftRate();
        this.updateDriftError();
        this.logDriftRate();
    }

    private async sleep(msec: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, msec));
    }


    private logDriftRate(): void {
        let drift = this.driftRate;
        if (drift) {
            let driftPerMin = drift * 1000 * 60;
            console.log(`Drift ${Math.round(driftPerMin * 100) / 100} ms/min`);
        }
    }

    private getAverage(values: number[]): number {
        return values.reduce((a, b) => a + b) / values.length;
    }

    private getServerResponse(): Promise<ServerTime> {
        return this.http
            .get<ServerTime>("https://f6lxt414xb.execute-api.us-east-1.amazonaws.com/default/getTime")
            .toPromise().catch(er => {
                console.log("Error talking to server", er);

                return {
                    date: undefined,
                    serverCold: true
                } as ServerTime;
            });
    }

}



interface ServerTime {
    date: string;
    serverCold: boolean;
}
