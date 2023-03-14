import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Observable } from "rxjs";
import { ConfigService } from "src/app/shared/config.service";
import { ProductsService } from "../products.service";

@Component({
    templateUrl: 'product-form.component.html'
})
export class ProductFormComponent{

    productProps$?:Observable<any>;

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        title: new FormControl('',Validators.required),
        hsn: new FormControl(''),
        code: new FormControl(''),
        pack: new FormControl(''),
        category: new FormControl(''),
        mfr: new FormControl(''),
        brand: new FormControl(''),
        description: new FormControl(''),
        props: new FormControl('')
      });

      pdata:any = {};
      props:any = [];
      brand:string = '';
      
      constructor(private configService:ConfigService, 
        private service:ProductsService, 
        private router:Router,
        private route:ActivatedRoute){}

      ngOnInit(){
        this.productProps$ = this.configService.props;

        this.populateProps(this.form.controls['category'].value,undefined);
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
        this.configService.props.subscribe((data:any) => {
          this.props = [];
          const catProps = data.find((d:any) => d.category === category);
          if(catProps){
            this.props = catProps.props;
            let pps = {};  
            for(let i=0;i<this.props.length;i++){
              const pname = this.props[i].id;
              const value = values ? values[pname] : this.props[i].default;
              const fc = new FormControl(value);
              if(this.props[i].required) {
                fc.setValidators(Validators.required);
              }
              pps = {...pps, [pname]:fc}
            }
            this.form.setControl('props', new FormGroup(pps));  
          }
          
        });
      }

      selectProps(event:any,values:any){
        this.populateProps(event.target.value,undefined);
      }

      dataInput(type:any,key:any,event:any){
        
        if(key === 'brand'){
          this.brand = event.target.value;
        } else if(key === 'formulation'){
          this.pdata.formulation = event.target.value;
        } 

        this.form.controls['title'].setValue(((this.brand.trim().toUpperCase()||'') + ' ' + (this.pdata.formulation||'')))
      }
  
      isPluralPacking(count:number,formulation:string){
        if(formulation === 'TAB' || formulation === 'CAP') {
          return count !== undefined ? count + "'s" : '';
        }
        return "";
      }

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
          mfr:this.form.value.mfr.trim(), 
          brand:this.form.value.brand.trim(), 
          props: this.form.value.props, 
          description: this.form.value.description.trim() }
  
        const id = this.form.value.id;
        if(id) {
          this.service.update(id, obj).subscribe(data => this.gotoList());
        }
        else {
          this.service.save(obj).subscribe(data => this.gotoList());
        }
  
      }
  
      reset(){
        this.form.reset();
      }

      gotoList() {
        this.router.navigate(['/secure/products/list'],{relativeTo:this.route})
      }
}