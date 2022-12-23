const maxm = 2.5
const minm = 0.3
const mins = 0.5

// const rate = 10
// const mrp = 14

// let margin = (mrp - rate) / rate;

function calcSale(rate,mrp){

    let maxmargin = rate * (1+maxm);
    let minmargin = rate * (1+minm);
    
    let price = maxmargin;
    
    let minsaving = mrp - (mrp * mins);

    // console.log(`ptr: ${rate}, max-margin: ${maxmargin}, min-margin: ${minmargin}, min-saving: ${minsaving}, mrp: ${mrp}`);

    if(maxmargin > minsaving ) {
        price = (minsaving <= minmargin) ? minmargin : minsaving;
        // if(minsaving <= minmargin) {
        //     price = minmargin;
        // }
        // else {
        //     price = minsaving;
        // }
    }

    return price;
}



const rate = 0.68;
const mrp = 1;
// for (let mrp = rate; mrp <= 100; mrp++) {
//     let sale = ((mrp - rate) / rate) <= minm ? mrp: calcSale(rate,mrp)  
//     console.log(`ptr: ${rate}, mrp: ${mrp}, sale: ${sale}, margin: ${Math.round(((sale-rate)/rate)*100)}%, saving: ${Math.round(((mrp-sale)/mrp)*100)}%`);
// }
let sale = ((mrp - rate) / rate) <= minm ? mrp: calcSale(rate,mrp)  
    console.log(`ptr: ${rate}, mrp: ${mrp}, sale: ${sale}, margin: ${Math.round(((sale-rate)/rate)*100)}%, saving: ${Math.round(((mrp-sale)/mrp)*100)}%`);
// let sp = rate * maxm;


// console.log('mrp:',mrp);
// console.log(`price: ${Math.round(price)}, margin: ${(Math.round((price-totalcost)/totalcost)*100)}%, saving: ${(Math.round((mrp-price)/price)*100)}%`);
