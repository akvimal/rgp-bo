import {Pipe, PipeTransform} from '@angular/core';
@Pipe({
  name: 'wrap',
})
export class TextWrapPipe implements PipeTransform {
  transform(value: string): string {
    const words = value.split(' ')
    let count = 0;
    console.log(words);
    
    const r = words.map(w => {
        count += w.length;
        if(count > 30)
            w += "\n"
        return w;
    })
    return `${r.join(' ')}`
  }
}