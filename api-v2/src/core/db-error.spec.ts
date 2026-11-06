import { BadRequestException } from '@nestjs/common';
import { friendlyDbMessage, isDbError, messageOf, userError } from './db-error';

const db = (code: string, extra: any = {}) => Object.assign(new Error(extra.message ?? 'db error'), { code }, extra);

describe('plain words for database refusals', () => {
  it('names what the person did for a known duplicate', () => {
    const e = db('23505', { constraint: 'product_price2_unique', message: 'duplicate key value violates unique constraint "product_price2_unique"' });
    expect(friendlyDbMessage(e)).toMatch(/already has that price/);
    expect(friendlyDbMessage(e)).not.toMatch(/constraint|duplicate key/);
  });
  it('still gives a clean sentence for a duplicate it does not know', () => {
    expect(friendlyDbMessage(db('23505', { constraint: 'something_new_uq' }))).toBe('That already exists. Change what you entered and try again.');
  });
  it('says when something is still in use, and when something it points at is gone', () => {
    expect(friendlyDbMessage(db('23503', { detail: 'Key (id)=(5) is still referenced from table "sale_item".' }))).toMatch(/still used by other records/);
    expect(friendlyDbMessage(db('23503', { detail: 'Key (vendor_id)=(9) is not present in table "vendor".' }))).toMatch(/no longer exists/);
  });
  it('names the missing field', () => {
    expect(friendlyDbMessage(db('23502', { column: 'sale_price' }))).toBe('Please fill in sale price.');
  });
  it('recognises the database even when only the text is left', () => {
    expect(isDbError(new Error('Failed to add price: duplicate key value violates unique constraint "x"'))).toBe(true);
    expect(isDbError(new Error('The invoice has no lines.'))).toBe(false);
  });
  it('leaves an ordinary message alone', () => {
    expect(friendlyDbMessage(new Error('Enter the amount.'))).toBeNull();
    expect(messageOf(new Error('Enter the amount.'))).toBe('Enter the amount.');
  });
  it('turns a failure into an HTTP error a person can read', () => {
    expect(userError(db('23505', { constraint: 'product_un' }), 'add the product').getStatus()).toBe(409);
    expect(userError(db('23502', { column: 'title' }), 'add the product').getStatus()).toBe(400);
    expect(userError(new Error('socket hang up'), 'add the price').message).toMatch(/Could not add the price/);
    const kept = new BadRequestException('Enter a price.');
    expect(userError(kept, 'add the price')).toBe(kept);
  });
  it('never shows a constraint name in a list of failures', () => {
    expect(messageOf(db('23505', { constraint: 'vendor_un' }))).toBe('A vendor with that name already exists.');
  });
});
