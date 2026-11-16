import { Injectable } from '@angular/core';

/**
 * Which sidebar the person is using, for the few pages that change with it. Set by the secured shell once it knows (the grouped menu is a
 * per-business choice and always on for the counter roles). The pages of the old "Staff and quality" drawer use it: in the grouped menu every one
 * of them is its own entry, so they show their own heading and no strip of tabs; in the old menu they keep the strip.
 */
@Injectable({ providedIn: 'root' })
export class MenuModeService {
  grouped = false;
}
