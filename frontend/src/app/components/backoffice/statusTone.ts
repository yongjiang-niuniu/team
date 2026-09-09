export type BackOfficeStatusTone = 'slate' | 'emerald' | 'amber' | 'blue' | 'purple' | 'rose';

export function statusTone(value?: string | null): BackOfficeStatusTone {
  const normalized = (value || '').toLowerCase();
  if (['current', 'completed', 'done', 'paid', 'active', 'visible', 'approved'].includes(normalized)) {
    return 'emerald';
  }
  if (['pending', 'submitted', 'unknown', 'payment_pending', 'requires_payment'].includes(normalized)) {
    return 'amber';
  }
  if (['processing', 'ready', 'pickup', 'dropoff'].includes(normalized)) {
    return 'blue';
  }
  if (['rare'].includes(normalized)) {
    return 'purple';
  }
  if (['rejected', 'deleted', 'failed', 'cancelled', 'hidden'].includes(normalized)) {
    return 'rose';
  }
  return 'slate';
}
