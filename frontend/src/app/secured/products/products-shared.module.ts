import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { DialogModule } from "primeng/dialog";
import { SharedModule } from "src/app/shared/shared.module";
import { PriceEstimatorComponent } from "./components/price/price-estimator.component";
import { PricingBreakdownComponent } from "./components/pricing-breakdown.component";

/**
 * Shared module for product-related components that need to be used
 * across the application without importing the full ProductsModule
 * (which includes routing configuration that can conflict)
 */
@NgModule({
    declarations: [
        PriceEstimatorComponent,
        PricingBreakdownComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        DialogModule,
        SharedModule
    ],
    exports: [
        PriceEstimatorComponent,
        PricingBreakdownComponent
    ]
})
export class ProductsSharedModule {}
