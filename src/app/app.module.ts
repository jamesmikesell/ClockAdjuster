import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AudioCaptureComponent } from './components/audio-capture/audio-capture.component';
import { ChartsModule } from 'ng2-charts';
import { SpectrogramComponent } from './components/spectrogram/spectrogram.component';

@NgModule({
  declarations: [
    AppComponent,
    AudioCaptureComponent,
    SpectrogramComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ChartsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
