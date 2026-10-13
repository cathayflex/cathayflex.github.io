# Public website design decisions

The visitor should understand who can participate, how an exchange works and what credits make possible without needing the deck or a presenter.

## Content and layout

Each section answers a different visitor question. Introduce the marketplace, show evidence of passenger flexibility, explain the stakeholder process, demonstrate the interface, then let the visitor explore resources and value. Avoid feasibility arguments, implementation catalogues and development roadmaps on this public page.

A normal laptop or phone viewport should contain the section’s complete communication task. Check actual rendered section heights against the viewport minus the sticky header. Check every selectable state, since a longer description can change the required height. Use responsive selectors for parallel details and omit duplicate introductory text on short phones. Preserve readable text and normal scrolling at smaller sizes or increased browser zoom.

The app preview is a fixed native composition. Scale its complete 390 × 820 frame to the available preview area. The frozen controls have no input or button semantics. The surrounding tab controls provide keyboard access and select the displayed screen. Paris and lounge photos remain image assets, while text and shapes render as browser elements.

## Meaning and interaction

The hero’s credit arrow points upward into Cathay Flex. It identifies credits as part of the marketplace. The passenger-flow view separately explains how the platform coordinates balances and payments.

The five flow stages identify who sends a request, how a match is found, who accepts a change, how the booking is updated and when credits reach the helping passenger. Plain-language headings and visible actor labels carry the explanation. Readers should not have to infer meaning from an arrow alone.

All tab groups support arrow keys, Home and End. Mobile navigation closes on Escape, outside interaction and link activation. Video dismissal pauses playback, releases the page and restores focus. Transitions respect reduced-motion preferences.

The final section contains only the logo and “Let your flexibility take you further.”
