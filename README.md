# Cathay Flex

The public product website for Team Globe's Cathay Hackathon 2026 project, published at https://cathayflex.github.io/.

One traveller accepts a later flight, receives Flex credits and uses some for extra baggage on a future trip. The compact interaction presents one decision at a time. There is no film player or timed scene sequence.

## Maintenance

The site uses plain HTML, CSS and JavaScript. Edit index.html for content, style.css for the site design, exchange.css for the interaction, exchange.js for its UI and offers.mjs for credit state transitions. app.js handles navigation and progressive reveal. No build or dependency installation is required.

Preview with Python's HTTP server. Run `npm test` for issuance, stage progression and redemption invariants. The main branch is the GitHub Pages source. No CNAME is used. The previous personal-site introduction redirects here. SlidePoise publishing does not update this repository.

## Interaction

The traveller's request remains visible above the offer. Each subsequent action reveals one new stage, ending with extra baggage booked and 400 credits remaining. Motion supports those changes without imposing a viewing duration. There are no example tabs, replay controls, AI badges or panels of simultaneous conditions. Reduced-motion preferences suppress the transitions.

The sequence is an authored product illustration. Credits and redemption are calculated locally. This static website does not make live AI calls, change bookings or issue real credits. Every exchange is coordinated and settled through Flex. No traveller-to-traveller payments are offered.

See [interaction-design.md](docs/interaction-design.md) for the sequence, review findings and implementation boundaries.

## Design and assets

The design uses Cathay Jade, white space, Source Sans 3, restrained movement and airline photography. The official Cathay logo is unmodified, with a separate FLEX label. The note “For the Cathay Hackathon demo only” appears beneath each main logo.

- [Official Cathay wordmark](https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg)
- [Official brushwing](https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png)
- [Hero photography, Cathay Pacific](https://news.cathaypacific.com/let-s-move-beyond-362353)
- [Cathay livery and jade identity](https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html)

The photograph is credited on the page. Team Globe and the hackathon context are identified in the footer.
