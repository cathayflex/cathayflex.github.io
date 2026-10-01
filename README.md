# Cathay Flex

The public product website for Team Globe's Cathay Hackathon 2026 project, published at https://cathayflex.github.io/.

One traveller describes conditional seat preferences, accepts a compatible seat change and receives Flex credits. A second natural-language request leads to extra baggage on a future Tokyo trip. The compact interaction presents one decision at a time.

## Maintenance

The site uses plain HTML, CSS and JavaScript. Edit index.html for content, style.css for the site design, exchange.css for the interaction, exchange.js for its UI and offers.mjs for matching and credit state transitions. app.js handles navigation and progressive reveal. No build or dependency installation is required.

Preview with Python's HTTP server. Run `npm test` for conditional seat preferences, matching, consent, issuance, stage progression, restart and redemption invariants. The main branch is the GitHub Pages source. No CNAME is used. The previous personal-site introduction redirects here. SlidePoise publishing does not update this repository.

## Interaction

Both requests stay visible alongside their reviewed interpretations. The first separates short-flight flexibility from a long-flight aisle preference. The second identifies a Tokyo trip, extra baggage and payment with credits. The visitor advances through matching, consent and redemption, ending with baggage booked and 100 credits remaining. A small chapter link returns to the original preferences and restarts the experience.

The sequence uses authored natural-language interpretations. Seat compatibility, catalogue matching and credit accounting run locally. It does not make live AI calls, change bookings or issue real credits. Every exchange is coordinated and settled through Flex. No traveller-to-traveller payments are offered.

See [interaction-design.md](docs/interaction-design.md) for the sequence, review findings and implementation boundaries.

## Design and assets

The design uses Cathay Jade, white space, Source Sans 3, restrained movement and airline photography. The official Cathay logo is unmodified, with a separate FLEX label. The note “For the Cathay Hackathon demo only” appears beneath each main logo.

- [Official Cathay wordmark](https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg)
- [Official brushwing](https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png)
- [Hero photography, Cathay Pacific](https://news.cathaypacific.com/let-s-move-beyond-362353)
- [Cathay livery and jade identity](https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html)

The photograph is credited on the page. Team Globe and the hackathon context are identified in the footer.
