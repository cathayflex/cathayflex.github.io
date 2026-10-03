# Cathay Flex

The public product website for Team Globe’s Cathay Hackathon 2026 project, published at https://cathayflex.github.io/.

## Narrative

The page introduces the product through traveller experience, the technology behind a match and the value of portable credits. It develops three connected ideas. Different passenger priorities make useful voluntary changes possible. Flex credits carry their value across flights, seats, travel services and journeys. Travellers control the offers they accept and the terms of requests they publish.

The desktop hero keeps each complete sentence on its own line beside the photograph. The idea introduces the full loop from different traveller needs, through voluntary changes and credit rewards, to requesting an outcome of your own. A compact interaction separates six moments of one journey. A flexibility statement leads to an offer and an earned balance. A later request leads to a terms review and a confirmed arrangement. Each screen has one purpose. A separate technology section connects prepared language interpretation to computed matching results for the same examples. Its destinations, dates and credit amounts stay inside the illustration. Advancing the example does not change the product headings or surrounding explanation.

Navigation follows the same structure through The idea, Behind Flex, Flex credits and Your choices. The pale network illustration connects resource types and future journeys. The Flex Credits section explains the mechanism beyond that loop. Credits remove the need for a reciprocal swap with the same person, provide one unit for combining services within a budget, and separate the timing of earning and spending. Your Choices explains what travellers can see before committing and the distinction between saved flexibility, offer acceptance and advance request authorization. The page closes with “Let your flexibility take you further.”

## Maintenance

The site uses plain HTML, CSS and JavaScript. `index.html` contains the narrative. `style.css` provides base styles and branding, `story.css` defines the editorial layout, and `exchange.css` styles the illustration. `exchange.js` presents the interaction and `offers.mjs` owns its local state. `technology.js` and `technology.css` present AI interpretation and constraint matching separately. `app.js` handles navigation and reveal motion.

Preview with Python’s HTTP server. Run `npm test` for illustration transitions and matching safeguards. The main branch is the GitHub Pages source. No CNAME is used. The previous personal-site introduction redirects here. SlidePoise publishing does not update this repository.

## Scope

The public illustration uses authored language interpretations and synthetic bookings and credits. It does not call a live language model or airline booking system. All exchanges are coordinated through Flex. A published request carries explicit outcome, budget and expiry terms and does not add another requester approval after a matching supplier accepts.

The authenticated platform is maintained separately. Its API and operational verification are documented in that project. The public page does not expose its credentials or private demonstration workspaces.

## Design and assets

The design uses Cathay Jade, white space, GT Walsheim Regular headings, Cathay Sans EN body text, restrained movement and airline photography. `assets/cathay-flex-logo.svg` combines the original official Cathay vector with outlined FLEX lettering on a shared baseline. The note “For the Cathay Hackathon demo only” stays separate and readable beneath the logo.

- [Official Cathay wordmark](https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg)
- [Official brushwing](https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png)
- [Hero photography, Cathay Pacific](https://news.cathaypacific.com/let-s-move-beyond-362353)
- [Cathay livery and jade identity](https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html)

The photograph is credited on the page. Team Globe and the hackathon context are identified in the footer.

The font families and roles were verified against the [Cathay homepage](https://www.cathaypacific.com/cx/en_HK.html) and its [production font stylesheet](https://assets.cathaypacific.com/fonts/css/prod/fonts.css) on 3 October 2026. `fonts.css` references the first-party hosted font files. Display sizes are adapted for this product page. Regular heading weight, natural tracking and body text follow the observed roles. The authenticated platform retains its existing layout with the same font families and a local fallback.

The credit narrative draws on the exchange coordination problem illustrated in the Bank of England’s [explanation of barter and trust](https://www.bankofengland.co.uk/explainers/why-does-money-depend-on-trust). Applying that idea to Flex is a product design interpretation. Flex credits are a platform accounting unit and this analogy makes no claim about legal tender, cash conversion, guaranteed future availability or price stability.
