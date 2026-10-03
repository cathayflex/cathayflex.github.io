# Cathay Flex

The public product website for Team Globe’s Cathay Hackathon 2026 project, published at https://cathayflex.github.io/.

## Narrative

The page introduces the product through traveller experience, the technology behind a match and the value of portable credits. It develops three connected ideas. Different passenger priorities make useful voluntary changes possible. Flex credits carry their value across flights, seats, travel services and journeys. Travellers control the offers they accept and the terms of requests they publish.

The desktop hero keeps each complete sentence on its own line beside the photograph. The idea introduces the full loop from different traveller needs, through voluntary changes and credit rewards, to requesting an outcome of your own. A persistent booking scene and wallet connect six illustrated moments. Saving flexibility reveals a seat offer. Accepting moves the traveller from the aisle to the window and transfers 400 credits into the balance. A later request resolves to the booked Tokyo flight and three named travellers. Flex shows a fixed 360-credit quote before publication, reserves it while seeking both services, then settles the illustrated match. The balance ends at 40. Back appears in the same position throughout and is disabled at the beginning. It revisits immutable snapshots. Replay starts a new illustration without duplicating credits. Pointer interactions use brief offer, seat and credit movements. Keyboard navigation and reduced-motion preferences skip them. A separate technology section connects prepared language interpretation to computed matching results for the same examples. Its destinations, dates and credit amounts stay inside the illustration. Advancing the example does not change the product headings or surrounding explanation.

Navigation follows the same structure through The idea, Behind Flex, Flex credits and Your choices. The pale network illustration connects resource types and future journeys. The Flex Credits section explains the mechanism beyond that loop. Credits remove the need for a reciprocal swap with the same person, provide one unit for combining services, and separate the timing of earning and spending. Your Choices explains what travellers can see before committing and the distinction between saved flexibility, offer acceptance and advance request authorization. The page closes with “Let your flexibility take you further.”

## Maintenance

The site uses plain HTML, CSS and JavaScript. `index.html` contains the narrative. `style.css` provides base styles and branding, `story.css` defines the editorial layout, and `exchange.css` styles the illustration. `exchange.js` presents the interaction, `experience.mjs` defines its six immutable snapshots, and `offers.mjs` models local quoting, publication, holds and settlement. `technology.js` and `technology.css` present AI interpretation and constraint matching separately. `app.js` handles navigation and reveal motion.

Preview with Python’s HTTP server. Run `npm test` for illustration transitions and matching safeguards. The main branch is the GitHub Pages source. No CNAME is used. The previous personal-site introduction redirects here. SlidePoise publishing does not update this repository.

## Scope

The public illustration uses authored language interpretations and synthetic bookings and credits. It does not call a live language model or airline booking system. All exchanges are coordinated through Flex. A published request carries a resolved booking, exact requested outcome, fixed quote and expiry. Publication reserves credits without changing the booking. Settlement requires every requested service at its quoted line price and releases the hold on expiry. It does not add another requester approval after a matching supplier accepts. The brief visual passage compresses elapsed time for the illustration and does not promise immediate fulfilment. Baggage is an airline-issued service, not a transfer of another passenger’s personal allowance.

The authenticated platform is maintained separately. This public fixed-quote illustration does not by itself migrate the platform’s request authorization model. Its API and operational verification are documented in that project. The public page does not expose its credentials or private demonstration workspaces.

## Design and assets

The design uses Cathay Jade, white space, GT Walsheim Regular headings, Cathay Sans EN body text, restrained movement and airline photography. `assets/cathay-flex-logo.svg` is the default horizontal lockup. It preserves the brushwing and CATHAY paths from the official Cathay Cargo master and adds custom serif FLEX outlines matched to its cap height, stem weight, terminals and baseline. `assets/cathay-flex-logo-stacked.svg` retains the centered stacked alternative. Both are path-only SVGs with no font dependency. The Cargo anniversary badge is excluded. Regenerate both assets with `python3 scripts/build-brand.py`. The note “For the Cathay Hackathon demo only” stays separate and readable beneath the logo.

- [Official Cathay Cargo master](https://www.cathaycargo.com/content/dam/cargo/logo_icons/logo/cargo-logo.svg), retrieved 4 October 2026 and preserved in `assets/brand/cathay-cargo-original.svg`
- [Official Cathay wordmark](https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg)
- [Official brushwing](https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png)
- [Hero photography, Cathay Pacific](https://news.cathaypacific.com/let-s-move-beyond-362353)
- [Cathay livery and jade identity](https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html)

The photograph is credited on the page. Team Globe and the hackathon context are identified in the footer.

The font families and roles were verified against the [Cathay homepage](https://www.cathaypacific.com/cx/en_HK.html) and its [production font stylesheet](https://assets.cathaypacific.com/fonts/css/prod/fonts.css) on 3 October 2026. `fonts.css` references the first-party hosted font files. Display sizes are adapted for this product page. Regular heading weight, natural tracking and body text follow the observed roles. The authenticated platform retains its existing layout with the same font families and a local fallback.

The credit narrative draws on the exchange coordination problem illustrated in the Bank of England’s [explanation of barter and trust](https://www.bankofengland.co.uk/explainers/why-does-money-depend-on-trust). Applying that idea to Flex is a product design interpretation. Flex credits are a platform accounting unit and this analogy makes no claim about legal tender, cash conversion, guaranteed future availability or price stability.
