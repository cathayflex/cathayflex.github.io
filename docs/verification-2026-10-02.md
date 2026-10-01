# Website verification

The release uses one traveller and one app surface. Three actions advance from an available flight-change offer to earned credits, a future baggage purchase and a final remaining balance. No reset control, scenario selector, AI badge, timeline or automatic scene changes remain.

## Automated checks

Five Node tests verify the complete earn-and-spend sequence, prevention of spending before acceptance, single credit issuance, single redemption and protection against insufficient balances. JavaScript syntax and whitespace checks pass.

## Browser checks

The offer, earned-credit confirmation and future-trip purchase were inspected at desktop width. The entire sequence was then exercised at 320 CSS pixels wide. All four states fit within the card without content clipping or horizontal page overflow. Each action moved focus to the new stage heading. The final state confirmed extra baggage for a future trip and 400 remaining credits. The browser reported no JavaScript errors.

The 600-credit balance on the spending screen was made larger and darker after independent review. The original request stays visible until acceptance. The final result remains on screen.

## Comprehension review

Two independent agent reviewers assessed the proposed sequence. They asked for clearer offer eligibility and an explicit future-trip context. A further review of the implemented opening correctly identified the action, reward and primary control. A review of the implemented spending screen confirmed the earning-to-spending sequence and requested better balance legibility. These assessments are design reviews and do not constitute human usability testing.

## Scope

The request, interpreted offer and bookings are authored illustrations. The website computes credit transitions locally. It does not make live AI calls or change actual airline bookings. All illustrative offers, bookings and credits are handled through Flex.
