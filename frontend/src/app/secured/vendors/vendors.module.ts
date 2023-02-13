import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { VendorFormComponent } from "./components/vendor-form.component";
import { VendorListComponent } from "./components/vendor-list.component";
import { VendorsComponent } from "./components/vendors.component";
import {TableModule} from 'primeng/table';

const routes: Routes = [
  { path: '', redirectTo: 'list'},
    {path: 'list', component: VendorListComponent, canActivate:[AuthGuard]},
    {path: 'new', component: VendorFormComponent, canActivate:[AuthGuard]},
    {path: 'edit/:id', component: VendorFormComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
        VendorsComponent,
        VendorListComponent,
        VendorFormComponent
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule.forChild(routes),
        SharedModule,
        TableModule
    ],
    exports: [RouterModule]
  })
export class VendorsModule{}