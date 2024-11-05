import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../@core/auth/auth.service';

@Directive({
  selector: '[isNavAuth]'
})
export class IsNavAuthDirective {
    
    // @Input() isAuth: string = '';

    constructor(private templateRef: TemplateRef<unknown>,
            private vcr: ViewContainerRef, private router : Router,
            private authService:AuthService) {
              // console.log('URL:',this.router.url);
              if(this.authService.isUrlAuthorized(this.router.url)){
                this.vcr.createEmbeddedView(this.templateRef);
              }
              else {
                this.vcr.clear();
              }
            }

    // ngOnInit(): void {
      
    //     console.log('URL:',this.router.url);


    //     if ((this.isAuth.indexOf("$") > 0 && this.authService.isFieldAuthorized(this.isAuth)) ||
    //     this.authService.isActionAuthorized(this.isAuth)) {
    //       this.vcr.createEmbeddedView(this.templateRef);
    //     } else {
    //       this.vcr.clear();
    //     }
    //   // }
    // }
}