// Regression tests for the detection engine. Run: node dev/test-detectors.js
require('../extension/detectors.js');
const P = globalThis.PasteGuard;

// Each case: text, values that MUST be masked, values that must NOT be masked
const CASES = [
  {
    name: 'Genomics onboarding (from the bug report)',
    text: `Helix Biosciences Inc. has requested access to our genomic data analysis platform. The principal investigator is Dr. Ananya Rao. Her primary email is ananya.rao@helixbio.com, with a backup at a.rao.research@gmail.com, and she can be reached at +1 617 555 0142 or on the lab line at (617) 555-0199. The billing contact is finance officer Rohan Deshmukh (rohan.deshmukh@helixbio.com), who set up the subscription using the test Visa card 4111 1111 1111 1111, expiry 12/29, CVV 123, billed to 21 Research Park Road, Cambridge, MA 02139. Helix was assigned client ID HLX-00482 and issued the API key sk_test_FAKE_9fA3xQ72LmPz48TcVb01, which gives it programmatic access to its sequencing datasets under Project Aurora, a Phase II oncology study involving 240 de-identified patient samples (study ID ONC-2026-0117). All data is stored in the ap-south-1 region, and the account is covered by a signed Data Processing Agreement and IRB approval number IRB-77421.`,
    mask: ['Helix Biosciences Inc', 'Ananya Rao', 'ananya.rao@helixbio.com', 'a.rao.research@gmail.com', '617 555 0142', '(617) 555-0199', 'Rohan Deshmukh',
      'rohan.deshmukh@helixbio.com', '4111 1111 1111 1111', '12/29', 'CVV 123', '21 Research Park Road, Cambridge, MA 02139', 'Helix was', 'HLX-00482',
      'sk_test_FAKE_9fA3xQ72LmPz48TcVb01', 'Project Aurora', 'ONC-2026-0117', 'IRB-77421'],
    keep: ['Phase II', '240 de-identified', 'ap-south-1', 'Data Processing Agreement', 'genomic data analysis platform'],
  },
  {
    name: 'Support email',
    text: `Hi team, forwarding the escalation from Northwind.\n\nPriya Shah (priya.shah@northwind.com, +91 98765 43210) says their card 4111 1111 1111 1111 was charged twice for invoice INV-2291.\n\nCan you draft a polite reply confirming a refund by Friday?`,
    mask: ['Northwind.', 'Priya Shah', 'priya.shah@northwind.com', '98765 43210', '4111 1111 1111 1111'],
    keep: ['INV-2291', 'Hi team', 'Friday'],
  },
  {
    name: 'Dev config',
    text: `OPENAI_API_KEY=sk-proj-9fK2mQx81LzT4vB7nW3cR5yH\nAWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nGITHUB_TOKEN=ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8\nDB_URL=postgres://admin:S3cretPass!@10.24.8.112:5432/prod\nDB_PASSWORD=hunter2024\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U\nWEBHOOK=https://api.example.com/hook?token=Zx81LzT4vB7nW3cR\nSIGNING=Q7mZp3Xc9LkT2vBn8RwY4hJd6FsGa1Ue`,
    mask: ['sk-proj-9fK2mQx81LzT4vB7nW3cR5yH', 'AKIAIOSFODNN7EXAMPLE', 'ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8', 'S3cretPass!', '10.24.8.112', 'hunter2024',
      'eyJhbGciOiJIUzI1NiJ9', 'Zx81LzT4vB7nW3cR', 'Q7mZp3Xc9LkT2vBn8RwY4hJd6FsGa1Ue'],
    keep: ['OPENAI_API_KEY=', 'postgres://admin:', 'https://api.example.com/hook?token='],
  },
  {
    name: 'Indian KYC + banking',
    text: `Name: Rahul Verma\nDOB: 14/08/1991\nPAN: ABCPV1234K\nAadhaar: 2341 2341 2346\nGSTIN: 27ABCDE1234F1Z5\nIFSC: HDFC0001234, account number 50100234567890\nUPI: rahul.verma@okicici\nAddress: Flat 4B, 12 MG Road, Bengaluru 560001\nOTP is 482913`,
    mask: ['Rahul Verma', '14/08/1991', 'ABCPV1234K', '2341 2341 2346', '27ABCDE1234F1Z5', 'HDFC0001234', '50100234567890', 'rahul.verma@okicici', '12 MG Road', '560001', '482913'],
    keep: ['Name:', 'DOB:'],
  },
  {
    name: 'Custom terms + propagation',
    text: `Status update on Project Falcon for Northwind: Priya Shah approved the budget. Northwind wants the pilot live by March. Project Falcon is on track and Priya will present on Monday.`,
    terms: 'Northwind => CLIENT',
    mask: ['Project Falcon for', 'Northwind:', 'Priya Shah', 'Northwind wants', 'Project Falcon is', 'Priya will'],
    keep: ['March', 'Monday', 'pilot live'],
  },
  {
    name: 'False alarms (nothing should be masked)',
    text: `Q3 revenue was $1,250,000, up from $980,000 in 2025.\nMeeting on 2026-10-27 at 10:30. Order #4111111111111112 shipped.\nTicket INV-2291, version 2.4.1, call extension 4521.\nCommit 3f9a2b7c1d4e5f60718293a4b5c6d7e8f9012345 fixed it. Run the my_long_variable_name_here function.\nThe project plan is on track; the account manager will call. Use a token of appreciation.\nRequest id 550e8400-e29b-41d4-a716-446655440000 timed out in us-east-1.\nThank you everyone, see you next week. Grace period ends in May.`,
    mask: [],
    keep: ['1,250,000', '2026-10-27', '4111111111111112', 'INV-2291', '2.4.1', '3f9a2b7c1d4e5f60718293a4b5c6d7e8f9012345', 'my_long_variable_name_here',
      'project plan', 'account manager', 'token of appreciation', '550e8400-e29b-41d4-a716-446655440000', 'us-east-1', 'everyone', 'Grace period'],
    expectNone: true,
  },
];

let fails = 0;
for (const c of CASES) {
  const res = P.mask(c.text, P.newVault(), { customTerms: P.parseCustomTerms(c.terms || '') });
  const errs = [];
  for (const v of c.mask) {
    // "masked" = the exact value no longer appears, or appears only partly
    const core = v.replace(/^(CVV |Dr\. )/, '').replace(/ (for|is|was|wants|will)$|[.:]$/, '');
    if (res.text.includes(core)) errs.push(`NOT masked: "${core}"`);
  }
  for (const v of c.keep) if (!res.text.includes(v)) errs.push(`wrongly masked: "${v}"`);
  if (c.expectNone && res.items.length) errs.push(`expected no masks, got: ${res.items.map(i => `${i.type}:${i.value}`).join(', ')}`);
  console.log(`${errs.length ? '✗ FAIL' : '✓ PASS'}  ${c.name}  (${res.items.length} masked: ${P.summarize(res.items)})`);
  errs.forEach(e => console.log('     ' + e));
  if (process.argv.includes('-v')) console.log('\n' + res.text + '\n');
  fails += errs.length ? 1 : 0;
}
console.log(fails ? `\n${fails} case(s) failing` : '\nAll cases pass');
process.exit(fails ? 1 : 0);
