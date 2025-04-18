import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from 'src/environments/environment';
import { AuthModule } from './@core/auth/auth.module';
import { AuthTokenInterceptor } from './@core/auth/auth-token.interceptor';
import { RouterModule } from '@angular/router';
import { PosComponent } from './pos.component';
import { ToastModule } from 'primeng/toast';

@NgModule({
  declarations: [
    AppComponent,
    PosComponent
  ],
  imports: [
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    ToastModule,
    RouterModule,
    CommonModule,
    FormsModule,
    AuthModule,
    StoreDevtoolsModule.instrument({
      name: 'Pharma App',
      logOnly: environment.production
    })
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthTokenInterceptor,
      multi: true,
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
