# Cathay Flex website

The public project website for Team Globe’s Cathay Hackathon 2026 entry lives at https://cathayflex.github.io/.

The current page follows the accepted project deck. It explains passenger flexibility, the marketplace, passenger experience, eight travel resources, differentiation, service design, commercial value, sustainability and Day Two. Technology is part of the same page. The previous `/technology/` address redirects to its section.

## Development

The site uses plain HTML, CSS and JavaScript without a build step.

- `index.html` contains the narrative and semantic page structure.
- `homepage.css` contains the responsive layout, typography and interaction styles.
- `homepage.mjs` handles navigation, the illustrated exchange, resource and technology tabs, authentic interface screenshots and the inline matching example.
- `homepage-model.mjs` defines the resource participation rules and immutable journey snapshots.
- `assets/deck` contains selected illustrations and interface screenshots from the accepted deck. Asset origins are recorded in `provenance.json`.
- `assets/flex-credits.svg` is the shared Flex Credit mark.

Preview and check the website locally.

```sh
python3 -m http.server 8781 --bind 127.0.0.1 --directory website
npm test --prefix website
```

Run these commands from the project root. The public GitHub Pages deployment uses the root of `cathayflex/cathayflex.github.io` on `main`. This project's `website` directory is the maintained source. Updating the project repository alone does not publish the public site.

## Interactive examples

The illustrated passenger story starts with 600 credits, earns 160 for a completed seat change, then spends 360 on family seating and an extra bag. Its final balance is 400. Back and replay revisit immutable states, so neither action duplicates a reward or a payment. Seat numbers, passenger icons and names occupy separate rows.

The resource explorer preserves the different participation rules. Seat changes, flight changes and baggage allowance can earn and use credits. Meal choice earns credits. Upgrades, neighbour-free seats, lounge access and Wi-Fi use credits.

The four interface views use authentic screenshots from the current deck. They are views of the project interface, not live account sessions.

The technology section presents AI interpretation, exchange optimisation and transaction coordination. Its optional matching example loads `technology/lab.mjs`, which executes the exported platform engine with fixed example data. Changing baggage availability changes the computed result. No live airline booking is changed. The AI explanation is authored copy, not a live language-model call.

The existing pure engine, manifest, fixtures and earlier model tests remain for maintenance and regression checks. The earlier standalone page styles and interaction scripts are no longer loaded by the homepage. `technology/manifest.json` records the exported source hashes. Regenerate the export deliberately when platform domain logic changes.

## Content and assets

Research attribution sits beside the relevant evidence. The site preserves the survey population and trial context. Sustainability copy distinguishes reduced preparation and weight from emissions allocated per passenger.

The Cathay wordmarks, resource SVGs and first-party hosted fonts are shared with the rest of the project. Selected illustrations come from the accepted Cathay Flex deck. Private PwC reference material is not part of this site. The final section retains the user-approved closing line.

All interactive controls support keyboard input. Motion respects reduced-motion preferences. Mobile navigation closes on Escape, outside interaction and link activation. The page remains readable across narrow and wide screens without nested scrolling containers.
