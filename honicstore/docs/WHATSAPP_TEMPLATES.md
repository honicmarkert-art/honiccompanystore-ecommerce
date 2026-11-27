# WhatsApp Business API: set-up and message templates

The store sends WhatsApp messages through Meta's **WhatsApp Business Cloud API**. Nothing is sent
until the keys below are set. Admin pages: **/admin/whatsapp** (status, campaigns) and **/admin/offers**.

## 1. Set up in Meta (once)

1. **business.facebook.com** → create or open the Honic business (verify the business for higher limits).
2. **developers.facebook.com** → *Create app* → type *Business* → add the **WhatsApp** product.
3. WhatsApp → *API Setup* → **add your phone number** and verify it by SMS/call.
   - ⚠️ A number connected to the Cloud API normally **cannot also be used in the WhatsApp Business app**.
     Either use a **second number** for the API, or onboard with Meta's **"coe- **order_ready:** Habari {{1}}, oda {{2}} iko tayari. Unaweza kuichukua sasa. / Hello {{1}}, your order {{2}} is ready. You can pick it up now.
istence"** option so the
     same number keeps working in the app. Decide before connecting +255 786 957 939.
4. Business settings → *System users* → create one (Admin) → *Generate token* for the app with
   `whatsapp_business_messaging` and `whatsapp_business_management` → this is the **permanent token**.
5. Copy into `honicstore/.env.local`:

| Setting | Where |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | the permanent system-user token (step 4) |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp → API Setup → *Phone number ID* |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp → API Setup → *WhatsApp Business Account ID* |
| `WHATSAPP_APP_SECRET` | App settings → Basic → *App secret* |
| `WHATSAPP_VERIFY_TOKEN` | already generated in `.env.local` (any random te- **offer_price:** Habari {{1}}, kuhusu ofa yako ya {{2}}: bei iliyokubaliwa ni {{3}} kwa kila moja (idadi {{4}}). Andika {{5}} kwenye kikapu, kisha lipa kwa mobile money. Inatumika mara moja ndani ya saa {{6}}. / Hello {{1}}, about your offer for {{2}}: agreed price {{3}} each (qty {{4}}). Type {{5}} in your cart and pay with mobile money. Valid once, for {{6}} hours.
t) |
| `WHATSAPP_TEMPLATE_LANG` | `en` (the language you create the templates in) |

6. WhatsApp → *Configuration* → **Webhook**: Callback URL `https://honiccompanystore.com/api/webhooks/whatsapp`,
   Verify token = `WHATSAPP_VERIFY_TOKEN`, then **subscribe to `messages`**.
7. Tell Claude the keys are filled in: they are pushed to Vercel and the site is redeployed.

## 2. Templates (submitted through the API on 2026-11-27)

All are **Utility**, language **en**, bilingual (Swahili + English). Names must match `WA_TEMPLATES` in
`lib/whatsapp.ts` (shop and admin). Order templates go only to customers who ticked
*"Send my order updates on WhatsApp"*. Button texts are at most 25 characters (WhatsApp limit).
Opening hours and the street number are left out on purpose: an approved template cannot be changed quickly.

Meta rejected earlier versions as "incorrect category" whenever the text said *Pickup ID* or *Your code* followed by a
value (it reads them as login codes). Keep words like "ID" and "code" away from variables. Rejected names that
cannot be reused: honic_order_ready_pickup, honic_offer_reply, honic_pickup_ready, honic_offer_answer,
honic_collect_order, honic_collect_ready, honic_ready_collect.

| Template | Sent when | Variables | Button |
|---|---|---|---|
| `honic_order_paid` | payment confirmed (shop) | name, order number, total. Header: invoice PDF | Track order / Fuatilia → `/orders/{ref}` |
| `honic_order_shipped` | admin marks shipped | name, order number, tracking number | Track order / Fuatilia → `/orders/{ref}` |
| `honic_order_ready` | admin marks ready for pickup | name, order number (the pickup number is on the order page) | View order / Angalia oda → `/orders/{ref}` |
| `honic_order_delivered` | admin marks delivered | name, order number | Confirm / Thibitisha → `/orders/{ref}` |
| `honic_order_expired` | unpaid order cancelled after 15 min | name, order number | Open cart / Fungua kikapu → `/cart` |
| `honic_offer_price` (**Marketing**) | admin accepts or counters a "Make an offer" request (customer silent for 24 h) | name, product, price each, quantity, code, hours valid | Buy now / Nunua sasa → `/products/{id}-{slug}` |
| `honic_import_shipping_price` | admin saves the China shipping price of an order | name, order number, price, "ndege / air" or "meli / sea" | View order / Angalia oda → `/orders/{ref}` |

Texts:

- **order_paid:** Habari {{1}}, tumepokea malipo ya oda {{2}} ({{3}}). Ankara yako (PDF) imeambatishwa. Tunaandaa oda yako sasa. / Hello {{1}}, we received payment for order {{2}} ({{3}}). Your invoice (PDF) is attached. We are preparing your order now.
- **order_shipped:** Habari {{1}}, oda {{2}} imetumwa na iko njiani. Namba ya mzigo: {{3}}. / Hello {{1}}, order {{2}} is on the way. Tracking number: {{3}}. Tap the button below to follow it.
- **order_ready_pickup:** Habari {{1}}, oda yako {{2}} iko tayari kuchukuliwa. Namba ya kuchukulia (Pickup ID): {{3}}. Tafadhali leta kitambulisho ukija kuchukua. / Hello {{1}}, your order {{2}} is ready for collection. Pickup ID: {{3}}. Please bring a valid ID when you collect it.
- **order_delivered:** Habari {{1}}, oda {{2}} imefika. Tafadhali angalia bidhaa na uthibitishe umeipokea. Kuna tatizo? Unaweza kuomba kurudisha ndani ya siku 7. / Hello {{1}}, order {{2}} was delivered. Please check it and confirm you received it. A problem? You can ask for a return within 7 days.
- **order_expired:** Habari {{1}}, oda {{2}} haikulipwa ndani ya dakika 15, kwa hiyo imesitishwa. Hakuna pesa iliyokatwa. Unaweza kuagiza tena kutoka kwenye kikapu. / Hello {{1}}, order {{2}} was not paid within 15 minutes, so it was cancelled. No money was taken. You can order again from your cart.
- **offer_reply:** Habari {{1}}, ombi lako la bei ya {{2}} limejibiwa. Bei: {{3}} kwa kila moja, idadi {{4}}. Namba ya ombi lako: {{5}}. Itumie kwenye kikapu ndani ya saa {{6}}. / Hello {{1}}, your price request for {{2}} has been answered. Price: {{3}} each, quantity {{4}}. Your request code: {{5}}. Use it in your cart within {{6}} hours.
- **import_shipping_price:** Habari {{1}}, bei ya kusafirisha oda {{2}} kutoka China iko tayari: {{3}} ({{4}}). Utalipa gharama hii mzigo ukifika. / Hello {{1}}, the shipping price for order {{2}} from China is ready: {{3}} ({{4}}). You pay it when the parcel arrives.

If a number in these texts changes (15-minute payment window, 7-day returns), edit the template in
WhatsApp Manager too: `lib/policies.ts` does not update approved templates.

## 3. Offers / ads (Marketing templates)

Create as many **Marketing** templates as you like (any name); they appear on **/admin/whatsapp** once
approved. They are sent only to customers who ticked *"Also send me offers on WhatsApp"*. Example:

### `honic_weekly_offer` · Marketing
- **Header:** Image (the offer picture; you paste its https link when sending)
- **Body:**
  ```
  Habari {{1}}! 🔥 {{2}}

  Ofa inaisha {{3}}. Lipa kwa M-Pesa, Airtel Money, Mixx au HaloPesa.
  ```
  Samples: `Asha`, `Bambu Lab A1 sasa TSh 1,690,000 tu`, `Jumapili`
- **Footer:** `Tuma STOP kusitisha ofa · Reply STOP to stop`
- **Button:** URL dynamic `https://honiccompanystore.com/{{1}}` · text `Nunua / Shop` (sample `products/270`)

When sending, write `{name}` in a field to use each customer's first name.

## 4. How consent works
- **Checkout:** "Send my order updates on WhatsApp" (ticked by default, clearly labelled) and
  "Also send me offers on WhatsApp" (not ticked). Saved per phone number in `whatsapp_contacts`.
- Customers reply **STOP / ACHA / SITISHA** to stop offers (order updates continue), **START / ANZA** to join again.
- When WhatsApp can't deliver an order update, the store falls back to SMS (Beem) and email.
- Free-text replies are only possible for 24 h after the customer last wrote to you (WhatsApp rule).
