
import * as h2p from 'html-pdf';
import * as hbs from 'handlebars';
import * as fs from 'fs';

export class PdfGenerateService {

    generate(templatefile,data):any{
        return new Promise((resolve,reject)=>{
            const options = {
                format: "A4",
                orientation: "landscape",
                border: {
                    top: "10mm",
                    right: "20mm",
                    bottom: "10mm",
                    left: "20mm"
                },
                // header: {
                //     height: "10mm",
                //     contents: `${data}`
                // },
                // footer: {
                //     height: "10mm",
                //     contents: {
                //         first: 'Cover page',
                //         2: 'Second page', // Any page number is working. 1-based index
                //         default: '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>', // fallback value
                //         last: 'Last Page'
                //     }
                // }
            };
            
            const template = fs.readFileSync(templatefile, 'utf8');
            const html = hbs.compile(template)(data);
        
            h2p.create(html,options).toStream(function(err, stream){
                if(err)
                    reject(err)
                else
                    resolve(stream)
            });

        })
    }
}