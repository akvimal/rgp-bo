const axios = require('axios');
const reader = require('xlsx');

const apihost = 'http://localhost:3000'
const email = 'vimal@test.com';
const password = 'test123';

let items = []
const vendorid = 1;
const todayDt= new Date();
const todayStr = todayDt.getFullYear() + '-' +todayDt.getMonth()+1 + '-' +todayDt.getDate();

axios.post(apihost+'/auth/login',{email,password})
    .then(async (data) => {
        const token = data.data.token;
        //load file for data
        loadFile();

        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            let product;
            let invoice;
            // console.log('item: ',item);
            try {
                const productRes = await axios.post(apihost+'/products',{
                    title:item.Product,
                    mfr: item.MFR,
                    hsn:item.HSN,
                    props: {composition:item.Composition,packing:item.Pack}},{
                    headers: getAuthHeader(token)});
                
                product = productRes.data;
            } catch(error){
                console.log('Product Insert Error: ',error);
            }

            try {
                const invoiceRes = await axios.post(apihost+'/purchases', {
                            invoiceno: item.Invoice_No,
                            invoicedate: parseInvDate(item.Invoice_Date),
                            status: "RECEIVED",
                            vendorid: vendorid,
                            comments: 'Batch Upload'
                        },{headers: getAuthHeader(token)});           
                
                invoice = invoiceRes.data;
                
                if(invoice !== undefined && invoice.message !== undefined && invoice.message.endsWith('exists.')) {
                    let inv = await axios.get(`${apihost}/purchases?invoiceno=${item.Invoice_No}&vendorid=${vendorid}`,
                    {headers: getAuthHeader(token)});    

                    invoice = inv.data;
                }
            } catch(error){
                console.log('Invoice Insert Error: ',error);
            }

            try {
                const invoiceItemRes = await axios.post(apihost+'/purchaseitems', 
                    {
                        invoiceid: invoice.id,
                        productid: product.id,
                        batch: item.Batch,
                        expdate: parseExpDate(item.Expiry),
                        ptrcost: (item.Rate/item.Pack).toFixed(2),
                        mrpcost: (item.MRP/item.Pack).toFixed(2),
                        taxpcnt: item.Tax,
                        qty: (item.Qty*item.Pack),
                        total: getTotal(item.Qty,item.Rate,item.Tax),
                        status: 'VERIFIED',
                        comments: 'Batch Upload'
                },{headers: getAuthHeader(token)});
                // console.log('item: ',invoiceItemRes.data);
                const sale_price = getSalePrice(item.Rate,item.MRP,2.5);
                console.log(`Rate: ${item.Rate} MRP: ${item.MRP}  Sale: ${sale_price}, Save: ${Math.round(((item.MRP-sale_price)/item.MRP)*100)}%, Margin: ${((sale_price-item.Rate)/item.Rate)*100}`);
                const price = await axios.post(apihost+'/products/price', 
                    {
                        itemid: invoiceItemRes.data.id,
                        effdate: todayStr,
                        price: (sale_price/item.Pack).toFixed(2),
                        comments: "Batch load"
                },{headers: getAuthHeader(token)})
            } catch (error) {
                console.log('Invoice Item Insert Error: ',error);   
            }
        }
    })

    function getSalePrice(ptr,mrp,sellermargin){
        const sale = ptr * sellermargin;
        const pcnt = (mrp - sale) / mrp;
        if(pcnt > .50) {
            return sale;
        } else if(sale >= mrp) {
            const pr = ptr * 1.3;
            return pr >= mrp ? mrp : pr;
        }
        else {
            return getSalePrice(ptr,mrp,sellermargin - 0.05);
        }
    }

    function getTotal(qty,price,tax){
        const total = qty * price * (1 + (tax/100));
        return total.toFixed(2);
    }

    function getAuthHeader(token){
        return {
            "Content-type": "application/json",
            Authorization: 'Bearer '+ token,
        }
    }

    function parseInvDate(dt){
        const arr = dt.split('/');
        return '20'+arr[2] + '-' + arr[1] + '-' + arr[0];
    }

    function parseExpDate(dt){
        const arr = dt.split('/');
        return arr[2] + '-' + arr[0] + '-' +arr[1];
    }

    function loadFile(){
        const file = reader.readFile('./test.xlsx');
        const sheets = file.SheetNames
  
        for(let i = 0; i < sheets.length; i++)
        {
            const temp = reader.utils.sheet_to_json(
                    file.Sheets[file.SheetNames[i]])
            temp.forEach((res) => {
                items.push(res)
            })
        }
    }