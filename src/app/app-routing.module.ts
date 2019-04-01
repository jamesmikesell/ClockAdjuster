import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AudioCaptureComponent } from './components/audio-capture/audio-capture.component';

const routes: Routes = [
  {
    component: AudioCaptureComponent,
    path: ''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
