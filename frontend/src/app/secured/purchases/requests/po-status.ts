/** What a purchase order's stored status is called on screen. One chip, so the list and the order say the same thing. */
export interface PoStatus { label: string; cls: string; hint: string; }

export function poStatus(order: any): PoStatus {
    const status = `${order?.status || ''}`.toUpperCase();
    switch (status) {
        case 'PENDING':
            return { label: 'Draft', cls: 'bg-secondary', hint: 'Not sent yet: items can still be added and changed' };
        case 'PENDING_APPROVAL':
            return { label: 'Awaiting approval', cls: 'bg-warning text-dark', hint: 'Waiting for someone allowed to approve it' };
        case 'SUBMITTED':
            return { label: 'Submitted', cls: 'bg-success', hint: order?.approvalstatus === 'Approved' ? 'Approved and submitted' : 'Submitted' };
        case 'REJECTED':
            return { label: 'Rejected', cls: 'bg-danger', hint: 'Sent back: change it and submit again' };
        default:
            return { label: status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ') : '-', cls: 'bg-info', hint: '' };
    }
}

/** the statuses a person can filter by, in the order an order moves through them */
export const PO_STATUS_FILTERS: { value: string; label: string }[] = [
    { value: 'ALL', label: 'All status' },
    { value: 'PENDING', label: 'Draft' },
    { value: 'PENDING_APPROVAL', label: 'Awaiting approval' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'REJECTED', label: 'Rejected' },
];
