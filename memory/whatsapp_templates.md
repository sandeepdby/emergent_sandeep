# WhatsApp Business Templates — Submission Guide (InsureHub / Aarogya Innovate Pvt Ltd)

Create these in **Twilio Console → Messaging → Content Template Builder** (or Content API), then submit for **WhatsApp (Meta) approval**. Category: **Utility** (transactional service notifications). Language: English.

Once each template is **approved**, copy its **Content SID** (starts with `HX...`) into `/app/backend/.env`:
- `TWILIO_WA_TEMPLATE_SUBMITTED=HX....`  (endorsement submitted → admins)
- `TWILIO_WA_TEMPLATE_STATUS=HX....`     (endorsement approved/rejected → HR)
Then restart the backend. Until set, the app sends free-form WhatsApp (delivers only inside the 24h session window).

---

## Template 1 — Endorsement Submitted (to Admins)
- Suggested name: `insurehub_endorsement_submitted`
- Category: Utility
- Body:
```
Hello {{1}}, a new endorsement has been submitted on InsureHub for {{2}} ({{3}}) on policy {{4}}. Pro-rata premium: {{5}}. Please log in to review and approve. — Aarogya Innovate Pvt Ltd
```
- Sample values for Meta review:
  - {{1}} = Arpita Saxena
  - {{2}} = Rahul Sharma
  - {{3}} = Addition
  - {{4}} = GMC0001393000100
  - {{5}} = INR 6,338.58

## Template 2 — Endorsement Approved/Rejected (to HR)
- Suggested name: `insurehub_endorsement_status`
- Category: Utility
- Body:
```
Hello {{1}}, your endorsement for {{2}} on policy {{3}} has been {{4}}. Pro-rata premium: {{5}}. Log in to InsureHub for details. — Aarogya Innovate Pvt Ltd
```
- Sample values for Meta review:
  - {{1}} = Arpita Saxena
  - {{2}} = Rahul Sharma
  - {{3}} = GMC0001393000100
  - {{4}} = Approved
  - {{5}} = INR 6,338.58

---

## Variable mapping in code (server.py)
Template 1 (submitted): 1=submitter name, 2=member, 3=endorsement type, 4=policy number, 5=premium
Template 2 (status): 1=HR name, 2=member, 3=policy number, 4=status (Approved/Rejected), 5=premium
Sent via `send_whatsapp_template(...)` with `content_variables` = {"1":..,"5":..}. If the template send fails, the code falls back to a free-form message.
