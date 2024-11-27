import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { PropsService } from "src/app/shared/props.service";

@Component({
    selector: 'app-props-form',
    templateUrl: './props-form.component.html'
})
export class PropsFormComponent{
    
  @Input() entity = '';
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
      this.updated.emit({valid:this.form.valid, values:this.form.value});
    }
    
    selectProps(event:any,values:any){
      this.populateProps(event.target.value,undefined);
    }

    populateProps(category:any,values:any){
      
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
}