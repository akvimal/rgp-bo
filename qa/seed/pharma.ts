/** Realistic-ish pharmacy catalogue generation. */
import { faker } from '@faker-js/faker';

const MOLECULES = [
  'Paracetamol', 'Amoxicillin', 'Azithromycin', 'Cetirizine', 'Metformin', 'Amlodipine',
  'Atorvastatin', 'Pantoprazole', 'Omeprazole', 'Losartan', 'Telmisartan', 'Montelukast',
  'Levocetirizine', 'Ibuprofen', 'Diclofenac', 'Aceclofenac', 'Ciprofloxacin', 'Levofloxacin',
  'Cefixime', 'Doxycycline', 'Ondansetron', 'Domperidone', 'Ranitidine', 'Metronidazole',
  'Fluconazole', 'Prednisolone', 'Salbutamol', 'Budesonide', 'Glimepiride', 'Sitagliptin',
  'Rosuvastatin', 'Clopidogrel', 'Aspirin', 'Furosemide', 'Hydrochlorothiazide', 'Insulin Glargine',
  'Thyroxine', 'Folic Acid', 'Ferrous Ascorbate', 'Calcium Carbonate', 'Vitamin D3', 'Vitamin B12',
  'Multivitamin', 'Zinc', 'ORS', 'Povidone Iodine', 'Chlorhexidine', 'Diclofenac Gel',
];
const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Drops', 'Cream', 'Gel', 'Sachet'];
const STRENGTHS = ['5mg', '10mg', '20mg', '25mg', '40mg', '50mg', '100mg', '250mg', '500mg', '650mg', '1g', '5ml', '10ml'];
const BRANDS = ['Cipla', 'Sun Pharma', 'Dr Reddy', 'Mankind', 'Alkem', 'Lupin', 'Zydus', 'Torrent', 'Intas', 'Abbott', 'GSK', 'Pfizer'];
const CATEGORIES = ['Analgesic', 'Antibiotic', 'Antacid', 'Antihypertensive', 'Antidiabetic', 'Antihistamine', 'Supplement', 'Respiratory', 'Dermatology', 'Cardiac'];
const TAX_RATES = [5, 12, 12, 18];

export function makeProduct(i: number) {
  const molecule = faker.helpers.arrayElement(MOLECULES);
  const strength = faker.helpers.arrayElement(STRENGTHS);
  const form = faker.helpers.arrayElement(FORMS);
  const brand = faker.helpers.arrayElement(BRANDS);
  return {
    title: `${molecule} ${strength} ${form}`.trim() + ` [${brand.slice(0, 3).toUpperCase()}${1000 + i}]`,
    taxpcnt: faker.helpers.arrayElement(TAX_RATES),
    category: faker.helpers.arrayElement(CATEGORIES),
    brand,
    mfr: brand + ' Ltd',
    hsn: faker.helpers.arrayElement(['30049099', '30041000', '30042000', '30049011']),
    code: `P${String(i).padStart(5, '0')}`,
    pack: faker.helpers.arrayElement([1, 10, 15, 30]),
  };
}

export function makeVendor(i: number) {
  const name = `${faker.helpers.arrayElement(['MediSupply', 'HealthBridge', 'CityCare', 'PharmaOne', 'Wellness', 'CoreMed', 'Apex', 'Nova'])} ${faker.helpers.arrayElement(['Distributors', 'Pharma', 'Agencies', 'Traders', 'Supplies'])}`;
  return {
    name: `${name} ${i}`,
    contactname: faker.person.fullName(),
    contactphone: faker.string.numeric(10),
    address: faker.location.streetAddress(true),
    gstn: `${faker.string.numeric(2)}${faker.string.alpha({ length: 5, casing: 'upper' })}${faker.string.numeric(4)}${faker.string.alpha({ length: 1, casing: 'upper' })}1Z${faker.string.numeric(1)}`,
    comments: '',
  };
}

export function makeCustomer(i: number) {
  return {
    name: faker.person.fullName(),
    mobile: `9${faker.string.numeric(9)}`,
    email: faker.internet.email().toLowerCase(),
    locality: faker.location.city(),
    address: faker.location.streetAddress(),
    area: faker.location.county(),
    srctype: faker.helpers.arrayElement(['Walk-in', 'Referral', 'Online', 'Camp']),
    srcdesc: '',
  };
}

export function salePrice(taxpcnt: number) {
  const ptr = faker.number.float({ min: 8, max: 380, fractionDigits: 2 });
  const margin = faker.number.float({ min: 0.12, max: 0.35, fractionDigits: 2 });
  const price = +(ptr * (1 + margin)).toFixed(2);
  const mrp = +(price * faker.number.float({ min: 1.05, max: 1.25, fractionDigits: 2 })).toFixed(2);
  return { ptr, price, mrp };
}

export { faker };
