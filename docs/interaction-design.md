# One traveller, one decision at a time

The visual begins with earning and follows the same person into spending on a future trip. There is one app surface and one primary action at each stage. All progress is visitor controlled.

## The four states

1. The traveller says “I can fly later.” A coordinated offer proposes a departure two hours later and a reward of 600 Flex credits. The request stays visible so its relationship to the offer can be read at any pace. Accept offer advances the interaction.
2. The booking change is confirmed. The card states that departure is two hours later and that 600 Flex credits have been added. Use on a future trip advances to redemption.
3. The next-trip context is explicit. Extra baggage costs 200 Flex credits, and the available balance is 600. Use 200 credits confirms the choice.
4. The final state shows extra baggage booked for the next trip and 400 Flex credits remaining. It stays visible.

The surrounding copy explains that a reward can be offered when another traveller needs the flight. It does not suggest that every requested flight change earns credits. Every offer, booking change and credit is handled by Flex.

## Movement and hierarchy

The visitor's request and resulting offer arrive once, with 280 milliseconds between the two reveals. The original request remains readable. Subsequent clicks replace the single card's contents with a 420-millisecond transition. There is no automatic advancement, playback timeline, scene picker, restart control or separate AI panel.

The card remains in the same position and keeps a stable height. The single primary action advances exactly one stage. The new heading receives keyboard focus without requesting a scroll. A live region announces the booking and balance outcomes. Reduced-motion preferences suppress movement.

## Review

Two independent agent reviews considered the proposed sequence as first-time visitors. They identified the need to establish offer eligibility and distinguish a future trip from the current one. Both points were incorporated. A review of the implemented opening confirmed that its action, reward and next step were understandable, and recommended making the future-trip purpose explicit in the progress label. These are design reviews, not human usability tests.

## Boundaries

The request, offer and interpretation are authored illustrations. The static site calculates credits and redemption locally. It does not call an AI service, alter a real flight or reserve baggage. In the full product, every affected traveller must agree before settlement. The initial card represents an available coordinated offer.
