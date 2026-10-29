import { PackConfig } from '../pack-config';

/**
 * What the pharmacy pack adds to the app's configuration: the words a pharmacy uses, the product attributes of a medicine (schedule, composition, chronic,
 * generic, the document it needs) and of an OTC product, the prescription document, and the drug licences. These used to be one static file for everyone
 * (frontend/src/assets/props.json); a business that is not a pharmacy now gets none of it.
 */
export const PHARMACY_PRODUCT_PROPS: any[] = [
  {
    "category": "Medicine",
    "props": [
      {
        "id": "schedule",
        "label": "Schedule",
        "type": "SINGLE-SELECT",
        "required": true,
        "filter": true,
        "choices": [
          {
            "label": "H",
            "value": "H"
          },
          {
            "label": "H1",
            "value": "H1"
          },
          {
            "label": "X",
            "value": "X"
          },
          {
            "label": "Other",
            "value": "Other"
          }
        ]
      },
      {
        "id": "composition",
        "label": "Composition",
        "type": "TEXT",
        "searchable": true
      },
      {
        "id": "chronic",
        "label": "Chronic",
        "type": "CHECK"
      },
      {
        "id": "generic",
        "label": "Generic",
        "type": "CHECK"
      },
      {
        "id": "document",
        "label": "Document Required On Sale",
        "type": "SINGLE-SELECT",
        "filter": true,
        "choices": [
          {
            "label": "Prescription",
            "value": "Prescription"
          },
          {
            "label": "Age Proof",
            "value": "Age Proof"
          }
        ]
      }
    ]
  },
  {
    "category": "OTC",
    "props": [
      {
        "id": "subcategory",
        "label": "Sub Category",
        "type": "SINGLE-SELECT",
        "filter": true,
        "choices": [
          {
            "label": "Supplement",
            "value": "Supplement"
          },
          {
            "label": "Surgical",
            "value": "Surgical"
          },
          {
            "label": "Personal Care",
            "value": "Personal Care"
          },
          {
            "label": "Device",
            "value": "Device"
          },
          {
            "label": "Treatment",
            "value": "Treatment"
          },
          {
            "label": "Other",
            "value": "Other"
          }
        ]
      },
      {
        "id": "noexpiry",
        "label": "No expiry date",
        "type": "CHECK"
      }
    ]
  }
];

export const PHARMACY_DOCUMENT_PROPS: any[] = [
  {
    "category": "Prescription",
    "props": [
      {
        "id": "prescdate",
        "label": "Date",
        "type": "date",
        "required": true
      },
      {
        "id": "doctorname",
        "label": "Doctor Name",
        "required": true
      },
      {
        "id": "doctorphone",
        "label": "Doctor Phone",
        "type": "phone",
        "required": true
      },
      {
        "id": "ptntname",
        "label": "Patient Name",
        "required": true
      },
      {
        "id": "ptntmobile",
        "label": "Patient Phone",
        "type": "phone",
        "required": true
      }
    ]
  }
];

export const pharmacyConfig: PackConfig = {
  labels: { item: 'medicine', items: 'medicines', Item: 'Medicine', Items: 'Medicines', shop: 'pharmacy', Shop: 'Pharmacy', professional: 'pharmacist', Professional: 'Pharmacist' },
  productProps: PHARMACY_PRODUCT_PROPS,
  documentProps: PHARMACY_DOCUMENT_PROPS,
  licenceTypes: [
    { code: 'RETAIL_20_21', label: 'Retail drug licence (Form 20 / 21)', for: ['store', 'vendor'] },
    { code: 'WHOLESALE_20B_21B', label: 'Wholesale drug licence (Form 20B / 21B)', for: ['store', 'vendor'] },
    { code: 'MANUFACTURING', label: 'Drug manufacturing licence', for: ['vendor'] },
  ],
};
