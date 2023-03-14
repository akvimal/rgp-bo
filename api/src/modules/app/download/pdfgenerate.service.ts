
import * as h2p from 'html-pdf';
import * as hbs from 'handlebars';
import * as fs from 'fs';

export class PdfGenerateService {

    //https://github.com/marcbachmann/node-html-pdf

    generate(templatefile,data):any{
        return new Promise((resolve,reject)=>{
            const options = {
                format: "A4",
                orientation: "portrait",
                border: {
                    top: "10mm",
                    right: "10mm",
                    bottom: "10mm",
                    left: "30mm"
                },
                header: {
                    height: "10mm",
                    contents: `<div style="text-align: center;">
                    <h3>Ramesh Generic Pharmacy</h3>
                    <p>Thillai Ganga Nagar, Chennai</p>
                    </div>`
                },
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