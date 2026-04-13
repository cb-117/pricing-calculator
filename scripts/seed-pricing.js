// Run: STORAGE_KEY=<key> node scripts/seed-pricing.js
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const ACCOUNT = 'sapricingcalc';
const KEY     = process.env.STORAGE_KEY;

if (!KEY) { console.error('Set STORAGE_KEY env var'); process.exit(1); }

const PRICING = {
  ManageIT: {
    '8x5x5':    { Core: 80,  Plus: 135, Pro: 170, EmailOnly: 25 },
    '5x8x5':    { Core: 110, Plus: 160, Pro: 200, EmailOnly: 40 },
    '24x7x365': { Core: 155, Plus: 210, Pro: 250, EmailOnly: 60 },
  },
  SecureIT:    { Core: 15, Plus: 50, Pro: 90 },
  AugSecureIT: { Plus: 60, Pro: 100 },
  AugmentIT:   { '8x5x5': 26, '5x8x5': 42, '24x7x365': 65 },
  Network:     { firewall: 105, switch: 55, ap: 25, workstation: 15, server: 210 },
  PenTest: {
    small: { monthly: 950,  label: 'Small (1\u201321 users)' },
    large: { monthly: 1400, label: 'Large (22\u201346 users)' },
    max:   { monthly: 1900, label: 'Max (47+ users)' },
  },
  Discounts: [
    { label: '0\u201325',    max: 25,       t: { 1: 0,   2: 1.5,  3: 3,  5: 6  } },
    { label: '26\u201350',   max: 50,       t: { 1: 0,   2: 1.5,  3: 3,  5: 6  } },
    { label: '51\u2013100',  max: 100,      t: { 1: 3,   2: 4.5,  3: 6,  5: 9  } },
    { label: '101\u2013250', max: 250,      t: { 1: 6,   2: 7.5,  3: 9,  5: 12 } },
    { label: '250+',         max: null,     t: { 1: 9,   2: 10.5, 3: 12, 5: 15 } },
  ],
};

async function seed() {
  const credential = new AzureNamedKeyCredential(ACCOUNT, KEY);
  const client = new TableClient(
    `https://${ACCOUNT}.table.core.windows.net`,
    'PricingConfig',
    credential
  );

  try { await client.createTable(); console.log('Table created.'); }
  catch (e) { console.log('Table already exists.'); }

  for (const [key, value] of Object.entries(PRICING)) {
    await client.upsertEntity({ partitionKey: 'pricing', rowKey: key, data: JSON.stringify(value) });
    console.log(`Seeded: ${key}`);
  }
  console.log('Done.');
}

seed().catch(err => { console.error(err.message); process.exit(1); });
