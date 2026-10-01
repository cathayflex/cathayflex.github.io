# Cathay Flex exchange story

## The communication problem

A first-time viewer needs to know whose problem is being solved before seeing the matching system. Showing every phone and the entire platform from the first scene gives all information equal visual weight. This sequence introduces the people one at a time, establishes their conditions and only then pulls back to show the coordinated exchange.

Every exchange is offered, confirmed and settled through Flex. Travellers do not bargain privately or send payments to one another. Any credit adjustment belongs to the platform's complete offer. The central platform remains responsible for consent, booking changes and credit accounting.

## The cast

| Traveller | Original booking | Condition | Platform offer | Reward |
| --- | --- | --- | --- | --- |
| Maya | 10:00 departure, window 22A | Can leave up to two hours later if given an aisle seat | 12:00 departure, aisle 18C | 600 Flex |
| Alex | 12:00 departure, window 18A | Must arrive before 13:00 after a connection changes | 10:00 departure, window 22A, arrival 11:40 | Earlier arrival |
| Sam | 12:00 departure, aisle 18C | Must keep the noon flight, accepts window or aisle | 12:00 departure, window 18A | 100 Flex |

These are illustrative travellers, flights and credit amounts. Both flights use the same time zone. The earlier flight arrives at 11:40 and the later flight at 13:40. Cathay's approved recovery budget funds the 700-credit offer.

## Ten scenes and their focal points

| Scene | Seconds | Shot | What the audience should notice |
| --- | --- | --- | --- |
| A change of plans | 7 | Alex's phone, close | His current 13:40 arrival misses the new 13:00 requirement |
| A little flexibility | 8 | Camera moves to Maya | Her earlier place could help, but she needs an aisle on a later flight |
| Words become conditions | 8 | Push into the platform's interpretation | The two phrases map to a departure limit and an aisle condition for Maya to confirm |
| Why a simple swap fails | 7 | Return to Maya's proposed booking | A direct Maya and Alex swap gives Maya a window seat, so Flex rejects it |
| The third person | 7 | Move to Sam's phone | Sam holds the needed aisle and is willing to take a window on the same flight |
| The complete match | 12 | Pull back to the platform and three phones | The focal connection moves from Maya to Sam to Alex, explaining one assignment at a time |
| Everyone decides | 10 | Hold the coordinated view | Each person sees an offer, with approvals arriving separately before any final change |
| The exchange is complete | 7 | Return to Alex's confirmed phone | The earlier arrival solves his problem. Rewards are released after complete verification |
| A future journey | 12 | Maya's phone, then move to Sam's | Maya uses 200 credits for baggage on a Tokyo trip. Sam uses 100 for a preferred seat on a Bangkok trip |
| What it made possible | 7 | A quiet outcome frame | The human results resolve the story. 700 credits issued less 300 used leaves 400 available |

The sequence lasts 85 seconds. Each shot has a short focal headline and at most a small amount of supporting copy. Earlier character introductions make the eventual three-person view understandable.

## Camera and composition

The desktop scene uses a persistent 1200 by 600 stage. Each phone and the central platform has a fixed location in that world. A camera transform moves and scales the world into the viewport. Close-ups isolate one phone. The AI shot moves into the platform. The matching shot pulls back and gives one phone and its connection visual emphasis at a time.

Camera motion uses transform, with a controlled ease over 1150 milliseconds. The headline fades into each new scene while inactive elements leave the focal frame. Manual seeking is immediate. Reduced-motion preferences remove camera movement and connection animation.

On narrow screens the same sequence uses a vertical composition, placing the short explanation above the current phone. The three-person view uses compact booking cards only after each person has been introduced. The information order stays the same.

## Browser execution

`market.mjs` enumerates all six one-to-one assignments of three seats. It checks passenger conditions, unique seat assignments and the reward budget. Exactly one assignment succeeds. A direct Maya and Alex swap fails Maya's aisle condition.

Settlement requires all three acceptances. Balances are derived from the agreed offer. Redemption rejects invalid prices and insufficient funds. Seeking and replaying derive snapshots without repeating issuance.

This website presents an authored product story. Dialogue, AI interpretations and passenger decisions are scripted. There is no live model request, personal booking access or airline integration. The matching and accounting calculations do execute locally on the illustrative inputs.

## Controls and identity

The story starts paused. Play, pause, previous scene, next scene and a labelled slider control the timeline. View larger opens the same player in a native dialog. Escape and Close return to the inline presentation and pause playback. A hidden tab or an off-screen player pauses as well.

The official Cathay logo is kept intact. FLEX uses a stronger weight and aligns with the wordmark baseline. The small note underneath reads “For the Cathay Hackathon demo only”.
