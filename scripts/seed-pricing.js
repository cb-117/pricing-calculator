// Run: STORAGE_KEY=<key> node scripts/seed-pricing.js
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const ACCOUNT = 'sapricingcalc';
const KEY     = process.env.STORAGE_KEY;

if (!KEY) { console.error('Set STORAGE_KEY env var'); process.exit(1); }

const PRICING = {
  // ManageIT is a flat per-seat LIST rate. Support hours are an attribute of the
  // plan tier, not a price driver: Core = 8x5, Plus = extended 5x8, Pro = 24x7.
  // Every tier includes a SecureIT tier at no additional cost.
  //
  // Target pricing is quoted on a 3-year commitment at 0-50 users (3% volume
  // discount). Because the quote itself rounds up (see fmt/ceilD), list is the
  // whole-dollar figure whose 3-year quote lands exactly on target:
  //   target   list   list x 0.97   quoted at 3yr
  //   Core 105  108      104.76         105
  //   Plus 180  185      179.45         180
  //   Pro  250  257      249.29         250
  // Bands above 50 users discount further off the same list.
  //
  // minSeats is a floor, not a fee: a deal under it bills the minimum seat
  // count at whatever rate applies, so 15 x 105 = the $1,575/mo Core minimum.
  ManageIT: {
    Core: { rate: 108, hours: '8x5x5',    secureit: 'Core', minSeats: 15 },
    Plus: { rate: 185, hours: '5x8x5',    secureit: 'Core', minSeats: 25 },
    Pro:  { rate: 257, hours: '24x7x365', secureit: 'Plus', minSeats: 25 },
    EmailOnly: { '8x5x5': 25, '5x8x5': 40, '24x7x365': 60 },
  },
  // standalone = per device/month on its own.
  // bundled    = per device/month for a ManageIT customer. An upgrade is
  //              always the delta between two bundled rates, so a plan that
  //              includes Core pays 50-25=25 to reach Plus and 90-25=65 to
  //              reach Pro, and one that includes Plus pays 90-50=40 for Pro.
  // minDevices floors both a standalone SecureIT sale and a ManageIT upgrade
  // delta: 25 x 75 = the $1,875/mo standalone Plus minimum.
  SecureIT: {
    standalone: { Core: 30, Plus: 75, Pro: 125 },
    bundled:    { Core: 25, Plus: 50, Pro: 90  },
    minDevices: { Core: 15, Plus: 25, Pro: 25  },
  },
  AmplifyAI: {
    SuccessTeam: {
      Core: { base: 1000, includedUsers: 10, perUser: 35 },
      Plus: { base: 1900, includedUsers: 10, perUser: 50 },
    },
    Agent: 20,   // per managed agent / month
    FDE:   185,  // forward deployed engineering, per hour
  },
  AugmentIT:   { '8x5x5': 26, '5x8x5': 42, '24x7x365': 65 },
  Network:     { firewall: 105, switch: 55, ap: 25, workstation: 15, server: 210 },
  PenTest: {
    small: { monthly: 950,  label: 'Small (1–21 users)' },
    large: { monthly: 1400, label: 'Large (22–46 users)' },
    max:   { monthly: 1900, label: 'Max (47+ users)' },
  },
  Discounts: [
    { label: '0–25',    max: 25,       t: { 1: 0,   2: 1.5,  3: 3,  5: 6  } },
    { label: '26–50',   max: 50,       t: { 1: 0,   2: 1.5,  3: 3,  5: 6  } },
    { label: '51–100',  max: 100,      t: { 1: 3,   2: 4.5,  3: 6,  5: 9  } },
    { label: '101–250', max: 250,      t: { 1: 6,   2: 7.5,  3: 9,  5: 12 } },
    { label: '250+',         max: null,     t: { 1: 9,   2: 10.5, 3: 12, 5: 15 } },
  ],
};

// Rows that earlier revisions wrote and the app no longer reads.
const OBSOLETE = ['AugSecureIT'];

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

  for (const key of OBSOLETE) {
    try { await client.deleteEntity('pricing', key); console.log(`Removed stale row: ${key}`); }
    catch (e) { /* already gone */ }
  }
  console.log('Done.');
}

seed().catch(err => { console.error(err.message); process.exit(1); });
