import { transferProblem } from './household-rules';

describe('transferProblem', () => {
  it('accepts a move within the balance', () => expect(transferProblem('DUE', 100, 250, false, 'moved to her own account')).toBeNull());
  it('refuses the same household', () => expect(transferProblem('DUE', 100, 250, true, 'moved to her own account')).toMatch(/same number/));
  it('refuses more than the balance', () => expect(transferProblem('CREDIT', 300, 250, false, 'moved to her own account')).toMatch(/250.00/));
  it('needs an amount, a kind and a reason', () => {
    expect(transferProblem('DUE', 0, 250, false, 'a good reason')).toMatch(/amount/);
    expect(transferProblem('X', 10, 250, false, 'a good reason')).toMatch(/dues or store credit/);
    expect(transferProblem('DUE', 10, 250, false, 'no')).toMatch(/why/);
  });
});
