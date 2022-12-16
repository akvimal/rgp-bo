import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../@core/auth/auth.service';

@Directive({
  selector: '[isAuth]'
})
export class IsAuthDirective {
    
    @Input() isAuth: string = '';

    constructor(private templateRef: TemplateRef<unknown>,
            private vcr: ViewContainerRef,
            private authService:AuthService) {}

    ngOnInit(): void {
      // if(this.isAuth.indexOf("$") > 0){
      //   console.log('should be checking field..',this.isAuth);
        
      // }
      // else {
        if ((this.isAuth.indexOf("$") > 0 && this.authService.isFieldAuthorized(this.isAuth)) ||
        this.authService.isActionAuthorized(this.isAuth)) {
          this.vcr.createEmbeddedView(this.templateRef);
        } else {
          this.vcr.clear();
        }
      // }
    }
}