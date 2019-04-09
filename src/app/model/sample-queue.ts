export class SampleQueue {
    private currentIndex = 0;
    private endTime: number;
    private buffers: Float32Array;
    private full = false;

    constructor(private maxValues: number) {
        this.buffers = new Float32Array(maxValues);
    }

    clear(): void {
        this.full = false;
        this.currentIndex = 0;
    }

    add(endTime: number, buffer: Float32Array): void {
        this.endTime = endTime;

        let size = buffer.length;
        if (!this.full && (this.currentIndex + size) >= this.maxValues)
            this.full = true;

        for (let i = 0; i < size; i++) {
            this.buffers[this.currentIndex] = buffer[i];
            this.currentIndex = this.currentIndex >= (this.maxValues - 1) ? 0 : this.currentIndex + 1;
        }
    }

    getAvg(): number {
        let total = 0;
        for (let i = this.length - 1; i >= 0; i--) {
            total += this.buffers[i];
        }

        let avg = total / this.length;
        return avg;
    }

    private get length(): number {
        if (!this.full)
            return this.currentIndex;

        return this.maxValues;
    }

    getRms(): number {
        let total = 0;
        for (let i = this.length - 1; i >= 0; i--) {
            const value = this.buffers[i];
            total += value * value;
        }

        let rms = Math.sqrt(total / this.length);
        return rms;
    }

    getData(count?: number): [number, Float32Array] {
        if (count < 0)
            count = undefined;

        let arraySize = count ? Math.min(count, this.length) : this.length;
        let returnData = new Float32Array(arraySize);

        let indexToGrab = this.currentIndex;
        for (let i = arraySize - 1; i >= 0; i--) {
            indexToGrab = indexToGrab <= 0 ? arraySize - 1 : indexToGrab - 1;
            returnData[i] = this.buffers[indexToGrab];
        }

        return [this.endTime, returnData];
    }


}

