# WhatsApp Business API: set-up and message templates

The store sends WhatsApp messages through Meta's **WhatsApp Business Cloud API**. Nothing is sent
until the keys below are set. Admin pages: **/admin/whatsapp** (status, campaigns) and **/admin/offers**.

## 1. Set up in Meta (once)

1. **business.facebook.com** → create or open the Honic business (verify the business for higher limits).
2. **developers.facebook.com** → *Create app* → type *Business* → add the **WhatsApp** product.
3. WhatsApp → *API Setup* → **add your phone number** and verify it by SMS/call.
   - ⚠️ A number connected to the Cloud API normally **cannot also be used in the WhatsApp Business app**.
     Either use a **second number** for the API, or onboard with Meta's **"coexistence"** option so the
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
| `WHATSAPP_VERIFY_TOKEN` | already generated in `.env.local` (any random text) |
| `WHATSAPP_TEMPLATE_LANG` | `en` (the language you create the templates in) |

6. WhatsApp → *Configuration* → **Webhook**: Callback URL `https://honiccompanystore.com/api/webhooks/whatsapp`,
   Verify token = `WHATSAPP_VERIFY_TOKEN`, then **subscribe to `messages`**.
7. Tell Claude the keys are filled in: they are pushed to Vercel and the site is redeployed.

## 2. Templates to create (WhatsApp Manager → Message templates)

Create each with **exactly this name**, category as shown, language **English (en)**. The texts are
bilingual (Swahili + English). `{{n}}` are variables: Meta asks for a sample of each.
Order templates are **Utility**; they are sent only to customers who ticked *"Send my order updates on WhatsApp"*.

### `honic_order_paid` · Utility
- **Header:** Document (sample: any PDF). The store attaches the invoice PDF.
- **Body:**
  ```
  Habari {{1}}, tumepokea malipo ya oda {{2}} ({{3}}). Ankara yako (PDF) imeambatishwa. Tunaandaa oda yako sasa.

  Hello {{1}}, we received payment for order {{2}} ({{3}}). Your invoice (PDF) is attached. We are preparing your order now.
  ```
  Samples: `Asha`, `ORD-1764000000000`, `TSh 98,000`
- **Button:** Visit website · text `Fuatilia oda / Track order` · URL **dynamic** `https://honiccompanystore.com/orders/{{1}}` (sample `0123456789abcdef0123456789abcdef`)

### `honic_order_shipped` · Utility
- **Body:**
  ```
  Habari {{1}}, oda {{2}} imetumwa na iko njiani. Namba ya mzigo: {{3}}.

  Hello {{1}}, order {{2}} is on the way. Tracking number: {{3}}.
  ```
  Samples: `Asha`, `ORD-1764000000000`, `TZ123456`
- **Button:** URL dynamic `https://honiccompanystore.com/orders/{{1}}` · text `Fuatilia oda / Track order`

### `honic_order_ready_pickup` · Utility
- **Body:**
  ```
  Habari {{1}}, oda {{2}} iko tayari kuchukuliwa dukani. Pickup ID: {{3}}. Leta kitambulisho. Duka: 44 Bibi Titi Road, DIT CEIIT Tower, Dar es Salaam (Jumatatu - Jumamosi, 9:00 - 18:00).

  Hello {{1}}, order {{2}} is ready for pickup. Pickup ID: {{3}}. Bring a valid ID.
  ```
  Samples: `Asha`, `ORD-1764000000000`, `PK-4821`
- **Button:** URL dynamic `https://honiccompanystore.com/orders/{{1}}` · text `Angalia oda / View order`

### `honic_order_delivered` · Utility
- **Body:**
  ```
  Habari {{1}}, oda {{2}} imefika. Tafadhali angalia bidhaa na uthibitishe umeipokea. Kuna tatizo? Unaweza kuomba kurudisha ndani ya siku 7.

  Hello {{1}}, order {{2}} was delivered. Please check it and confirm you received it. A problem? You can ask for a return within 7 days.
  ```
- **Button:** URL dynamic `https://honiccompanystore.com/orders/{{1}}` · text `Thibitisha / Confirm`

### `honic_order_expired` · Utility
- **Body:**
  ```
  Habari {{1}}, oda {{2}} haikulipwa ndani ya dakika 15, kwa hiyo imesitishwa. Hakuna pesa iliyokatwa. Unaweza kuagiza tena kutoka kwenye kikapu.

  Hello {{1}}, order {{2}} was not paid within 15 minutes, so it was cancelled. No money was taken. You can order again from your cart.
  ```
- **Button:** URL **static** `https://honiccompanystore.com/cart` · text `Fungua kikapu / Open cart`

### `honic_offer_reply` · Utility
Used when the team accepts or counters a "Make an offer" request and the customer has not written in the last 24 h.
- **Body:**
  ```
  Habari {{1}}, kuhusu ofa yako ya {{2}}: bei iliyokubaliwa ni {{3}} kwa kila moja (idadi {{4}}). Kodi yako: {{5}}. Iweke kwenye kikapu, kisha lipa kwa mobile money. Inafanya kazi mara moja ndani ya saa {{6}}.

  Hello {{1}}, about your offer for {{2}}: agreed price {{3}} each (qty {{4}}). Your code: {{5}}. Enter it in your cart and pay with mobile money. Valid once, for {{6}} hours.
  ```
  Samples: `Asha`, `Bambu Lab A1 3D Printer`, `TSh 1,700,000`, `1`, `OFR-7K3P9X`, `48`
- **Button:** URL dynamic `https://honiccompanystore.com/products/{{1}}` · text `Nunua sasa / Buy now` (sample `270`)

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
