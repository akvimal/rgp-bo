import { Injectable } from "@angular/core";
import { ConfirmationService } from "primeng/api";

interface ConfirmDeleteOptions {
    /** What is being removed, e.g. "vendor", "role". Defaults to "record". */
    entity?: string;
    /** Extra sentence about the consequence, shown after the name. */
    consequence?: string;
    /** Verb shown on the confirm button + header. Defaults to "Delete". */
    verb?: string;
    /** The action can be reversed later: drop the "cannot be undone" sentence. */
    reversible?: boolean;
}

/**
 * Thin wrapper over PrimeNG's ConfirmationService so every destructive action in
 * the app shows the same styled dialog with a clear message (what is being
 * removed + that it cannot be undone) instead of a bare browser confirm().
 */
@Injectable()
export class ConfirmService {

    constructor(private confirmation: ConfirmationService) {}

    confirmDelete(name: string, onConfirm: () => void, options: ConfirmDeleteOptions = {}): void {
        const entity = options.entity || 'record';
        const verb = options.verb || 'Delete';
        const safeName = this.escape(name || entity);
        const consequence = options.consequence ? ` ${this.escape(options.consequence)}` : '';

        this.confirmation.confirm({
            header: `${verb} ${entity}`,
            message: `This will ${verb.toLowerCase()} <b>${safeName}</b>.${consequence}${options.reversible ? '' : ' This action cannot be undone.'}`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: verb,
            rejectLabel: 'Cancel',
            acceptButtonStyleClass: 'p-button-danger',
            rejectButtonStyleClass: 'p-button-text',
            accept: () => onConfirm(),
        });
    }

    /** A plain confirmation for an action that is not a delete: the lines are shown as a list (text is escaped), the button says what it does. */
    confirmAction(header: string, lines: string[], acceptLabel: string, onConfirm: () => void, lead = 'Please confirm:'): void {
        const list = lines.length ? `<ul class="mb-0 mt-2">${lines.map(l => `<li>${this.escape(l)}</li>`).join('')}</ul>` : '';
        this.confirmation.confirm({
            header,
            message: `${this.escape(lead)}${list}`,
            icon: 'pi pi-question-circle',
            acceptLabel,
            acceptButtonStyleClass: 'p-button-primary',
            rejectLabel: 'Cancel',
            rejectButtonStyleClass: 'p-button-text',
            accept: () => onConfirm(),
        });
    }

    private escape(value: string): string {
        return String(value).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c] as string));
    }
}
