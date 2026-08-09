export function getExpiryThresholdDays(): number {
  const parsed = parseInt(process.env.EXPIRY_THRESHOLD_DAYS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
