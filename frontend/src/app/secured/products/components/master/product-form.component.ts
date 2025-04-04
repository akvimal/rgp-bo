import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ProductsService } from "../../products.service";
import { MessageService } from 'primeng/api';
import { PropsService } from "src/app/shared/props.service";
import { Observable } from "rxjs";

@Component({
    templateUrl: 'product-form.component.html'
})
export class ProductFormComponent {

    productProps$?:Observable<any>;

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        title: new FormControl('', Validators.required),
        hsn: new FormControl(''),
        code: new FormControl(''),
        pack: new FormControl('1'),
        category: new FormControl(''),
        mfr: new FormControl(''),
        brand: new FormControl(''),
        description: new FormControl(''),
        props: new FormControl('')
      });

      pdata:any = {};
      props:any = [];
      brand:string = '';
      pack:string = '';

      isNew:boolean = false;
      
      constructor(private propsService:PropsService, 
        private service:ProductsService, 
        private messageService: MessageService,
        private router:Router,
        private route:ActivatedRoute){
          this.productProps$ = this.propsService.productProps$;
        }

      ngOnInit(){
        
        this.isNew = this.route.snapshot.url[0].path === 'new';
        // (this.isNew || this.form.controls['category'].value === '') && this.form.controls['category'].enable()

        // this.populateProps(this.form.controls['category'].value,undefined);
        const id = this.route.snapshot.paramMap.get('id'); 

        id && this.service.findById(id).subscribe((data:any) => {
          this.form.controls['id'].setValue(id);
          this.form.controls['title'].setValue(data.title);
          this.form.controls['hsn'].setValue(data.hsn);
          this.form.controls['code'].setValue(data.code);
          this.form.controls['pack'].setValue(data.pack);
          this.form.controls['category'].setValue(data.category);
          this.form.controls['mfr'].setValue(data.mfr);
          this.form.controls['brand'].setValue(data.brand);
          this.form.controls['description'].setValue(data.description);

          this.props = data.props;
          this.populateProps(data.category,data.props);
        })
      }

      populateProps(category:any,values:any){
        console.log('category: ',category);
        console.log('this.form.controls: ',this.form.controls);
        console.log(this.form.contains('props'));
        if(category == '' && this.form.contains('props'))
            this.form.removeControl('props')
        
        this.propsService.productProps$.subscribe((data:any) => {
          this.props = [];
          const catProps = data.find((d:any) => d.category === category);
          console.log('catProps: ',catProps);
          
          if(catProps){
            this.props = catProps.props;
            let pps = {};  
            for(let i=0;i<this.props.length;i++){
              const pname = this.props[i].id;
              const value = values ? values[pname] : this.props[i].default;
              const fc = new FormControl(value||'');
              // if(this.props[i].required) {
              //   console.log('setting ',this.props[i]);
                
              //   fc.setValidators(Validators.required);
              // }
              pps = {...pps, [pname]:fc}
            }
            console.log('setting prps form roup');
            
            this.form.setControl('props', new FormGroup(pps));
          } else {
            console.log('this.form.controls: ',this.form.controls);
            if(this.form.contains('props'))
            this.form.removeControl('props')
          }
        });
      }

      selectProps(event:any,values:any){
        console.log('populating props..');
        
          this.populateProps(event.target.value,undefined);
      }

      dataInput(type:any,key:any,event:any){
        
        // if(key === 'brand'){
        //   this.brand = event.target.value;
        // } else if(key === 'formulation'){
        //   this.pdata.formulation = event.target.value;
        // } else if(key === 'pack'){
        //   this.pack = event.target.value;
        // } 
        // let formattedTitle = (this.brand.trim().toUpperCase()||'') + ' ' + (this.pdata.formulation||'');
        // if(this.form.value.pack > 1)
        //   formattedTitle += ` ${this.pack}'s`;

        // this.form.controls['title'].setValue(formattedTitle);
      }
  
      // isPluralPacking(count:number,formulation:string){
      //   if(formulation === 'TAB' || formulation === 'CAP') {
      //     return count !== undefined ? count + "'s" : '';
      //   }
      //   return "";
      // }

      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        const obj = { 
          title: this.form.value.title.trim(), 
          hsn:this.form.value.hsn.trim(),
          code:this.form.value.code.trim(), 
          pack:this.form.value.pack, 
          category:this.form.value.category, 
          props: this.getTrimmedProps(this.form.value.props),
          mfr:this.form.value.mfr.trim(), 
          brand:this.form.value.brand?.trim(), 
          description: this.form.value.description?.trim() }
  // console.log('before product save',obj);
          // console.log(this.form.value.props);
          
  
        const id = this.form.value.id;
        if(id) {
          this.service.update(id, obj).subscribe(data => this.gotoList());
        }
        else {
          this.service.save(obj).subscribe((data:any) => {
            if(data.status == 'ERROR')
              this.messageService.add({ severity: 'error', summary: 'Error', detail: data.message });
            else {            
              this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Saved Suucessfully' });
              this.gotoList();
            }
          });
        }
      }
  
      getTrimmedProps(props:any){
        return props;
      }

      reset(){
        this.form.reset();
      }

      gotoList() {
        this.router.navigate(['/secure/products/list'],{relativeTo:this.route})
      }

      onLookupInput(event:any, field:string){
        this.form.controls[field].setValue(event.toUpperCase());
      }
      
}