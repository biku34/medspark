# MedSpark

**Verified Medicines. Faster Delivery. Safer Care.**

> _"Don't search pharmacy to pharmacy. Find the medicine near you."_

MedSpark is a **functional prototype** of a hyperlocal medicine-delivery platform. It is not an
e‑commerce store with a central warehouse — it is a **digital network of local pharmacies**. A
customer searches for a medicine, MedSpark shows which *nearby, verified* pharmacies actually have
it in stock, and **the customer chooses the pharmacy**. Prescription medicines follow a completely
separate path that cannot be bypassed: upload → pharmacist review → customer verification call →
approval → pharmacy selection → delivery.

Built with **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · MongoDB Atlas**,
deployable to **Vercel**.

---

## 1. Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No database or API key is required** — with no `MONGODB_URI` set,
the app runs on an in-memory store that seeds itself with the full demo dataset on first request.

Optional: connect MongoDB Atlas.

```bash
cp .env.example .env.local
```

```bash
npm run build
```

```bash
npm start
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | No | MongoDB Atlas connection string. Omit to use the in-memory store. |
| `MONGODB_DB` | No | Database name (default `medspark`). |
| `SESSION_SECRET` | No | Signs the demo session cookie. |
| `NEXT_PUBLIC_MAPS_API_KEY` | Placeholder | Real map provider. Prototype renders a synthetic SVG map. |
| `SMS_PROVIDER_API_KEY` / `OTP_DEMO_CODE` | Placeholder | OTP delivery. Prototype accepts `123456`. |
| `PAYMENT_GATEWAY_KEY_ID` / `_SECRET` | Placeholder | Payments. Prototype simulates UPI/card/COD. |
| `TELEPHONY_API_KEY` | Placeholder | Pharmacist → customer verification calls. Simulated in-app. |
| `OCR_API_KEY` | Placeholder | Prescription text extraction. Pharmacist enters/confirms lines. |
| `BLOB_STORAGE_URL` / `_TOKEN` | Placeholder | Prescription file storage. Prototype stores data URLs. |

### Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel (framework auto-detected as Next.js).
2. Add `MONGODB_URI`, `MONGODB_DB` and `SESSION_SECRET` as environment variables.
3. In Atlas, allow Vercel's egress (`0.0.0.0/0` for a demo, or a fixed egress IP on paid plans).
4. Deploy, then hit `POST /api/seed` once (or press **Reset demo data** in the customer profile)
   to populate Atlas with the demo dataset.

> Without `MONGODB_URI` the deployment still works, but serverless instances don't share memory —
> data may reset between requests. **Use Atlas for a live demo.**

---

## 2. Demo credentials

Password for **every** account: `demo1234`
The login screen also offers one-tap sign-in for each role.

| Role | Email | Who | Lands on |
| --- | --- | --- | --- |
| Customer | `customer@medspark.app` | Aarav Mehta · Sector 11, **Gandhinagar** | `/` |
| Customer (2nd) | `priya@medspark.app` | Priya Nambiar · Navrangpura, **Ahmedabad** | `/` |
| Customer (3rd) | `rohan@medspark.app` | Rohan Desai · Sector 11, **Gandhinagar** | `/` |
| Pharmacist | `pharmacist@medspark.app` | Dr. Neha Shah (HealthFirst, Gandhinagar) | `/pharmacist` |
| Pharmacist (2nd) | `vikram@medspark.app` | Dr. Vikram Bhatt (CarePlus, Ahmedabad) | `/pharmacist` |
| Pharmacy | `pharmacy@medspark.app` | HealthFirst Pharmacy desk · Sector 7, Gandhinagar | `/pharmacy` |
| Pharmacy (2nd) | `careplus@medspark.app` | CarePlus Chemists desk · Navrangpura, Ahmedabad | `/pharmacy` |
| Delivery | `rider@medspark.app` | Imran Qureshi | `/delivery` |
| Delivery (2nd) | `sneha@medspark.app` | Sneha Chauhan | `/delivery` |
| Admin | `admin@medspark.app` | MedSpark Ops | `/admin` |

The API also accepts the simulated OTP `123456` in place of a password for any known email.

---

## 3. Demo script (run this end to end)

### A. OTC flow — ~2 minutes

1. Open `/` → allow (or skip) location. You start in **Sector 11, Gandhinagar**; the locality
   appears in the header and can be changed from the picker (Gandhinagar or Ahmedabad areas).
2. Search **“Paracetamol 650”** → result shows OTC badge, price, *“Available”*, pharmacy count,
   nearest distance and fastest ETA.
3. **Add to Cart** → open cart → set quantity with `− 1 +`.
4. **Continue — choose a nearby pharmacy** → compare cards: distance, availability, ETA, delivery
   fee, rating and total. Re-sort by **Fastest / Nearest / Lowest total / Highest rated**.
   *LifeLine Medical Store (Sector 21) is deliberately out of stock on this item and drops to the
   bottom.* Switch the location to **Navrangpura, Ahmedabad** and the entire list changes to the
   Ahmedabad pharmacies — different stock, prices, distances and ETAs.
5. **Choose Pharmacy** → order summary → pick payment (COD, or UPI/Card to see the simulated OTP)
   → **Place Order** → an order ID like `MS-4TR7QK` is generated.
6. Tracking screen: promised window (*"delivered between 8:20 PM – 8:50 PM"*), 5-stage tracker,
   simulated map, pharmacy, rider, address, support.
7. Advance the order either from the real dashboards (below) or with **Simulate next step**.

### B. Prescription flow — ~4 minutes

1. As the customer: **Upload Prescription** → attach a file, take a photo, *or* click a **sample
   prescription** chip → add patient/doctor/note → **Submit for pharmacist verification**.
2. A reference like `RX-8K2M1` is issued with status **Pending Pharmacist Verification**.
3. Sign out → sign in as **Pharmacist** → the request is in the queue → **Review Prescription**.
4. Review the document, confirm/edit the medicine lines, then **Call Customer for Verification** →
   the simulated call rings, connects, and runs a 6-point checklist (name, medicine, quantity,
   prescription details, address, order confirmation) → **End call — verified**.
5. Enter the verification note → **APPROVE & RELEASE ORDER**.
   *Try approving before the call: the API refuses. There is no bypass.*
6. Back as the customer (the prescription page polls live): **Prescription Verified ✓** →
   **Choose a nearby pharmacy** → same pharmacy-comparison screen → **Place Order**.
7. Sign in as **Pharmacy** → the order shows `Prescription Verified ✓` → **Accept Order** →
   **Ready for Pickup**.
8. Sign in as **Delivery** → **Accept Delivery** → **Picked Up** → **Delivered**.
9. Customer's tracking screen reaches **Delivered**; admin analytics update.

---

## 4. Workflows

### Customer
```
Search / browse → availability at nearby pharmacies → quantity → compare pharmacies
→ choose pharmacy → summary → payment → order ID → live tracking → delivered
```
Prescription medicines never enter this path directly; the medicine card replaces *Add to Cart*
with *Upload prescription to order*.

### Pharmacist (independent of the pharmacy)
```
Queue → open request → read document → confirm medicine lines
→ (optionally request clarification) → verification call + 6-point checklist
→ verification note → APPROVE & RELEASE  |  REJECT with reason
```
Rules enforced server-side (`src/app/api/prescriptions/[id]/route.ts`):
* Approval requires a logged call with outcome `VERIFIED`.
* Every checklist item must be ticked.
* A verification note and at least one confirmed medicine line are mandatory.

### Pharmacy
```
New Orders → Accept / Reject (out of stock) → Preparing → Ready for Pickup
Inventory → add medicine, edit stock & price → availability updates customer search instantly
Earnings · Ratings
```
Accepting an order decrements that pharmacy's own stock. A pharmacy **cannot** move a prescription
order forward unless the prescription is already approved — the order could not have been created
otherwise.

### Delivery partner
```
New Pickups → Accept Delivery → (pharmacy marks Ready) → Picked Up / Out for Delivery → Delivered
```
Each card carries the simulated route map, pickup, drop, distance, promised window and cash to
collect.

### Admin
```
Overview KPIs · Pharmacy management (add / verify / suspend / reactivate)
· Pharmacist management (add / activate / deactivate) · All orders · Analytics
```
Admins can onboard and suspend pharmacies but **cannot** approve prescriptions.

---

## 5. Project structure

```
medspark/
├── .env.example                  # every config value, all optional
├── next.config.ts
├── postcss.config.mjs            # Tailwind v4
├── tsconfig.json                 # "@/*" -> src/*
└── src/
    ├── app/
    │   ├── layout.tsx            # providers + toasts + metadata
    │   ├── globals.css           # design tokens, utilities, animations
    │   ├── page.tsx              # CUSTOMER — home
    │   ├── search/               # CUSTOMER — search results
    │   ├── category/[slug]/      # CUSTOMER — OTC / prescription / wellness
    │   ├── medicine/[id]/        # CUSTOMER — medicine detail
    │   ├── cart/                 # CUSTOMER — cart + quantity
    │   ├── select-pharmacy/      # CUSTOMER — pharmacy comparison & choice
    │   ├── checkout/             # CUSTOMER — summary + simulated payment
    │   ├── orders/               # CUSTOMER — order list
    │   ├── orders/[id]/          # CUSTOMER — live tracking
    │   ├── prescriptions/        # CUSTOMER — prescription list
    │   ├── prescriptions/upload/ # CUSTOMER — upload (file / PDF / camera)
    │   ├── prescriptions/[id]/   # CUSTOMER — status, approval, call record
    │   ├── profile/              # CUSTOMER — profile, orders, ℞, notifications
    │   ├── login/                # all roles — one-tap demo sign-in
    │   ├── pharmacist/           # PHARMACIST — verification queue
    │   ├── pharmacist/[id]/      # PHARMACIST — review + simulated call + approve
    │   ├── pharmacy/             # PHARMACY — orders, inventory, earnings, ratings
    │   ├── delivery/             # DELIVERY — pickups, route, status
    │   ├── admin/                # ADMIN — overview, management, analytics
    │   └── api/                  # route handlers (see API map below)
    ├── components/
    │   ├── providers.tsx         # session · location · cart · toasts (client state)
    │   ├── ui.tsx                # Button, Card, Badge, Field, Modal, Tabs, Stat…
    │   ├── brand.tsx             # Logo, ComplianceNote, PrototypeRibbon
    │   ├── customer-shell.tsx    # header, search, bottom nav, footer
    │   ├── staff-shell.tsx       # dashboard chrome + client-side role guard
    │   ├── location-sheet.tsx    # permission prompt + manual picker
    │   ├── medicine-card.tsx     # search result + add-to-cart / notify-me
    │   ├── pharmacy-card.tsx     # pharmacy offer for a basket
    │   ├── order-tracker.tsx     # 5-stage rail + compact variant
    │   ├── map-view.tsx          # simulated map (swap for a real provider)
    │   ├── charts.tsx            # dependency-free SVG charts
    │   └── toast-host.tsx
    └── lib/
        ├── types.ts              # domain model
        ├── db.ts                 # Store interface + mongo / memory drivers
        ├── seed.ts               # all mock data
        ├── sample-prescription.ts# synthetic prescription generator
        ├── services.ts           # search, pharmacy matching, transitions, stats
        ├── session.ts            # signed cookie session
        ├── api.ts                # route helpers + role guard
        ├── client.ts             # browser fetch wrapper
        └── utils.ts              # geo, ETA, currency, dates, ids
```

### API map

| Method & path | Role | Purpose |
| --- | --- | --- |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | any | session |
| `GET /api/medicines?q=&category=&track=1` | public | search + nearby availability |
| `GET /api/medicines/[id]` | public | one medicine + availability |
| `GET /api/pharmacies?items=med:qty,…&sort=` | public | **pharmacy offers for a basket** |
| `GET /api/pharmacies?all=1` · `POST` | admin | list / onboard |
| `PATCH /api/pharmacies/[id]` | admin | verify · suspend · reactivate |
| `GET/POST/PATCH/DELETE /api/inventory` | pharmacy, pharmacist, admin | stock & price |
| `GET /api/orders` | any (role-scoped) | order lists |
| `POST /api/orders` | customer | place order (**compliance gate**) |
| `PATCH /api/orders/[id]` | role-checked | accept · reject · ready · assign · picked · delivered · cancel · advance |
| `GET/POST /api/prescriptions` | customer, pharmacist | upload & queue |
| `PATCH /api/prescriptions/[id]` | pharmacist / customer | start_review · update_medicines · clarify · log_call · approve · reject · reply |
| `GET/PATCH /api/notifications` | any | in-app notifications |
| `POST/GET /api/stock-alerts` | customer | “notify me when available” |
| `GET /api/admin/stats` | admin | KPIs + analytics series |
| `GET/POST/PATCH /api/users` | admin | staff management |
| `GET/POST /api/seed` | any | driver info / reset demo data |

---

## 6. Service geography — Gandhinagar & Ahmedabad

MedSpark is hyperlocal, so the geography is **real**, not decorative. Every pharmacy carries actual
coordinates and distance is a true great-circle calculation (scaled by 1.25× for road distance).

| | |
|---|---|
| **Cities served** | Gandhinagar and Ahmedabad, Gujarat |
| **Gandhinagar areas** | Sector 7, Sector 11, Sector 21, Infocity (Sector 24), Kudasan, Sargasan, Randesan, Pethapur, Adalaj |
| **Ahmedabad areas** | Navrangpura, Vastrapur, Satellite, Bodakdev, Prahlad Nagar, Thaltej (S.G. Highway), Naranpura, Paldi, Maninagar, Chandkheda |
| **Delivery radius** | 10 km from the pharmacy |
| **Coverage radius** | 25 km from a city centre — beyond that MedSpark says it isn't live yet |
| **Default area** | Sector 11, Gandhinagar (so the app works before location is granted) |

The two cities are ~22 km apart, which is **outside the 10 km delivery radius**. That falls out of
the maths rather than being hard-coded: a customer in Sector 11 simply never sees an Ahmedabad
pharmacy, because no Ahmedabad pharmacy can reach them in 20–40 minutes. This is the difference
between a pharmacy network and a warehouse pretending to be local.

Three consequences worth demoing:

* **Change the location, change the whole app.** Switching from Sector 11 to Navrangpura in the
  location picker swaps the entire pharmacy list, prices, distances and ETAs.
* **Aarav's saved locations cross the corridor.** *Home* (Sector 11, Gandhinagar), *Hostel*
  (Infocity, Gandhinagar) and *Parents — senior care* (Maninagar, Ahmedabad). Picking the parents'
  address switches him to the Ahmedabad network — the "family in another city" use case, working.
* **Outside the service area is handled honestly.** If your browser reports a location outside both
  cities (i.e. anywhere else), the app says *"MedSpark isn't live in your area yet"* and offers a
  one-tap switch to Gandhinagar or Ahmedabad, rather than faking nearby stock.

Coordinates are approximate to sector/locality level and are defined in
[`src/lib/zones.ts`](src/lib/zones.ts). Production replaces this file with real geocoding and a
distance-matrix API.

## 7. Mock data

Seeded from `src/lib/seed.ts` (all brands, manufacturers, pharmacies and people are **fictional**;
no affiliation with any real pharmacy or pharmaceutical company is claimed).

| Collection | Count | Notes |
| --- | --- | --- |
| `medicines` | 32 | 20 OTC/wellness + 12 prescription, incl. 1 cold-chain and 1 restricted |
| `pharmacies` | 10 | 5 in Gandhinagar + 4 in Ahmedabad (active & verified), 1 pending verification |
| `users` | 10 | 3 customers, 2 pharmacists, 2 pharmacy desks, 2 riders, 1 admin |
| `inventory` | ~230 | per-pharmacy stock and price, deliberately uneven |
| `orders` | 20 | 1 live (out for delivery), 1 awaiting pharmacy acceptance, 17 history, 1 cancelled |
| `prescriptions` | 3 | 2 pending verification, 1 approved with a logged call |
| `notifications` | 3 | order, prescription and delivery updates |
| `searchLogs` | ~169 | weighted terms feeding “most searched medicines” |

Deliberate scenarios baked into the data:

* **Two genuinely separate clusters.** Gandhinagar customers see only the 5 Gandhinagar pharmacies;
  Ahmedabad customers see only the 4 Ahmedabad ones. Nothing enforces this by name — it falls out of
  the 10 km delivery radius applied to real coordinates.

* **Paracetamol 650 mg** — stocked by 4 of 5 pharmacies; *LifeLine* has 0 → shows the trade-off.
* **Insulin Glargine** — out of stock everywhere → *“Currently unavailable in nearby pharmacies”*
  plus **Notify me when available** (raise its stock from the pharmacy dashboard to fire the alert).
* **Alprazolam 0.5 mg** — restricted/scheduled: blocked in the UI *and* refused by the order API.
* Pharmacy pricing varies ±8 % around MRP so **Lowest total price** sorting genuinely reorders.
* Pharmacies are positioned as **offsets in km from the customer**, so distances stay realistic
  wherever the browser reports the user to be.

---

## 8. Safety & compliance design

* Prescription medicines can **never** be bought directly. `POST /api/orders` rejects any Rx line
  without an `APPROVED` prescription that belongs to the signed-in customer, and rejects any Rx
  line that is not on that verified prescription.
* Approval requires a **pharmacist** (role-checked), a **logged verification call** with outcome
  `VERIFIED`, a **fully ticked checklist**, and a **written note**. Admins cannot approve.
* Restricted/scheduled drugs are blocked outright with an explanatory notice.
* The hyperlocal radius is enforced **server-side too**: `POST /api/orders` rejects any pharmacy
  further than 10 km from the delivery address, so a cross-city order cannot be forced through the
  API even though the UI would never offer it.
* Every prescription surface carries: *“Prescription medicines are dispensed only after applicable
  prescription and pharmacist verification requirements are satisfied.”*
* A persistent ribbon marks the build as a prototype with simulated data, payments, OTP and calls.
* MedSpark is presented throughout as a **technology platform connecting customers to licensed
  local pharmacies** — it does not dispense, and it does not give medical advice.

---

## 9. What needs real APIs for production

| Area | Prototype | Production |
| --- | --- | --- |
| **Auth** | Signed cookie, plaintext seeded passwords | Real IdP or hashed credentials (argon2/bcrypt), OTP over SMS, rate limiting, refresh tokens |
| **Maps & geocoding** | `components/map-view.tsx` synthetic SVG; `localityFor()` stub in `providers.tsx` | Google Maps / Mapbox: geocoding, distance-matrix ETAs, live rider tracking (`NEXT_PUBLIC_MAPS_API_KEY`) |
| **Distance** | Straight-line offsets + a traffic constant | Road distance & live ETA from a routing API |
| **Payments** | Modal accepting any 4–6 digits | PSP integration (Razorpay/Stripe/UPI), webhooks, refunds, settlement |
| **OTP** | Fixed `123456` | SMS/WhatsApp provider with retry + throttling |
| **Verification call** | In-app simulated call UI | Masked telephony (Exotel/Twilio), call recording & retention per local law |
| **Prescription OCR** | Pharmacist types/confirms lines | OCR + NER, with pharmacist confirmation still mandatory |
| **File storage** | Data URLs inside the document | Object storage (S3/Vercel Blob) with signed URLs, encryption at rest, retention policy |
| **Notifications** | In-app list | Push (FCM/APNs), SMS, email |
| **Realtime** | Polling every 6–10 s | WebSockets / SSE / Pusher |
| **Compliance** | UI gates + API rules | Drug-licence verification, pharmacist registration checks, audit logs, e-prescription standards, schedule-drug handling, data-protection obligations |
| **Ops** | — | Observability, rate limits, RBAC hardening, backups, penetration testing |

---

## 10. Scripts

```bash
npm run dev
```
```bash
npm run build
```
```bash
npm start
```
```bash
npm run typecheck
```

---

## 11. Disclaimer

This is a demonstration prototype built for product evaluation. It is **not** a licensed pharmacy
service, dispenses nothing, and must not be used for real medical decisions. All patient,
prescription, pharmacy and medicine data is fabricated.
