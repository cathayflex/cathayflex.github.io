# Cathay Flex

The public product website for Team Globe's Cathay Hackathon 2026 project.

The site is maintained directly in this repository and published at https://cathayflex.github.io/. The personal website's previous introduction now redirects here. SlidePoise publishing never updates this repository.

Edit index.html for the product narrative and style.css for the visual system. The cinematic exchange uses story.css, story.mjs and the pure matching and credit functions in market.mjs. The app.js file controls page navigation and progressive motion. The site uses plain HTML, CSS and JavaScript. No build or external API is required.

Preview locally with Python's HTTP server, then inspect desktop and mobile widths before publishing. The main branch is the GitHub Pages source. The repository has no CNAME so the GitHub domain remains its public address.

## Product presentation

The site presents Flex as a product through passenger value and airline value. It covers exchanges across flight timing, seats, catering choices and travel extras, including future journeys. Examples explain the mechanism without inventing prices, adoption figures, booking availability or measured airline savings.

The site has no booking or account backend. Its illustrated story runs real matching and credit checks on synthetic data. Dialogue, AI preference interpretations and passenger confirmations are authored for the presentation. The application and simulation remain separate.

## Design and motion

The visual system uses Cathay Jade, white space, a light humanist sans serif and airline photography. The official Cathay wordmark and brushwing assets are used unmodified. A small “For the Cathay Hackathon demo only” note appears beneath each main logo. FLEX is a separate project label. Source Sans 3 is served through Google Fonts.

The hero uses a single image arrival. Scroll reveals run once. The 85-second exchange story uses close-ups, camera moves and a deliberate pullback to connect a central platform with three passenger phones, supports pause, seeking and a larger viewing mode, and derives consistent balances when replayed. Supporting exchange examples remain visible without tabs. Navigation highlights the current chapter, and keyboard navigation is immediate. Reduced-motion preferences suppress movement. All navigation and product information remain in ordinary HTML.

The page introduces the marketplace, follows one exchange from an individual travel problem to future redemption, shows two further exchange types, explains platform-managed credit funding and spending, then covers passenger control and airline value. The five navigation links follow that reading order. In-page promotional links are omitted. The footer has an explicit Back to top control.

## Sources and credits

- Cathay's account of its jade identity and brushwing heritage, https://www.cathaypacific.com/cx/en_HK/inspiration/cathay-stories/cathay-pacific-livery.html
- Cathay brand colour guidance, https://www.cxagents.com/content/dam/cathay-agents/media-library/il/logos/Logo%20usage%20guidelines%20-%20Please%20read.pdf
- Hero photograph © Cathay Pacific, from https://news.cathaypacific.com/let-s-move-beyond-362353
- Original photograph asset, https://cdn.uc.assets.prezly.com/14e363a7-4611-4e89-9073-307112f161da/-/quality/best/-/format/auto/

The photograph remains credited on the page. Team Globe and the hackathon context are identified in the footer.

- Official Cathay wordmark, https://www.cathaypacific.com/content/dam/content-fragment/en_hk/config/logo.originalimage.svg
- Official Cathay brushwing, https://www.cathaypacific.com/content/dam/header-footer/cx_brushwing_logo.originalimage.png

## Story and verification

The full scene plan and implementation boundaries are in [experience-story.md](docs/experience-story.md). Run `npm test` to verify the matching, consent, funding, redemption and replay invariants. No dependency installation is required.
