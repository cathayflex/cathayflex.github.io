# Website verification

The current experience has six visitor-controlled stages. It begins with conditional seat preferences and ends with a future Tokyo baggage reservation. Both natural-language requests remain visible beside their structured interpretations. A chapter link returns to the beginning.

## Automated checks

Eight Node tests cover the short-flight match, preservation of an already-met long-flight aisle preference, soft-preference ranking, same-flight and consent requirements, seat uniqueness, correct journey and service selection, affordability, the complete earning and spending sequence, repeated actions, stage ordering and a fresh restart. JavaScript syntax and whitespace checks pass.

## Browser checks

The preference interpretation and seat offer were inspected at desktop width. The traveller's window and Alex's aisle are stated together with the same-flight condition and 300-credit reward.

The second natural-language request was inspected at 320 CSS pixels wide. Its three structured rows and action remain inside the fixed-height card. The service result showed Tokyo baggage for 200 credits against a balance of 300. Confirmation left 100 credits.

The chapter link was activated with Enter. It returned focus to the first stage, disabled itself at the beginning and removed the previous balance and reservation. Advancing again produced 300 credits, with no accumulation from the earlier run. Keyboard input is marked for immediate transitions. No horizontal page overflow or browser JavaScript errors were observed.

## Boundaries

The two natural-language sentences and their interpretations are reviewed examples. Matching and credit calculations run locally on illustrative data. The website does not make live AI calls or change real airline bookings. Every offer, booking update and credit is handled through Flex.
