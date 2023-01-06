import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PosComponent } from './pos.component';
import { CustInquiryComponent } from './custinquiry.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },{
    path: 'pos', component: PosComponent
  },
  { path: 'custinquiry', component: CustInquiryComponent },
  {
    path: 'secure', 
    loadChildren: () => import('./secured/secured.module').then(m => m.SecuredModule)
  },
  { path: '**', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }