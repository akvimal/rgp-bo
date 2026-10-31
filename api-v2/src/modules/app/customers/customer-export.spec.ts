import { EXPORT_MAX, buildAudienceCsv, csvCell, firstName, greetingName, properName } from './customer-export';

describe('customer export', () => {
  it('quotes cells and doubles inner quotes', () => {
    expect(csvCell('Jane "J" Doe')).toBe('"Jane ""J"" Doe"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(1500)).toBe('"1500"');
  });

  it('defuses spreadsheet formulas typed into a name or note', () => {
    for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd']) expect(csvCell(evil).startsWith(`"'`)).toBe(true);
    expect(csvCell('Anna-Lee')).toBe('"Anna-Lee"');
  });

  it('uses the first name without a title, and "there" when there is none', () => {
    expect(firstName('Dr. Sean Collins-Nolan')).toBe('Sean');
    expect(firstName('Ms. Kathleen Dickinson')).toBe('Kathleen');
    expect(firstName('')).toBe('there');
    expect(firstName(null)).toBe('there');
  });

  it('puts a name in proper case and never guesses a gender: first name, then Sir/Madam', () => {
    expect(properName('MADUBALAN')).toBe('Madubalan');
    expect(properName('madubalan')).toBe('Madubalan');
    expect(properName('McDonald')).toBe('McDonald');
    expect(greetingName('MADUBALAN')).toBe('Madubalan Sir/Madam');
    expect(greetingName('Dr. Sean Collins-Nolan')).toBe('Sean Sir/Madam');
    expect(greetingName('RAJA KUMAR')).toBe('Raja Sir/Madam');
    expect(greetingName('')).toBe('Sir/Madam');
    expect(greetingName(null)).toBe('Sir/Madam');
  });

  it('builds a header, a row per customer with the message filled in, and a closing line that says who took it', () => {
    const { csv, count } = buildAudienceCsv(
      [{ name: 'Erin Bruen', mobile: '9342293344', segment: 'Regular', tier: 'Bronze', reason: 'due back', spend12: 4240 }],
      'Hello {name}, we are here.', 'Business Head', '31 Oct 2026, 10:00');
    const lines = csv.split('\r\n');
    expect(count).toBe(1);
    expect(lines[0]).toContain('"Mobile"');
    expect(lines[1]).toContain('"9342293344"');
    expect(lines[1]).toContain('Hello Erin Sir/Madam, we are here.');
    expect(lines[lines.length - 1]).toContain('taken by Business Head on 31 Oct 2026, 10:00');
  });

  it('never holds more than the limit in one download', () => {
    const many = Array.from({ length: EXPORT_MAX + 50 }, (_, i) => ({ name: `C${i}`, mobile: '9876543210', segment: 'Regular', tier: null, reason: '', spend12: 0 }));
    expect(buildAudienceCsv(many, '', 'x', 'now').count).toBe(EXPORT_MAX);
  });
});
