import { Component } from "@angular/core";
import { SaleDeliveryService } from "../sale-delivery.service";
import { SaleDelivery } from "../models/sale-delivery.model";
import { DeliveryPartnersService } from "../../settings/delivery-partners/delivery-partners.service";

@Component({
    selector:'app-sale-delivery',
    templateUrl: 'sale-delivery.component.html'
})
export class SaleDeliveryComponent {

    deliveries:SaleDelivery[] = []
    editingDelivery:SaleDelivery = {}
    showEditor = false
    currentMonthLabel = ''
    summary = {
        total: 0,
        pending: 0,
        delivered: 0,
        failed: 0,
        charge: 0,
        cost: 0
    }
    monthSummary = {
        total: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        charge: 0,
        cost: 0,
        successRate: 0,
        failureRate: 0
    }
    deliveryPartners: any[] = []

    constructor(
        private service:SaleDeliveryService,
        private deliveryPartnerService: DeliveryPartnersService
    ){}

    ngOnInit(){
        this.currentMonthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
        this.deliveryPartnerService.findAll().subscribe((data: any) => this.deliveryPartners = data);
        this.loadDeliveries();
    }

    loadDeliveries(){
        this.service.findAll().subscribe((result:any) => {
            this.deliveries = result;
            this.recalculateSummary();
        });
    }

    recalculateSummary(){
        this.summary = this.deliveries.reduce((acc:any, item:SaleDelivery) => {
            const status = (item.status || 'Pending').toLowerCase();
            acc.total += 1;
            acc.charge += +(item.charges || 0);
            acc.cost += +(item.actualcost || 0);

            if(status === 'delivered'){
                acc.delivered += 1;
            } else if(status === 'failed'){
                acc.failed += 1;
            } else {
                acc.pending += 1;
            }

            return acc;
        }, {
            total: 0,
            pending: 0,
            delivered: 0,
            failed: 0,
            charge: 0,
            cost: 0
        });

        const now = new Date();
        const currentMonthDeliveries = this.deliveries.filter((item: SaleDelivery) => {
            const sourceDate = item.deliveredat || item.deliverydate || item.sale?.billdate || item.bookeddate;
            if(!sourceDate){
                return false;
            }

            const date = new Date(sourceDate);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });

        const monthSummary = currentMonthDeliveries.reduce((acc:any, item:SaleDelivery) => {
            const status = (item.status || 'Pending').toLowerCase();
            acc.total += 1;
            acc.charge += +(item.charges || 0);
            acc.cost += +(item.actualcost || 0);

            if(status === 'delivered'){
                acc.delivered += 1;
            } else if(status === 'failed'){
                acc.failed += 1;
            } else {
                acc.pending += 1;
            }

            return acc;
        }, {
            total: 0,
            delivered: 0,
            failed: 0,
            pending: 0,
            charge: 0,
            cost: 0,
            successRate: 0,
            failureRate: 0
        });

        monthSummary.successRate = monthSummary.total ? Math.round((monthSummary.delivered / monthSummary.total) * 100) : 0;
        monthSummary.failureRate = monthSummary.total ? Math.round((monthSummary.failed / monthSummary.total) * 100) : 0;
        this.monthSummary = monthSummary;
    }

    editDelivery(delivery:SaleDelivery){
        const customer = delivery.sale?.customer || {};
        this.editingDelivery = {
            ...delivery,
            receivername: delivery.receivername || customer.name || '',
            receiverphone: delivery.receiverphone || customer.mobile || '',
            receiveraddress: delivery.receiveraddress || customer.address || '',
            deliverymethod: delivery.deliverymethod || 'Staff Delivery',
            status: delivery.status || 'Pending',
            paymentmode: delivery.paymentmode || 'Prepaid',
            collectionstatus: delivery.collectionstatus || 'Pending',
            confirmed: !!delivery.confirmed
        };
        this.showEditor = true;
    }

    closeEditor(){
        this.showEditor = false;
        this.editingDelivery = {};
    }

    useSaleCustomerInfo(){
        const customer = this.editingDelivery.sale?.customer || {};
        this.editingDelivery.receivername = customer.name || '';
        this.editingDelivery.receiverphone = customer.mobile || '';
        this.editingDelivery.receiveraddress = customer.address || '';
    }

    onStatusChange(){
        if(this.editingDelivery.status !== 'Failed'){
            this.editingDelivery.failurereason = '';
        }

        if(this.editingDelivery.status === 'Delivered' && !this.editingDelivery.deliveredat){
            this.editingDelivery.deliveredat = new Date().toISOString().slice(0, 16);
        }
    }

    onConfirmedChange(){
        if(this.editingDelivery.confirmed){
            this.editingDelivery.confirmedat = this.editingDelivery.confirmedat || new Date().toISOString().slice(0, 16);
        } else {
            this.editingDelivery.confirmedby = '';
            this.editingDelivery.confirmedat = '';
        }
    }

    saveDelivery(){
        if(this.editingDelivery.deliverymethod !== 'Courier'){
            this.editingDelivery.courierpartner = '';
        }
        this.service.save(this.editingDelivery).subscribe(() => {
            this.closeEditor();
            this.loadDeliveries();
        });
    }
}
