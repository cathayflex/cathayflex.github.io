# One traveller, two natural-language requests

The experience follows a traveller from flexible seat preferences to a reward, then from a new travel need to a service paid for with that reward. Each screen has one primary action. Progress is visitor controlled.

## Preferences and earning

The opening sentence distinguishes short and long flights. It is displayed alongside two reviewed interpretations, Any seat for short flights and Aisle preferred for long flights. A short reveal connects the sentence to the structured rows. The words remain visible for reading and checking.

Find a seat match evaluates the current short flight, the traveller's preferences and Alex's request for an aisle. The offer proposes a window for the traveller and an aisle for Alex on the same flight. Alex has already agreed within the illustration. The traveller accepts the complete offer before 300 Flex credits are issued.

The long-flight preference is preserved. Seat preferences are scored separately from seat eligibility. A candidate is offered only if it preserves or improves the preference satisfaction of the existing booking. The same swap on a long flight is rejected because it would give up an already-held, preferred aisle seat. Other seat types remain eligible when that preference is not already met.

## A new request and spending

Use credits on your next trip opens a second sentence asking for extra baggage on a Tokyo trip next month, using credits. The interpretation identifies the journey, service and payment preference. Find options checks a small service catalogue against the request and available balance. It excludes a cheaper baggage item for the wrong journey and a seat item for the right journey.

The result is extra baggage for Tokyo at 200 Flex credits. Confirmation leaves 100 credits. The final state stays visible.

## Returning to the beginning

The existing chapter trail contains a quiet back link labelled Your flexibility. It becomes available after the first screen and remains present on desktop and mobile. Returning through this link starts the illustration from the original preferences and a zero balance. It clears the previous offer and reservation state. It has an explicit accessible name and a native tooltip. There is no separate replay or reset panel.

## Motion and access

Structured preference rows appear after the sentence with a 70-millisecond stagger. Screen transitions last 280 milliseconds. Motion is explanatory and never blocks an action. Keyboard actions and reduced-motion preferences bypass the movement. The new stage heading receives focus, and a live region describes the result.

One fixed app frame is reused across the six stages. The page retains the same editorial hierarchy and Cathay styling. Neither natural-language step is presented as a separate AI-branded feature.

## Implementation boundaries

The two sentences and their interpretations are authored product illustrations. The public website does not call a language model or airline API. Seat compatibility, service selection, consent preconditions, credit issuance and redemption execute locally against illustrative data. Credit amounts are illustrative. All offers, booking changes and credits are coordinated by Flex, with no direct traveller payments.
