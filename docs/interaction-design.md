# The traveller experience

The public page separates the traveller experience from the explanation of AI interpretation and matching. The experience shows what a traveller says, chooses and receives. The technology section explains how the system works with the same synthetic bookings and example data.

The product heading remains static. Cities, dates, seats and amounts belong inside the illustration. Six visitor-controlled moments share a persistent booking scene, wallet and navigation. Each moment has one primary action.

## Earning credits

The opening contains a prepared flexibility statement, the traveller’s current aisle seat and a zero credit balance.

> On flights up to four hours, any seat is fine. On longer flights, I need an aisle.

**Save flexibility** reveals a seat offer. The current aisle seat 22C and proposed window seat 22A stay in the same diagram. Another traveller has an active request for the aisle. The proposed seat satisfies the saved short-flight condition. The flight and cabin remain unchanged.

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

The platform quote appears separately from AI interpretation. Expandable details expose entity identifiers, structured conditions and the checks performed by the deterministic matcher. They do not imply that the traveller must write or inspect JSON.

The public page uses authored language interpretations and computed matches over synthetic fixtures. It calls no live language model or airline service and connects to no real wallet. The production algorithm proposal is documented separately in the platform repository.
