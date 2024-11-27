import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { SharedModule } from "primeng/api";
import { MultiSelectModule } from "primeng/multiselect";
import { TabViewModule } from "primeng/tabview";
import { DocumentListComponent } from "./components/document-list.component";
import { DocumentUploadComponent } from "./components/document-upload.component";
import { DocumentViewerComponent } from "./components/document-viewer.component";
import { FileUploadComponent } from "./components/file-upload.component";
import { PropsFormComponent } from "./components/props-form.component";

@NgModule({
    declarations: [
      DocumentUploadComponent,
      DocumentListComponent,
      DocumentViewerComponent,
      FileUploadComponent,
      PropsFormComponent
    ],
    imports: [
      SharedModule,
        FormsModule,
        ReactiveFormsModule,
        CommonModule,
        TabViewModule,
        MultiSelectModule,
        SharedModule
    ],
    exports: [DocumentUploadComponent,DocumentListComponent,DocumentViewerComponent]
  })
export class DocumentsModule{}