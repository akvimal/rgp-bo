/**
 * The drug register's rules as the counter applies them (pharmacy pack). The server checks the same things; this is so the bill says what is missing
 * before it is sent, and the Complete button waits.
 */
export interface ScheduleDetail {
    patient_name?: string; patient_address?: string; patient_age?: string;
    prescriber_name?: string; prescriber_reg_no?: string; prescriber_address?: string; rx_date?: string;
    /** how the prescription stands, and what goes with it (see RX_LABELS) */
    rx_basis?: string; rx_note?: string; rx_due?: string; rx_document_id?: number;
}

const t = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** what is still missing: the patient's name and address, the prescriber's name, and the prescriber's registration number or address */
export function detailProblems(d: ScheduleDetail | null | undefined, today: string = new Date().toISOString().slice(0, 10)): string[] {
    const out: string[] = [];
    if (t(d?.patient_name).length < 2) out.push("the patient's name");
    if (t(d?.patient_address).length < 5) out.push("the patient's address");
    if (t(d?.prescriber_name).length < 3) out.push("the prescriber's name");
    if (!t(d?.prescriber_reg_no) && t(d?.prescriber_address).length < 5) out.push("the prescriber's registration number or address");
    const rx = t(d?.rx_date);
    if (rx && (!/^\d{4}-\d{2}-\d{2}$/.test(rx) || rx > today)) out.push('a valid prescription date (not in the future)');
    return out;
}

/** how a supply stands with its prescription; the three marked auto are set by the panel when a prescription is used, attached or uploaded */
export const RX_LABELS: { [k: string]: string } = {
    ATTACHED: 'Prescription attached', ON_FILE: 'Prescription on file', LAST_SUPPLY: 'Same as last supply', SEEN: 'Seen, not kept',
    REGULAR: 'Regular customer, earlier prescription', LATER: 'Will bring it later', COULD_NOT: 'Customer could not provide', OTHER: 'Other',
};
/** the ones a person chooses */
export const RX_CHOICES = ['SEEN', 'REGULAR', 'LATER', 'COULD_NOT', 'OTHER'];
/** a prescription promised for later is chased for at most this many days */
export const LATER_MAX_DAYS = 30;

const plus = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const laterDefault = (today: string = new Date().toISOString().slice(0, 10)) => plus(today, 7);
export const laterLast = (today: string = new Date().toISOString().slice(0, 10)) => plus(today, LATER_MAX_DAYS);

/** what the prescription status still needs: a few words for "Other", and the day and a customer on record for "Will bring it later" */
export function rxProblems(d: ScheduleDetail | null | undefined, hasPrescription: boolean, customerOnRecord: boolean, today: string = new Date().toISOString().slice(0, 10)): string[] {
    const out: string[] = [];
    if (hasPrescription) return out;
    const b = t(d?.rx_basis);
    if (b === 'OTHER' && t(d?.rx_note).length < 3) out.push('a few words on why there is no prescription');
    if (b === 'LATER') {
        if (!customerOnRecord) out.push('a customer on record to ask for it (add the customer to the bill)');
        const due = t(d?.rx_due);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today || due > plus(today, LATER_MAX_DAYS)) out.push(`the day it will be brought (within ${LATER_MAX_DAYS} days)`);
    }
    return out;
}

/** the schedules a drug on a bill may carry */
export const SCHEDULES = ['H1', 'H', 'X'];
