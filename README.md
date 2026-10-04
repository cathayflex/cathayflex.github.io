# Cathay Flex

The public product website for Team Globe’s Cathay Hackathon 2026 project, published at https://cathayflex.github.io/.

## Narrative

The page introduces the product through traveller experience, the technology behind a match and the value of portable credits. It develops three connected ideas. Different passenger priorities make useful voluntary changes possible. Flex credits carry their value across flights, seats, travel services and journeys. Travellers control the offers they accept and the terms of requests they publish.

The idea presents six illustrated moments with a compact, persistent credit balance. Standing preferences lead to an offer, an accepted seat change earns 400 credits, and a later request shows a fixed 360-credit quote for adjacent seats and an extra bag. Publishing that request authorises its terms and holds the quoted credits. Confirmation leaves 40 credits. Each moment has one main action. Back revisits immutable snapshots and replay starts a fresh illustration. Brief seat and balance movements connect actions with outcomes. Keyboard input and reduced-motion preferences skip the animation.

Behind Flex pairs natural language with structured conditions and a computed match. A single link opens the technical page. Flex Credits explains how a contribution through one resource can fund a different resource or a later journey, accompanied by the four resource groups and their eight services. Your Choices presents offer terms, request deadlines and booking updates. The page closes with “Let your flexibility take you further.”

## Maintenance

The site uses plain HTML, CSS and JavaScript. `index.html` contains the narrative. `style.css` provides base styles and branding, `story.css` defines the editorial layout, and `exchange.css` styles the illustration. `exchange.js` presents the interaction, `experience.mjs` defines its six immutable snapshots, and `offers.mjs` models local quoting, publication, holds and settlement. `technology.js` and `technology.css` present AI interpretation and constraint matching separately. `app.js` handles navigation and reveal motion.

Preview with Python’s HTTP server. Run `npm test` for illustration transitions and matching safeguards. The accepting traveller’s reward matches the requesting traveller’s authorised fixed quote. The main branch is the GitHub Pages source. No CNAME is used. The previous personal-site introduction redirects here. SlidePoise publishing does not update this repository.

## Scope

The public illustration uses authored language interpretations and synthetic bookings and credits. It does not call a live language model or airline booking system. All exchanges are coordinated through Flex. A published request carries a resolved booking, exact requested outcome, fixed quote and expiry. Publication reserves credits without changing the booking. Settlement requires every requested service at its quoted line price and releases the hold on expiry. It does not add another requester approval after a matching supplier accepts. The brief visual passage compresses elapsed time for the illustration and does not promise immediate fulfilment. Baggage is an airline-issued service, not a transfer of another passenger’s personal allowance.

The authenticated platform is maintained separately and now enforces fixed quotes through its API and transaction engine. Its operational verification is documented in that project. The public page does not expose its credentials or private demonstration workspaces.

## Design and assets

The design uses Cathay Jade, white space, GT Walsheim Regular headings, Cathay Sans EN body text, restrained movement and airline photography. `assets/cathay-flex-logo.svg` is the default horizontal lockup. It preserves the brushwing and CATHAY paths from the official Cathay Cargo master and adds custom serif FLEX outlines matched to its cap height, stem weight, terminals and baseline. `assets/cathay-flex-logo-stacked.svg` retains the centered stacked alternative. Both are path-only SVGs with no font dependency. The Cargo anniversary badge is excluded. Regenerate both assets with `python3 scripts/build-brand.py`. The note “For the Cathay Hackathon demo only” stays separate and readable beneath the logo.

- [Official Cathay Cargo master](https://www.cathaycargo.com/content/dam/cargo/logo_icons/logo/cargo-logo.svg), retrieved 4 October 2026 and preserved in `assets/brand/cathay-cargo-original.svg`
- [Official Cathay wordmark](https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg)
- [Official brushwing](https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png)
- [Hero photography, Cathay Pacific](https://news.cathaypacific.com/let-s-move-beyond-362353)
- [Cathay livery and jade identity](https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html)

The photograph is credited on the page. Team Globe and the hackathon context are identified in the footer.

The eight resource symbols in `assets/resources/` share a 24-unit grid, a 1.6-unit stroke and rounded terminals. Each resource has a distinct silhouette. The platform uses the same paths in `ResourceIcon`, and the film receives identical SVG exports. The canonical path definitions live in the platform’s `public/resources/icons.json`. Run its `scripts/build-resource-icons.mjs` with this site’s `assets/resources` directory to refresh the exports.

The font families and roles were verified against the [Cathay homepage](https://www.cathaypacific.com/cx/en_HK.html) and its [production font stylesheet](https://assets.cathaypacific.com/fonts/css/prod/fonts.css) on 3 October 2026. `fonts.css` references the first-party hosted font files. Display sizes are adapted for this product page. Regular heading weight, natural tracking and body text follow the observed roles. The authenticated platform retains its existing layout with the same font families and a local fallback.

The credit narrative draws on the exchange coordination problem illustrated in the Bank of England’s [explanation of barter and trust](https://www.bankofengland.co.uk/explainers/why-does-money-depend-on-trust). Applying that idea to Flex is a product design interpretation. Flex credits are a platform accounting unit and this analogy makes no claim about legal tender, cash conversion, guaranteed future availability or price stability.

## Inside the system

`/technology/` is a separate technical page reached from Behind Flex. The homepage keeps its two compact illustrations and links to this page instead of embedding structured rule disclosures.

The detail page follows three visual chapters. Interpret pairs natural language with resolved matching rules. Allocate compares current and proposed seats alongside the extra bag and agreed credit amount. Confirm shows reservation, booking confirmation and settlement. Four compact disclosures retain conditional rules, allocation methods, recovery behaviour and engineering evidence on the same page.

The matching visual runs exported platform domain code with synthetic data. Visitors can change availability, expire a request, compare seat assignments and complete the exchange. A small conflict example explains how branch-and-bound selects compatible arrangements. The recovery example follows a lost booking response through reconciliation and a single settlement.

Regenerate the engine after platform changes with an architecture-compatible Node runtime and the platform's installed esbuild.

```sh
node scripts/build-engine.mjs /absolute/path/to/cathay-flex
npm test
```

The export copies only reviewed pure domain modules into `technology/source`. It never copies API handlers, authentication, environment files or live state. `technology/manifest.json` records per-file hashes, an aggregate digest and the base commit. `technology/benchmark.json` records bounded synthetic performance measurements. The linked research note distinguishes implemented methods from proposed experiments. The exact exported source is committed beside the browser bundle.

The technical explanation stays on `/technology/`. Previous `/technology/source/<module>/` reading URLs redirect to their relevant chapter. `scripts/build-source-readers.mjs` maintains those redirects and verifies the existing export against its manifest. Original TypeScript remains in the public repository, linked from Code and example data.
