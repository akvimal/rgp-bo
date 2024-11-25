import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { TabViewModule } from "primeng/tabview";
import { DocumentUploadComponent } from "./components/document-upload.component";
import { DocumentViewerComponent } from "./components/document-viewer.component";
import { FileUploadComponent } from "./components/file-upload.component";

const routes: Routes = [];

@NgModule({
    declarations: [
      DocumentUploadComponent,
      DocumentViewerComponent,
      FileUploadComponent
    ],
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        TabViewModule,
    ],
    exports: [RouterModule,DocumentUploadComponent,DocumentViewerComponent]
  })
export class DocumentsModule{}