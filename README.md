# Cathay Flex

The public product website for Team Globe’s Cathay Hackathon 2026 project, published at https://cathayflex.github.io/.

## Narrative

The page follows one useful change across two journeys. A voluntary Taipei seat change earns 400 Flex credits. On the later Tokyo trip, a single bounded request uses 360 credits for seats together and one extra checked bag, leaving 40. The complete cause and outcome are visible without completing the illustration.

The surrounding story shows who benefits, then broadens the idea to different resources and future journeys. There is no separate explanation tutorial or generic airline dashboard section. The compact authored illustration shows natural-language preferences, their reviewed meaning, a voluntary offer and a later authorized request.

## Maintenance

The site uses plain HTML, CSS and JavaScript. `index.html` contains the narrative. `style.css` provides base styles and branding, `story.css` defines the editorial layout, and `exchange.css` styles the illustration. `exchange.js` presents the interaction and `offers.mjs` owns its local state. `app.js` handles navigation and reveal motion.

Preview with Python’s HTTP server. Run `npm test` for illustration transitions and matching safeguards. The main branch is the GitHub Pages source. No CNAME is used. The previous personal-site introduction redirects here. SlidePoise publishing does not update this repository.

## Scope

The public illustration uses authored language interpretations and synthetic bookings and credits. It does not call a live language model or airline booking system. All exchanges are coordinated through Flex. A published request carries explicit outcome, budget and expiry terms and does not add another requester approval after a matching supplier accepts.

The authenticated platform is maintained separately. Its API and operational verification are documented in that project. The public page does not expose its credentials or private demonstration workspaces.

## Design and assets

The design uses Cathay Jade, white space, Source Sans 3, restrained movement and airline photography. `assets/cathay-flex-logo.svg` combines the original official Cathay vector with outlined FLEX lettering on a shared baseline. The note “For the Cathay Hackathon demo only” stays separate and readable beneath the logo.

- [Official Cathay wordmark](https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg)
- [Official brushwing](https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png)
- [Hero photography, Cathay Pacific](https://news.cathaypacific.com/let-s-move-beyond-362353)
- [Cathay livery and jade identity](https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html)

The photograph is credited on the page. Team Globe and the hackathon context are identified in the footer.
