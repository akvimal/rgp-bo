import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Standard patterns for typed input. The same patterns the API applies (api-v2/src/core/input-rules.ts), so a screen refuses what the API would.
 */

/** a person's name: starts with a letter (any script), then letters, marks, spaces and . ' - only, at least two letters in all */
export const PERSON_NAME = /^(?=(?:.*\p{L}){2})[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

export const PERSON_NAME_MESSAGE = "Enter a real name: letters, spaces and . ' - only (at least 2 letters, no digits or symbols).";

/** true when the text, trimmed and with spaces collapsed, is a valid person's name (blank is not judged here) */
export function isPersonName(v: any): boolean {
  return PERSON_NAME.test(String(v ?? '').trim().replace(/\s+/g, ' '));
}

/**
 * A validator for a person's name box. Blank passes (use required where the name is needed). A name left exactly as it was loaded passes too,
 * so an old record with an odd name can still be saved after editing something else; a name typed or changed must match the pattern.
 */
export function personNameValidator(original: () => string | null | undefined = () => null): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = String(c.value ?? '').trim().replace(/\s+/g, ' ');
    if (!v) return null;
    const was = String(original() ?? '').trim().replace(/\s+/g, ' ');
    if (was && v === was) return null;
    return PERSON_NAME.test(v) ? null : { personName: true };
  };
}
