/**
 * The drug register's rules as the counter applies them (pharmacy pack). The server checks the same things; this is so the bill says what is missing
 * before it is sent, and the Complete button waits.
 */
export interface ScheduleDetail {
    patient_name?: string; patient_address?: string; patient_age?: string;
    prescriber_name?: string; prescriber_reg_no?: string; prescriber_address?: string; rx_date?: string;
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

/** the schedules a drug on a bill may carry */
export const SCHEDULES = ['H1', 'H', 'X'];
