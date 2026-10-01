# Cathay Flex

The public product website for Team Globe's Cathay Hackathon 2026 project, published at https://cathayflex.github.io/.

The page introduces Flex through one traveller's preferences, a coordinated offer and credits for a future journey. A compact interface lets the visitor switch between a flight change and a seat change, accept an illustrative offer and use its credits. There is no timed film or automatic scene sequence.

## Maintenance

The site uses plain HTML, CSS and JavaScript. Edit index.html for content, style.css for the site design, exchange.css for the interaction, exchange.js for its UI and offers.mjs for the examples and balance rules. app.js handles navigation and progressive reveal. No build or dependency installation is required.

Preview with Python's HTTP server. Run `npm test` for credit and redemption invariants. The main branch is the GitHub Pages source. No CNAME is used. The previous personal-site introduction redirects here. SlidePoise publishing does not update this repository.

## Interaction

One traveller describes an acceptable change. Flex AI displays two interpreted conditions, then the offer appears with a short reveal lasting less than a second. The visitor can accept the offer, receive credits and select a future service. Motion does not hide the information, force a playback sequence or rotate examples. Reduced-motion preferences suppress it.

Dialogue and AI interpretations are authored examples. Credits and redemption are calculated locally. This static product website does not make live AI calls, change bookings or issue real credits. Every exchange is presented as coordinated and settled through Flex. No traveller-to-traveller payments are offered.

## Design and assets

The design uses Cathay Jade, white space, Source Sans 3, restrained movement and airline photography. The official Cathay logo is unmodified, with a separate FLEX label. The note “For the Cathay Hackathon demo only” appears beneath each main logo.

- [Official Cathay wordmark](https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg)
- [Official brushwing](https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png)
- [Hero photography, Cathay Pacific](https://news.cathaypacific.com/let-s-move-beyond-362353)
- [Cathay livery and jade identity](https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html)

The photograph is credited on the page. Team Globe and the hackathon context are identified in the footer.
