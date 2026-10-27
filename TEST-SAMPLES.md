# PasteGuard test samples

All data below is **fake**: test card numbers, example keys, made-up people. Safe to paste anywhere.

## Setup (once)

1. Install the extension: unzip `pasteguard-extension.zip` → `chrome://extensions` → **Developer mode** on → **Load unpacked** → select the `pasteguard` folder.
2. Click the 🛡️ PasteGuard icon and paste this into **Always mask these**:
   ```
   Northwind => CLIENT
   Priya Shah => PERSON
   Project Falcon => PROJECT
   ```
3. Open https://chatgpt.com (or claude.ai / gemini.google.com) and start a new chat.

For each test: copy the text block, paste it into the chat box (**Cmd+V**), and compare with **"You should see"**. You don't need to send the message to test masking.

---

## Test 1: Customer support email (the everyday case)

```
Hi team, forwarding the escalation from Northwind.

Priya Shah (priya.shah@northwind.com, +91 98765 43210) says their card 4111 1111 1111 1111 was charged twice for invoice INV-2291.

Can you draft a polite reply confirming a refund by Friday?
```

**You should see** in the chat box:
```
Hi team, forwarding the escalation from [CLIENT_1].

[PERSON_1] ([EMAIL_1], [PHONE_1]) says their card [CARD_1] was charged twice for invoice INV-2291.
```
✅ Pop-up: **"PasteGuard masked 5 items"**: 1 client, 1 person, 1 email, 1 phone, 1 card number
✅ `INV-2291` is **not** masked (it's an invoice number, not sensitive)

**Then test the restore:** press Enter to send. The AI replies with things like "Hi [PERSON_1]…", but on your screen you should see **"Hi Priya Shah…"**, with the real values highlighted in teal and a dotted underline.

---

## Test 2: Developer pasting secrets

```
Our deploy is failing. Here's the config:

OPENAI_API_KEY=sk-proj-9fK2mQx81LzT4vB7nW3cR5yH
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
GITHUB_TOKEN=ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8
DB_HOST=10.24.8.112
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U

Why would the connection time out?
```

**You should see:**
```
OPENAI_API_KEY=[API_KEY_1]
AWS_ACCESS_KEY_ID=[API_KEY_2]
GITHUB_TOKEN=[API_KEY_3]
DB_HOST=[IP_1]
Authorization: Bearer [JWT_1]
```
✅ Pop-up: **5 items**: 3 API keys, 1 IP address, 1 auth token (JWT)

---

## Test 3: Indian + international ID numbers

```
Please summarise this KYC record:
Name: Rahul Verma
PAN: ABCPV1234K
Aadhaar: 2341 2341 2346
Bank IBAN: DE89 3704 0044 0532 0130 00
US SSN (for the FATCA form): 123-45-6789
Phone: 9876543210
```

**You should see:**
```
Name: [PERSON_1]
PAN: [PAN_1]
Aadhaar: [AADHAAR_1]
Bank IBAN: [IBAN_1]
US SSN (for the FATCA form): [SSN_1]
Phone: [PHONE_1]
```
✅ **5 items** masked
✅ In v0.2, `Rahul Verma` is masked too (found from the `Name:` label)

---

## Test 4: Your custom terms

```
Status update on Project Falcon for Northwind: Priya Shah approved the budget. Northwind wants the pilot live by March.
```

**You should see:**
```
Status update on [PROJECT_1] for [CLIENT_1]: [PERSON_1] approved the budget. [CLIENT_1] wants the pilot live by March.
```
✅ Both mentions of Northwind become the **same** `[CLIENT_1]`

---

## Test 5: Things that should NOT be masked (false-alarm check)

```
Q3 revenue was $1,250,000, up from $980,000 in 2025.
Meeting on 2026-10-27 at 10:30. Order #4111111111111112 shipped.
Ticket INV-2291, version 2.4.1, call extension 4521.
```

✅ **No pop-up.** The paste goes through unchanged.
(The 16-digit order number fails the card checksum, `2.4.1` isn't an IP address, and dates and money aren't phone numbers.)

---

## Test 6: Same value → same placeholder

```
I emailed priya.shah@northwind.com yesterday and PRIYA.SHAH@NORTHWIND.COM again today. Her other address is p.shah@northwind.com.
```

**You should see:**
```
I emailed [EMAIL_1] yesterday and [EMAIL_1] again today. Her other address is [EMAIL_2].
```
✅ Upper/lower case doesn't matter: the same address gets the same placeholder

---

## Test 7: Dense paragraph (context detection)

```
Helix Biosciences Inc. has requested access to our platform. The principal investigator is Dr. Ananya Rao (ananya.rao@helixbio.com). The billing contact is finance officer Rohan Deshmukh, who used the test Visa card 4111 1111 1111 1111, expiry 12/29, CVV 123, billed to 21 Research Park Road, Cambridge, MA 02139. Helix was assigned client ID HLX-00482 and issued the API key sk_test_FAKE_9fA3xQ72LmPz48TcVb01 under Project Aurora (study ID ONC-2026-0117, IRB approval number IRB-77421). Data is stored in ap-south-1.
```

**You should see:**
```
[ORG_1]. has requested access to our platform. The principal investigator is [PERSON_1] ([EMAIL_1]). The billing contact is finance officer [PERSON_2], who used the test Visa card [CARD_1], expiry [EXPIRY_1], CVV [CVV_1], billed to [ADDRESS_1]. [ORG_2] was assigned client ID [ID_1] and issued the API key [API_KEY_1] under [PROJECT_1] (study ID [ID_2], IRB approval number [ID_3]). Data is stored in ap-south-1.
```
✅ No setup needed: names, company, address and IDs are caught from context
✅ `ap-south-1` is left alone

---

## Feature checks

| # | Do this | Expected |
|---|---|---|
| A | Paste Test 1, click **"Allow next paste unmasked"** in the pop-up, then paste again | The second paste goes in with real values |
| B | Turn PasteGuard **off** with the switch in the popup, then paste Test 1 | No masking, no pop-up |
| C | Open the popup after a few tests | "Masked in the last 7 days" counts up; **This session's vault** lists `[EMAIL_1]` etc. (hover to reveal) |
| D | Click **Clear** in the vault, then look at an old AI reply | Placeholders already restored stay; new replies won't restore old placeholders |
| E | Untick **Phone** under Detect, then paste Test 1 | Phone number goes through unmasked; everything else is still masked |
| F | Turn off **Show real values in AI replies**, then send Test 1 | The AI reply shows `[PERSON_1]` placeholders as-is |
| G | Close and reopen Chrome, then open the popup | Vault is empty (memory-only); stats and custom terms are kept |
| H | Try the same pastes on claude.ai and gemini.google.com | Same results |

## If something doesn't work

Note which site, which test, and what you saw (a screenshot helps). Also check `chrome://extensions` → PasteGuard → **Errors**.
