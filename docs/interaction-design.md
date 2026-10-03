# An illustration of earning and using credits

The product explanation stays separate from the example. The static heading, “Different priorities. Better journeys.”, describes how Flex connects requests with voluntary changes. The interaction never replaces that heading or its supporting text with a destination, traveller or scenario outcome.

Beside this explanation, one compact app surface illustrates earning and using credits. Its first screen already shows a useful seat offer and its reward. Four stable states carry this example, with three primary actions and a quiet return to earning credits. Journey names, dates, seats and credit amounts remain inside the app surface. They illustrate possible arrangements without defining the product’s scope.

## A seat that can change

The traveller’s saved words state an exact boundary.

> On flights up to four hours, any seat is fine. On longer flights, I need an aisle.

Two compact interpretations retain that boundary. The current Taipei flight lasts 105 minutes, so window 22A is compatible. Another traveller has an active, no-charge request for aisle 22C. The offer shows both seat positions, the unchanged flight and a 400-credit airline-funded reward. The only primary action is **Accept seat change**.

No profile setup or preliminary search click is needed to understand this opening. The saved preference is context for a specific voluntary choice. It remains distinct from a later request to spend credits.

## Value that stays with the traveller

Acceptance confirms window 22A and adds 400 credits once. The app header keeps the balance visible throughout the remaining example. The reward view explains that credits are available for the current journey or a future one. **Use credits** opens an illustrative later request.

The Taipei flight is unchanged. No Tokyo seat or baggage allocation changes at this stage.

## Different priorities on another journey

The next statement concerns an identified Tokyo booking.

> For Tokyo, I’d like us to sit together and take one extra checked bag. Use up to 360 Flex credits.

The reviewed request shows seats together, one extra checked bag, one total credit cap and an expiry. Both changes must be arranged together. The displayed expiry is 1 November 2026 at 9 am Hong Kong time, before the illustrative baggage service closes at 10 am.

**Publish request** confirms these terms. The illustration has an eligible seat supplier who has conditionally agreed to the move and an available airline baggage entitlement. The combined arrangement costs 160 credits for seating and 200 for baggage. It must fit the single 360-credit cap. Neither part proceeds alone. The request supplies the traveller’s authorization, so no additional requester acceptance appears.

## A complete, visible outcome

The final state shows Mia, Jamie and the traveller together in 32A, 32B and 32C, one additional 23 kg checked bag, 360 credits used and 40 remaining. It stays visible until the visitor returns to the opening chapter. Flex coordinates all changes and credit settlement. Personal baggage allowances never pass between travellers.

## Motion and access

The same app surface carries all four states. Its restrained border distinguishes it from the white page without framing the entire explanation in a tinted panel. Source clauses reveal with a short 65-millisecond stagger. State transitions use a 240-millisecond opacity and five-pixel movement. A change in the wallet receives a small synchronized emphasis. Publication includes a 650-millisecond matching transition, with visible feedback on the existing action and a screen-reader announcement.

Keyboard activation and reduced-motion preferences skip movement and the matching delay. Every completed transition moves reading focus to the new state’s heading. If the new card context is outside the visible area, the page brings its date and balance beneath the sticky header. An already visible card keeps its position. Keyboard and reduced-motion scrolling is immediate. The quiet **Earn credits** return cancels pending motion and returns to the initial offer without duplicate credits. **Earn credits** and **Use credits** indicate the current phase visually and with `aria-current="step"`. Live-region announcements describe both booking outcomes and the remaining balance.

The app frame uses automatic height. Mobile content remains fully readable without clipping or a nested scroll area. The primary action has a minimum 46-pixel target, visible focus and immediate press feedback. Hover effects apply only to devices with a fine pointer.

## Illustration boundaries

The source statements, interpreted conditions, journeys, prices, supplier response and booking confirmations are authored local data. The fixed clock begins on 5 October 2026 and moves to 19 October for the later request. There are no live language-model calls, airline API requests, external payments or actual Flex accounts on this page. The product platform implements those workflows separately.

The state functions check the stated duration boundary, active counterparty authorization, correct journey and booking party, available airline inventory, one total funded cap and the service expiry. Repeated actions cannot issue or spend credits twice. A missing service leaves the entire requested arrangement unchanged. Unit tests cover these relationships and the 400 minus 360 equals 40 credit flow.
