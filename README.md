# Try The App
An [online version](https://jamesmikesell.github.io/ClockAdjuster/)  of the app is available for use on both mobile and desktop use.


# Clock Adjuster
[Clock Adjuster](https://jamesmikesell.github.io/ClockAdjuster/)  is an app for tuning mechanical time pieces.  Clock Adjuster uses a computer or mobile device's microphone to listen for a clock's ticks and tocks, and then displays their timings graphically.

The graphed times reveal if the clock is "out of beat", or if the clock is running fast or slow.  Additionally, since a computer or mobile device's internal clock can drift by several seconds per day, a network based atomic time source can be used for increased precision.


# Audio Frequency Isolation
Clock Adjuster features an audio filter spectrogram which allows a clock's ticking sound to be isolated from other background noises.

- Red line selecting the audio frequency where the clock sound is loudest

   <kbd><img src="https://github.com/jamesmikesell/ClockAdjuster/blob/master/readme-files/filter-select.jpg" height="300"></kbd>
- Filter strength adjusted, note elimination of background noise:

   <kbd><img src="https://github.com/jamesmikesell/ClockAdjuster/blob/master/readme-files/filtered.jpg" height="300"></kbd>


# Example Clock States
- **Clock Running Perfectly**

   <kbd><img src="https://github.com/jamesmikesell/ClockAdjuster/blob/master/readme-files/in-beat.jpg" height="300"></kbd>
- **Clock Out of Beat** 

   <kbd><img src="https://github.com/jamesmikesell/ClockAdjuster/blob/master/readme-files/out-of-beat.jpg" height="300"></kbd>

   Tocks are 50ms later than tick (clock rhythm would sound like [tick..tock........tick..tock........tick..tock]  instead of [tick.....tock.....tick.....tock.....tick.....tock])

- **Clock Running Fast** 
   
   <kbd><img src="https://github.com/jamesmikesell/ClockAdjuster/blob/master/readme-files/fast.jpg" height="300"></kbd>

   Clock is fast by 100ms per 15.09 seconds
