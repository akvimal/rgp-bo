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
  
  @Input() reset:boolean = false;
  @Output() updated:EventEmitter<any> = new EventEmitter();

   
  categories:{category:string,props:any[]}[] = []

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

    dataInput(type:any,key:any,event:any){
      // console.log(this.form);
      
      this.updated.emit({valid:this.form.valid, values:{category: this.form.controls['category'].value, props:this.mapToLabelValues(this.form.value)}});
    }

    mapToLabelValues(values:any){
      // console.log(this.props);
      // console.log(values);
      let newval:any = []
      Object.keys(values['props']).forEach((k:string) => {
        const prop = this.props.find((p:any) => p['id'] == k);
        const s = prop['label'];
        newval.push({label:s, value:values['props'][k]})
        // obj = {...obj, `'${s}'`: values['props'][k]};
      })
      // values['props'] = 
      // console.log(newval);
      
      return newval;
    }
    
    selectProps(event:any,values:any){
      this.populateProps(event.target.value,undefined);
    }

    populateProps(category:any,values:any){
      //TODO: on copying values, other properties also cleared
      this.props = [];
      const catProps = this.categories.find((c:any) => c.category == category);
          
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
    }

    copyData(event:any){
        this.populateProps(this.form.controls['category'].value, event.target.checked && this.copyProps);
    }
}