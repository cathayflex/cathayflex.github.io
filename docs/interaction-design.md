# The traveller experience

The public page separates the traveller experience from the explanation of AI interpretation and matching. The experience shows what a traveller says, chooses and receives. The technology section explains how the system works with the same synthetic bookings and example data.

The product heading remains static. Cities, dates, seats and amounts belong inside the illustration. Six visitor-controlled moments share a scene, persistent wallet and navigation. The scene begins with profile configuration and introduces journey details when an offer arrives. Each moment has one primary action.

## Earning credits

The opening shows a standing preference configuration under Your profile, with a prepared flexibility statement and a zero credit balance. It has no flight, date, seat assignment or booking diagram. A short scope note explains that these preferences are saved across journeys and remain editable.

> On flights up to four hours, any seat is fine. On longer flights, I need an aisle.

**Save flexibility** advances to an illustrated offer for the Taipei journey. The AN OFFER FOR YOUR JOURNEY status separates this from profile configuration. The flight, current aisle seat 22C and proposed window seat 22A appear here for the first time. Another traveller has an active request for the aisle. The proposed seat satisfies the saved short-flight condition. The flight and cabin remain unchanged.

**Accept seat change** moves the traveller indicator to 22A. A credit transfer links the 400-credit reward to the wallet. The balance becomes 400 and the receipt remains visible on desktop. **Use credits** continues to the later Tokyo journey while keeping the same wallet.

## Using credits

The later request contains only the desired outcome.

> For Tokyo, I’d like us to sit together and take one extra checked bag.

**Review request** shows the synthetic booked flight CX520 on 2 November, the three travellers, their adjacent-seat request and one additional checked bag of up to 23 kg. Flex supplies the fixed quote of 360 credits. The traveller never enters a credit cap. The request remains valid until 1 November at 9 am Hong Kong time and requires both services together.

The seat icons show people before a match exists. Specific seat numbers appear only after confirmation. The fixed quote consists of 160 credits for seating and 200 for the airline baggage product. Personal baggage allowances do not pass between travellers.

**Publish request** invokes the publication reducer and reserves 360 credits. The total balance is still 400, including the reservation. The original booking remains unchanged. A brief matching passage connects publication to the later illustrated result. It compresses the synthetic passage from publication at 08.00 to a match at 08.12. It does not promise immediate supply.

The later match validates the fixed quote, all requested services, seat adjacency, identities, funding, supplier confirmation and expiry. Settlement confirms seats 32A, 32B and 32C plus the extra bag. A 360-credit transfer connects those services to the wallet. The remaining balance is 40. No additional requester approval is needed within the accepted terms.

Publication and settlement are separate functions. If a required service is unavailable, the request stays published with the amount reserved. Expiry releases the reservation without changing the booking. A service with a different price cannot silently replace an accepted quote, even when the combined total is unchanged.

## Navigation and state

Back remains in the same position at every moment. The first Back is disabled. Back and **Start again** revisit immutable authored snapshots. They do not reverse a real booking, refund a transaction or retain a previous run’s credits. The final action restarts the illustration at zero.

`experience.mjs` derives snapshots through `initialState`, `accept`, `openRequest`, `publishRequest` and `settlePublishedRequest`. The brief published state also comes from `publishRequest`. Returning during that state cancels the pending visual passage immediately. Repeated input cannot duplicate an earned or spent ledger entry.

The wallet remains visible from the beginning. Desktop shows its receipts alongside the booking. Mobile presents a compact balance strip above the scene, with earned and spent amounts in the current outcome. The scene and controls have no nested scrolling. Content can grow on narrow screens without clipping.

## Motion and access

Offer arrival and content transitions use opacity and small movements over 230 to 280 milliseconds. The seat indicator moves over 420 milliseconds. The 620-millisecond credit transfer explains how a confirmed change affects the balance. The number transition begins as the transfer reaches the wallet. A single 850-millisecond matching passage connects publication to the authored later result. Nothing advances before the visitor chooses an action.

Navigation cancels pending animations and matching timers. Keyboard activation and reduced-motion preferences use immediate state changes. A change to the reduced-motion setting during matching completes the illustrated result without further movement. Animation uses transform and opacity. Hover behavior is limited to a fine pointer.

Keyboard navigation places reading focus on the new heading. Pointer navigation keeps the control available. If the scene is outside the visible area, its top is brought beneath the sticky header. Live announcements describe the current task, balance and position. Controls have descriptive names and visible focus states.

## Behind the match

The separate technology section links phrases to their resolved meaning. “For Tokyo” identifies the account flight. “Us” identifies You, Mia and Jamie on that booking. “Sit together” becomes consecutive seats within one row and seat block. The bag becomes a specific airline product with one piece and a 23 kg limit.

The platform quote appears separately from AI interpretation. The homepage links to `/technology/` for entity identifiers, structured conditions, solver evidence and transaction checks. The homepage no longer embeds “See structured rules and checks”.

The public page uses authored language interpretations and computed matches over synthetic fixtures. It calls no live language model or airline service and connects to no real wallet. The dedicated technical page runs the platform domain engine locally on synthetic data. It distinguishes implemented behavior, bounded search guarantees and proposed research. The original experience illustration remains an authored teaching sequence.

## Technical explorer

The detailed page is one continuous explanation with three visual chapters and a short anchor navigation. Every default visual answers one question. Interpretation connects a sentence to the matching rules. Matching shows the original and proposed seating, the baggage product, fixed total and the resulting credit balance. Confirmation explains how the recorded agreement becomes verified booking changes and a settled ledger.

Natural-language examples switch between a travel request and saved flexibility. Source phrases, account context and rule strength remain aligned across both views. A conditional example under the same section shows how AND combines the conditions for a permission.

The matching surface keeps its seat map and controls in stable positions. Selecting availability computes the corresponding market. Current booking and Proposed match compare arrangements within the same frame. Daniel accepts commits the complete arrangement through the domain engine. Start again creates a fresh synthetic branch. Scenario changes preserve each branch’s state. Lin’s visible balance changes from 400 to 40 on settlement. Detailed funding records are in the matching disclosure.

The matching disclosure explains the displayed booking before introducing the engine’s internal records. A requirement table checks family seating, Daniel’s aisle preference, the extra bag, the accepted price and Daniel’s agreement. The option comparison is scoped to Lin’s Tokyo request. It explains why seats alone or a bag alone fail to fulfil the accepted bundle. The full candidate set, rules, request book, search evidence and companion checks remain available in one technical record.

The next disclosure explains competition between requests. It defines a complete plan, illustrates two plans needing the same seat, and follows the solver’s scoring and branch-and-bound search. A separate recovery example belongs to the confirmation chapter. It shows the recorded seats, pending baggage and reserved credits when a booking reply is lost. The reconciliation action checks the existing seat changes, completes the bag and records settlement once. It runs independently of the main matching example.

Technical explanations expand where they are introduced. Each summary poses a concrete question and adds a short preview of the explanation. The bodies use connected reasoning, worked examples and compact visuals. The engineering notes collect verification results, source provenance and research references. All explanations remain on `/technology/`. Previous source-reader URLs redirect to the corresponding chapter. An explicitly labeled repository link provides the original source and data.

Brief map and interpretation transitions use opacity and a small translation. Keyboard interactions and reduced-motion preferences update immediately. The mobile layout stacks the sentence and interpreted fields, then presents the matching map above its compact result. Technical code and tables scroll within their own containers.
