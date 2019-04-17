import { TestBed, async } from '@angular/core/testing';
import { SampleQueue } from './sample-queue';

describe('Queue Test', () => {

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [],
            providers: []
        })
            .compileComponents();
    }));

    it('check average after over-filled', () => {
        let queue = new SampleQueue(15);
        queue.add(0, new Float32Array([0, 1, 2, 3, 4]));
        queue.add(5, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(10, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(15, new Float32Array([15, 16, 17, 18, 19]));

        //Should be average of values 5-19 = 12
        expect(queue.getAvg())
            .toEqual(12);
    });

    it('check average after at capacity', () => {
        let queue = new SampleQueue(15);
        queue.add(5, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(10, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(15, new Float32Array([15, 16, 17, 18, 19]));

        expect(queue.getAvg())
            .toEqual(12);
    });

    it('check average after below capacity', () => {
        let queue = new SampleQueue(20);
        queue.add(5, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(10, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(15, new Float32Array([15, 16, 17, 18, 19]));

        expect(queue.getAvg())
            .toEqual(12);
    });













    it('check rms after over-filled', () => {
        let queue = new SampleQueue(15);
        queue.add(0, new Float32Array([0, 1, 2, 3, 4]));
        queue.add(5, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(10, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(15, new Float32Array([15, 16, 17, 18, 19]));

        //Should be rms of values 5-19 = 12
        expect(queue.getRms())
            .toEqual(12.754084313139327);
    });

    it('check rms after at capacity', () => {
        let queue = new SampleQueue(15);
        queue.add(5, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(10, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(15, new Float32Array([15, 16, 17, 18, 19]));

        expect(queue.getRms())
            .toEqual(12.754084313139327);
    });

    it('check rms after below capacity', () => {
        let queue = new SampleQueue(20);
        queue.add(5, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(10, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(15, new Float32Array([15, 16, 17, 18, 19]));

        expect(queue.getRms())
            .toEqual(12.754084313139327);
    });













    it('check result set overfilled', () => {
        let queue = new SampleQueue(15);
        queue.add(10, new Float32Array([0, 1, 2, 3, 4]));
        queue.add(50, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(100, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(150, new Float32Array([15, 16, 17, 18, 19]));

        let data = queue.getData();

        let time = data[0];
        expect(time)
            .toEqual(150);

        expect(data[1])
            .toEqual(new Float32Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
    });




    it('check result set really overfilled', () => {
        let queue = new SampleQueue(10);
        queue.add(10, new Float32Array([0, 1, 2, 3, 4]));
        queue.add(50, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(100, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(150, new Float32Array([15, 16, 17, 18, 19]));
        queue.add(200, new Float32Array([20, 21, 22, 23, 24]));
        queue.add(250, new Float32Array([25, 26, 27, 28, 29]));
        queue.add(300, new Float32Array([30, 31, 32, 33, 34]));
        queue.add(350, new Float32Array([35, 36, 37, 38, 39]));

        let data = queue.getData();

        let time = data[0];
        expect(time)
            .toEqual(350);

        expect(data[1])
            .toEqual(new Float32Array([30, 31, 32, 33, 34, 35, 36, 37, 38, 39]));
    });

    it('check result set at capacity', () => {
        let queue = new SampleQueue(15);
        queue.add(50, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(100, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(150, new Float32Array([15, 16, 17, 18, 19]));

        let data = queue.getData();

        let time = data[0];
        expect(time)
            .toEqual(150);

        expect(data[1])
            .toEqual(new Float32Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
    });



    it('check result set underfilled', () => {
        let queue = new SampleQueue(20);
        queue.add(50, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(100, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(150, new Float32Array([15, 16, 17, 18, 19]));

        let data = queue.getData();

        let time = data[0];
        expect(time)
            .toEqual(150);

        expect(data[1])
            .toEqual(new Float32Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
    });


    it('check result set limited size', () => {
        let queue = new SampleQueue(15);
        queue.add(10, new Float32Array([0, 1, 2, 3, 4]));
        queue.add(50, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(100, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(150, new Float32Array([15, 16, 17, 18, 19]));


        let data = queue.getData(3);

        let time = data[0];
        expect(time)
            .toEqual(150);

        expect(data[1])
            .toEqual(new Float32Array([17, 18, 19]));
    });


    it('check result set limited size, oversized sample size', () => {
        let queue = new SampleQueue(15);
        queue.add(10, new Float32Array([0, 1, 2, 3, 4]));
        queue.add(50, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(100, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(150, new Float32Array([15, 16, 17, 18, 19]));


        let data = queue.getData(300);

        let time = data[0];
        expect(time)
            .toEqual(150);

        expect(data[1])
            .toEqual(new Float32Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
    });


    it('check result set limited size, invalid sample size', () => {
        let queue = new SampleQueue(15);
        queue.add(10, new Float32Array([0, 1, 2, 3, 4]));
        queue.add(50, new Float32Array([5, 6, 7, 8, 9]));
        queue.add(100, new Float32Array([10, 11, 12, 13, 14]));
        queue.add(150, new Float32Array([15, 16, 17, 18, 19]));


        let data = queue.getData(-1);

        let time = data[0];
        expect(time)
            .toEqual(150);

        expect(data[1])
            .toEqual(new Float32Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
    });


    it('single add greater than capacity', () => {
        let queue = new SampleQueue(3);
        queue.add(150, new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));


        let data = queue.getData(-1);

        let time = data[0];
        expect(time)
            .toEqual(150);

        expect(data[1])
            .toEqual(new Float32Array([17, 18, 19]));
    });
});
