import { dialogSizeOf } from './dialog-standard.directive';

describe('dialog size', () => {
  it('maps the widths in use to the four sizes', () => {
    expect(dialogSizeOf({ width: '30rem' })).toBe('sm');
    expect(dialogSizeOf({ width: '32rem' })).toBe('sm');
    expect(dialogSizeOf({ width: '34rem' })).toBe('md');
    expect(dialogSizeOf({ width: '36rem' })).toBe('md');
    expect(dialogSizeOf({ width: '40rem' })).toBe('md');
    expect(dialogSizeOf({ width: '42rem' })).toBe('lg');
    expect(dialogSizeOf({ width: '50rem' })).toBe('lg');
    expect(dialogSizeOf({ width: '52rem' })).toBe('lg');
    expect(dialogSizeOf({ width: '58rem' })).toBe('xl');
    expect(dialogSizeOf({ width: '64rem' })).toBe('xl');
  });
  it('reads px and screen shares', () => {
    expect(dialogSizeOf({ width: '480px' })).toBe('sm');
    expect(dialogSizeOf({ width: '30vw' })).toBe('md');
    expect(dialogSizeOf({ width: '40vw' })).toBe('lg');
    expect(dialogSizeOf({ width: '50%' })).toBe('lg');
  });
  it('leaves a dialog with no usable width alone', () => {
    expect(dialogSizeOf(null)).toBeNull();
    expect(dialogSizeOf({})).toBeNull();
    expect(dialogSizeOf({ width: 'auto' })).toBeNull();
    expect(dialogSizeOf({ width: 'calc(100% - 2rem)' })).toBeNull();
  });
});
