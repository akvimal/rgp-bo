import { createHmac } from 'crypto';
import { mobileForms, nextStatus, parseWebhook, verifySignature } from './whatsapp-webhook';

describe('whatsapp webhook rules', () => {
  const body = Buffer.from('{"a":1}');
  const sig = (secret: string, b: Buffer) => 'sha256=' + createHmac('sha256', secret).update(b).digest('hex');

  it('accepts only a correct signature made with the app secret', () => {
    expect(verifySignature(body, sig('s3cret', body), 's3cret')).toBe(true);
    expect(verifySignature(body, sig('other', body), 's3cret')).toBe(false);
    expect(verifySignature(Buffer.from('{"a":2}'), sig('s3cret', body), 's3cret')).toBe(false);
    expect(verifySignature(body, undefined, 's3cret')).toBe(false);
    expect(verifySignature(body, 'sha256=zz', 's3cret')).toBe(false);
    expect(verifySignature(body, sig('s3cret', body), '')).toBe(false);          // no secret configured: nothing is trusted
    expect(verifySignature(undefined, sig('s3cret', body), 's3cret')).toBe(false);
  });

  it('reads receipts and replies from a webhook body', () => {
    const p = parseWebhook({
      entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: '111' },
        statuses: [
          { id: 'wamid.A', status: 'delivered', timestamp: '1760000000' },
          { id: 'wamid.B', status: 'failed', errors: [{ code: 131026, title: 'Undeliverable', error_data: { details: 'Message undeliverable' } }] },
          { id: 'x', status: 'weird' },
        ],
        messages: [{ from: '919876543210', type: 'text', text: { body: 'STOP' } }, { from: '919876543211', type: 'image' }],
      } }] }],
    });
    expect(p.statuses).toHaveLength(2);
    expect(p.statuses[0]).toMatchObject({ id: 'wamid.A', state: 'delivered' });
    expect(p.statuses[0].at?.getTime()).toBe(1760000000000);
    expect(p.statuses[1]).toMatchObject({ id: 'wamid.B', state: 'failed', error: 'Message undeliverable' });
    expect(p.inbound).toEqual([{ from: '919876543210', text: 'STOP', phoneNumberId: '111' }, { from: '919876543211', text: '', phoneNumberId: '111' }]);
  });

  it('ignores bodies of another shape', () => {
    for (const b of [null, {}, { entry: 'x' }, { entry: [{ changes: [{ field: 'other', value: { statuses: [{ id: 'a', status: 'read' }] } }] }] }]) {
      expect(parseWebhook(b)).toEqual({ statuses: [], inbound: [] });
    }
  });

  it('moves a message forward only', () => {
    expect(nextStatus('PENDING', 'sent')).toBe('SENT');
    expect(nextStatus('SENT', 'delivered')).toBe('DELIVERED');
    expect(nextStatus('SENT', 'read')).toBe('READ');
    expect(nextStatus('READ', 'delivered')).toBeNull();
    expect(nextStatus('DELIVERED', 'delivered')).toBeNull();
    expect(nextStatus('SENT', 'failed')).toBe('FAILED');
    expect(nextStatus('DELIVERED', 'failed')).toBeNull();
    expect(nextStatus('FAILED', 'delivered')).toBeNull();
    expect(nextStatus('SKIPPED', 'read')).toBeNull();
  });

  it('lists the ways a mobile may be stored', () => {
    expect(mobileForms('919876543210')).toEqual(['9876543210', '919876543210', '+919876543210']);
    expect(mobileForms('12345')).toEqual([]);
  });
});
