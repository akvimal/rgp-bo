const WEEKDAYS_PLURAL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** what to know about a leave type before asking: how its days build up, the stretch limit and the advised days (shared by My HR and the calendar) */
export function leaveTypeHint(t: any, role: string | null | undefined): string {
  if (!t || !t.paid) return "";
  const bits: string[] = [];
  if (t.accrual_mode === "MONTHLY") bits.push("Days build up month by month.");
  if (t.max_consecutive) bits.push(`At most ${t.max_consecutive} day${t.max_consecutive === 1 ? "" : "s"} together${t.stretch_counts_offs !== false ? " (weekly offs and holidays in between count)" : ""}.`);
  const mine = !t.advice_roles?.length || (role && t.advice_roles.includes(role));
  if (mine && t.advice_from_day && t.advice_to_day) bits.push(`Advised between the ${t.advice_from_day}th and the ${t.advice_to_day}th of the month.`);
  if (mine && t.advice_avoid_weekdays?.length) bits.push("Advised not on " + t.advice_avoid_weekdays.map((d: number) => WEEKDAYS_PLURAL[d]).join(" or ") + ".");
  return bits.join(" ");
}
