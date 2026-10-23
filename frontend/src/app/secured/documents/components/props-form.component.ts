import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { PropsService } from "src/app/shared/props.service";

@Component({
    selector: 'app-props-form',
    templateUrl: './props-form.component.html'
})
export class PropsFormComponent{
    
  @Input() entity = '';
  @Input() copyProps:any;
  @Input() default = true;
  @Input() validate = true;
  @Output() updated:EventEmitter<any> = new EventEmitter();

  categories:{category:string,props:any[]}[] = [];

    form:FormGroup = new FormGroup({
        category: new FormControl(''),
        props: new FormControl('')
    });
    props:any;
    
    constructor(private propsService:PropsService){}

    ngOnInit(){
      this.propsService.config$.subscribe(d => {
        const entObj = d.find((i:any) => i['entity'] === this.entity)
        const entConfigs = entObj && entObj['config'];
        this.categories = entConfigs;
      });
    }

    /** a phone number takes digits only, ten at most */
    phoneInput(key:any,event:any){
      const digits = String(event.target.value || '').replace(/\D/g,'').slice(0,10);
      if(digits !== event.target.value) event.target.value = digits;
      this.form.get(['props',key])?.setValue(digits);
      this.dataInput('phone',key,event);
    }

    phoneBad(key:any): boolean {
      const c = this.form.get(['props',key]);
      return !!c && !!c.value && c.invalid;
    }

    dataInput(type:any,key:any,event:any){
      if(this.validate)
      this.updated.emit({valid:this.form.valid, values:{category: this.form.controls['category'].value, props:this.mapToLabelValues(this.form.value)}});
      else
      this.updated.emit({category: this.form.controls['category'].value, props:this.mapToLabelValues(this.form.value)});
    }

    mapToLabelValues(values:any){
      let newval:any = []
      Object.keys(values['props']).forEach((k:string) => {
        const prop = this.props.find((p:any) => p['id'] == k);
        const s = prop['label'];
        newval.push({id:prop.id, label:s, value:values['props'][k]});
      });
      return newval;
    }
    
    selectProps(event:any,values:any){
      // console.log(event.target.value);
      this.form.controls['props'].reset();
      this.populateProps(event.target.value,undefined);
      this.dataInput(undefined,undefined,undefined);
    }

    populateProps(category:any,values:any){
      //TODO: on copying values, other properties also cleared
      this.props = [];

      const catProps = this.categories.find((c:any) => c.category == category);
      let pps = {};    
      if(catProps){
        this.props = catProps.props;
        for(let i=0;i<this.props.length;i++){
          const pname = this.props[i].id;
          const value = values ? values[pname] : (this.default ? this.props[i].default : '');
          const fc = new FormControl(value);
          const rules = [];
          if(this.validate && this.props[i].required) rules.push(Validators.required);
          if(this.validate && this.props[i].type === 'phone') rules.push(Validators.pattern(/^\d{10}$/));
          if(rules.length) fc.setValidators(rules);
          pps = {...pps, [pname]:fc}
        }
      }
      this.form.setControl('props', new FormGroup(pps));
    }

    copyData(event:any){
        this.populateProps(this.form.controls['category'].value, event.target.checked && this.copyProps);
        this.dataInput(undefined,undefined,undefined);       // tell the form what was copied in
    }
}