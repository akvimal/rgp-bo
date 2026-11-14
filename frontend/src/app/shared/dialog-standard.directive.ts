import { Directive, Input, OnInit, Self } from "@angular/core";
import { Dialog } from "primeng/dialog";

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';
/** the four dialog widths (docs/planning/UI_PATTERNS.md section 3) */
export const DIALOG_WIDTHS: Record<DialogSize, number> = { sm: 30, md: 36, lg: 48, xl: 64 };

/**
 * The size nearest to a width given in the template: "34rem", "480px", "30vw" or "40%". A width in rem or px is compared with the four sizes (a tie goes
 * to the larger); a width in vw or % is a share of the screen, read as md up to 35 and lg above. No width at all gives null: the dialog keeps the width
 * of its content.
 */
export function dialogSizeOf(style: any): DialogSize | null {
    const w = style && style.width != null ? String(style.width).trim() : '';
    const m = /^(\d+(?:\.\d+)?)(rem|px|vw|%)$/.exec(w);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (m[2] === 'vw' || m[2] === '%') return n <= 35 ? 'md' : 'lg';
    const rem = m[2] === 'px' ? n / 16 : n;
    let best: DialogSize = 'sm';
    let gap = Infinity;
    (Object.keys(DIALOG_WIDTHS) as DialogSize[]).forEach((k) => {
        const g = Math.abs(DIALOG_WIDTHS[k] - rem);
        if (g < gap || g === gap) { best = k; gap = g; }
    });
    return best;
}

/**
 * Makes every `<p-dialog>` follow the same rules without editing each one: one of four widths (sm 30, md 36, lg 48, xl 64rem; the nearest to the width
 * it asked for), never wider than the screen (96vw), not draggable. A dialog with no width keeps the width of its content. Click-outside-to-close is
 * left to the dialog: it is off unless the template turns it on, which is done for read-only viewers only.
 *
 *   <p-dialog ... dialogSize="lg">     pick a size by name
 *   <p-dialog ... dialogSize="keep">   leave this one alone
 */
@Directive({ selector: 'p-dialog' })
export class DialogStandardDirective implements OnInit {
    @Input() dialogSize: DialogSize | 'keep' | '' = '';

    constructor(@Self() private dialog: Dialog) {}

    ngOnInit() {
        if (this.dialogSize === 'keep') return;
        const size: DialogSize | null = this.dialogSize && this.dialogSize in DIALOG_WIDTHS ? (this.dialogSize as DialogSize) : dialogSizeOf(this.dialog.style);
        this.dialog.style = { ...(this.dialog.style || {}), ...(size ? { width: DIALOG_WIDTHS[size] + 'rem' } : {}), maxWidth: '96vw' };
        this.dialog.draggable = false;
    }
}
