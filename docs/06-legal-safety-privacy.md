# Legal, Safety & Privacy — Open Items Register

> **This is not legal advice.** It lists questions a qualified BC lawyer, ICBC/an insurance broker, and the BC Passenger Transportation Branch should answer **before public launch**. Nothing in this project should describe the platform as "legal", "compliant", "insured" or "licensed" until that review confirms it.

Status key: 🔴 launch blocker · 🟠 required before launch, lower uncertainty · 🟡 recommended

## 1. Passenger transportation (BC)

| # | Item | Why it matters | What we know so far (unverified) | Status |
|---|---|---|---|---|
| L1 | **Does the platform or any driver need a licence under the *Passenger Transportation Act* (BC)** (e.g., as a "transportation network service" or commercial passenger vehicle)? | Operating without a required licence can bring fines and would invalidate the pilot | Secondary sources describe a **carpool exemption** in the Act's definitions. One summary describes a carpool vehicle (driver + up to 11 passengers) making **one return trip per day between participants' homes and their workplaces or a common destination**, and the Passenger Transportation Branch has reportedly said private carpools aren't captured. **Our product allows ad-hoc trips with any purpose and strangers matched by a platform. That may fall outside a narrow carpool exemption.** | 🔴 |
| L2 | **Cost-sharing limit.** What can a passenger contribute without it being "compensation" that makes the trip commercial? | Determines the contribution cap and wording | Secondary sources say contributions should **not exceed the trip's costs (fuel, insurance, wear and tear, parking)** and should exclude vehicle depreciation. If the driver profits, it's treated as a for-profit transportation service | 🔴 |
| L3 | Does a matching platform that facilitates cost-shared carpools (without taking a commission) itself require a licence or approval? | Our own exposure | Unknown | 🔴 |
| L4 | Municipal rules (Surrey, White Rock) on ride-sharing, and where private vehicles may legally stop for pickups (pickup zones) | Zone selection; bylaws | Unknown. Check each zone on the ground | 🟠 |
| L5 | Should the product restrict trip patterns (e.g., limit trips per driver per day, require the driver's own destination) to stay within the exemption? | Product design | Pending L1/L2. The DB already supports caps via `app_settings` | 🔴 |

**Sources found (secondary, not authoritative; read 2026-10-12, primary text not yet checked):**
* DriveSmartBC, "Carpooling Rules for BC": https://drivesmartbc.ca/miscellaneous/carpooling-rules-bc
* DriveSmartBC Q&A, "Passenger Paying for Gas": https://drivesmartbc.ca/comment/1828
* Castanet, "There are rules to follow when carpooling is done for profit": https://www.castanetkamloops.net/news/Behind-the-Wheel/599487/There-are-rules-to-follow-when-carpooling-is-done-for-profit
* Primary sources to read with counsel: *Passenger Transportation Act* [SBC 2004] c. 39 and *Passenger Transportation Regulation* on BC Laws (bclaws.gov.bc.ca); Passenger Transportation Branch / PT Board guidance.

## 2. Insurance

| # | Item | Notes | Status |
|---|---|---|---|
| I1 | Does carrying passengers who contribute to costs change the **ICBC rate class/usage** of a driver's personal vehicle, and under what limits? | Secondary sources say ICBC doesn't require a rate-class change for cost-sharing carpools when contributions don't exceed trip costs, and that business rating may apply once the owner gains financially. **Confirm directly with ICBC.** | 🔴 |
| I2 | Are passengers covered (accident benefits under BC's enhanced care model) in a cost-shared carpool? | Ask ICBC; inform users accurately without overclaiming | 🔴 |
| I3 | Does the **platform operator** need general liability / tech E&O insurance? | Broker quote | 🟠 |
| I4 | Driver guidance text: "Check with ICBC or your broker that your coverage fits carpooling with cost-sharing." | Lawyer to approve wording | 🟠 |
| I5 | Owner-requested notice (added 2026-10-14): "This platform does not provide or arrange insurance. Vehicle insurance is each driver's own responsibility and choice." | A disclaimer alone may not limit the platform's liability. Coverage still depends on ICBC rules (I1, I2). Lawyer to review the wording and its placement | 🟠 |

## 3. Privacy (BC *Personal Information Protection Act*, PIPA)

| # | Item | Status |
|---|---|---|
| P1 | Privacy Notice: purposes, what's collected and why (phone optional, used only for opt-in sharing), who sees what, retention, contact for the privacy officer, how to access, correct or delete | 🟠 |
| P2 | Designate a privacy contact (the owner) as PIPA requires; document the complaint process | 🟠 |
| P3 | Data residency: choose a Canadian Supabase region if available; list sub-processors (Supabase, hosting, email provider) and their regions in the notice. Some may process data outside Canada, which must be disclosed | 🟠 |
| P4 | Retention schedule (proposal: delete or anonymize personal data 12 months after pilot end; delete messages 90 days after trip) | 🟠 |
| P5 | Breach response procedure: contain, assess, notify affected users and the BC OIPC as required or appropriate. Confirm the current legal notification obligations with counsel | 🟠 |
| P6 | Email marketing (if any) must comply with CASL. Transactional emails only during the pilot unless the user opts in | 🟡 |
| P7 | Analytics: first-party, no tracking cookies, no IP. Disclose in the notice | 🟡 (designed in) |

**Built-in privacy controls (designed and tested in Stage 1 schema):** no home addresses; public zones only; exact meeting point and vehicle visible only after acceptance; phone and full name private; display name only to signed-in users; anonymized exports; private feedback; blocking.

## 4. Safety & trust

| # | Item | Status |
|---|---|---|
| S1 | Community Safety Rules (respectful conduct, no discrimination, no commercial activity, meet at public zones, no alcohol or drug impairment, seatbelts, child seats per law, right to decline or leave a ride) | 🟠 |
| S2 | **Incident procedure**: emergencies → 911 (the platform is not an emergency service); safety reports reviewed within 24 h during the pilot; serious reports → immediate suspension pending review; a template for police requests (the lawyer advises on disclosure) | 🟠 |
| S3 | 18+ only (self-attested) | 🟠 (designed in) |
| S4 | No claims of verification. Driver declarations labelled "self-declared" | 🟠 (designed in) |
| S4a | Owner rules (added 2026-10-14): respect pledge at sign-up; drivers may decline a request or end a ride at any time; "Emergency? Call 911 first" shown throughout | 🟠 (built into prototype) Lawyer to review how "ending a ride during the trip" is worded, so drivers are told to stop somewhere public and safe first |
| S5 | Human-rights considerations: drivers may decline, but not for discriminatory reasons (BC *Human Rights Code*). Monitor decline patterns and reports | 🟡 |
| S6 | "Share my trip" feature (copy trip summary to a trusted contact) | 🟡 (Stage 4) |
| S7 | Consider optional ID verification post-pilot (third-party providers cost per check) | 🟡 later |

## 5. Terms of Use (lawyer to draft or review)
* The platform's role: an information and matching service, not a transportation provider; drivers aren't employees or contractors.
* Contribution rules: cost-sharing only, not a fare, no profit, settled directly between users.
* Eligibility (18+, valid licence and insurance for drivers), acceptable use, suspension, limitation of liability, release, governing law (BC), dispute process.
* Pilot nature: features may change; availability not guaranteed.

## 6. Production-readiness gaps (to be closed in Stages 3–7)
| Gap | Planned stage |
|---|---|
| Schema is only tested against a stub of Supabase, not real Supabase | 3 |
| No email notifications yet | 4 |
| No rate limiting on messages/reports beyond Supabase defaults | 6 |
| No automated backups on the free tier → upgrade to Pro before the live pilot | 7 |
| Account deletion is a manual admin process | 5 (documented), later self-serve |
| Accessibility audit not done | 6 |
| Legal documents not written | 7 (external) |
| No monitoring/alerting (only Supabase dashboard + email on new report) | 5–7 |
