# The traveller experience

The public page separates the traveller experience from the explanation of AI interpretation and matching. The experience shows what a traveller says, chooses and receives. The separate technology section explains how the system works with the same example data.

The product heading and surrounding explanation remain static. Cities, dates, seats and amounts belong inside the illustration. Its six screens are controlled by the visitor, with one task or outcome per screen.

## Earning credits

The opening screen shows **Your flexibility** and one prepared statement.

> On flights up to four hours, any seat is fine. On longer flights, I need an aisle.

**Save flexibility** opens the seat offer. The opening contains no extracted rules, offer, reward or zero balance. It illustrates saving a clear preference without presenting the technology explanation at the same time.

The offer shows the current aisle seat 22C and proposed window seat 22A. The reason is concrete.

> Another traveller needs an aisle. This window seat fits your flexibility.

The flight stays the same. A 400-credit reward and **Accept seat change** are the decision. **Back** returns to the prepared statement without changing the booking or earning credits.

Acceptance confirms window seat 22A and adds 400 credits once. The result screen centres the earned amount and explains that the credits are available for the current journey or a future one. **Use credits** continues to a later need.

## Using credits

The next screen keeps the 400-credit balance in the app header and changes the journey context to Tokyo. It shows **Your request** and one prepared statement.

> For Tokyo, I’d like us to sit together and take one extra checked bag. Use up to 360 Flex credits.

**Review request** opens a separate confirmation screen. The original statement is no longer repeated. The review contains seats together, one additional checked bag, a single 360-credit limit and an expiry of 1 November at 9 am Hong Kong time. Both changes must be arranged together. Publishing explicitly permits Flex to confirm both changes within those terms.

**Publish request** applies the existing illustrative matching and settlement operation. There is no invented processing delay or further requester approval. The result shows seats 32A, 32B and 32C together, one additional checked bag of up to 23 kg, 360 credits used and 40 remaining.

The seat arrangement costs 160 credits and the airline baggage service costs 200. The authored seat supplier has already conditionally agreed, and the baggage service is available. Personal baggage allowances never pass between travellers.

## Presentation and state

Six presentation screens sit above the existing four domain stages. Saving flexibility and reviewing a request change the presentation only. The existing `accept`, `openRequest` and `publishRequest` functions remain authoritative for earning, request eligibility and spending.

Back is available from the offer to flexibility, from the request description to the earned result, and from review to the request description. It never undoes a confirmed change or duplicates credits. The quiet restart control resets the entire local illustration to its initial state. The Earn credits and Use credits labels indicate the current phase with `aria-current="step"`.

The balance is hidden before earning. It remains visible from the reward screen onwards to connect the accepted change to the later request. Each screen uses the same compact app frame and a consistent minimum content height. Content can grow when needed, including on narrow screens. There is no nested scrolling or clipped text.

## Motion and access

Transitions use opacity and five pixels of movement over 240 milliseconds. There is no autoplay sequence, artificial typing, progress animation or waiting timer. Keyboard input and reduced-motion preferences use immediate transitions.

Every change moves reading focus to the new screen heading. If the app context is outside the visible area, the page brings its top beneath the sticky header. An already visible card preserves the visitor’s scroll position. Restart has a descriptive accessible name and tooltip. Back and the primary action remain normal keyboard-accessible buttons. Screen-reader announcements describe the current task or confirmed outcome.

## Illustration boundaries

The natural-language statements, interpretation, journeys, reward, prices and other travellers’ responses are prepared example data. This page makes no live AI or airline API calls and does not connect to a real credit account. The technology section must describe these boundaries without suggesting that the illustration is running a language model.

The matching functions validate the four-hour seat condition, counterparty request, journey, party, service availability, credit funding, expiry and all-together requirement. A missing service preserves both requested resources. The existing tests cover these constraints and the 400 earned, 360 used and 40 remaining credit flow. Presentation transitions do not weaken those checks.
