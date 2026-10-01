# Website verification

The current release removes the 85-second story and replaces it with a single traveller's compact offer. The main HTML copy decreases from 825 words to 276 words, measured within the main element. Navigation now has three sections.

## Automated checks

Five Node tests verify that credits require acceptance, repeat acceptance cannot issue additional credits, redemption debits once, insufficient balances prevent redemption and switching examples starts an independent illustrative booking. JavaScript syntax checks and whitespace checks pass.

## Browser checks

The flight example was accepted in the browser, adding 600 credits. Redeeming extra baggage left 400 credits. The seat example added 100 credits. Its 200-credit baggage option stayed disabled, and redeeming a preferred seat reduced the balance to zero. The zero-balance copy changes to Credits used. Reset restored the unaccepted offer.

Both desktop and a 320 CSS pixel mobile viewport were inspected. The narrow offer measures approximately 732 pixels high and has no horizontal page overflow. Menu navigation closes after selecting a section. All three navigation anchors exist, logo and photography load, and no JavaScript errors were reported. Temporary viewport settings were reset.

## Scope

Dialogue and AI interpretation are authored illustrations. The public website computes acceptance and credit arithmetic locally. It has no live language-model calls or airline integration. All illustrative bookings and credits are handled through Flex.
