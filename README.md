# Cathay Flex website

The public website for Team Globe’s Cathay Hackathon 2026 project lives at https://cathayflex.github.io/.

The page introduces passenger flexibility, explains how passengers and Cathay participate in an exchange, presents the passenger interface and travel benefits, and explains the resulting value. The project deck supplies the underlying information. The website selects the detail useful to a public visitor.

## Development

The site uses HTML, CSS and JavaScript without a build step. Run these commands from the project root.

```sh
python3 -m http.server 8781 --bind 127.0.0.1 --directory website
npm test --prefix website
```

- `index.html` contains the page narrative and semantic structure.
- `homepage.css` contains the responsive page layout.
- `homepage.mjs` handles navigation, the passenger-flow steps, resource selectors and video playback.
- `homepage-model.mjs` holds the eight resource participation rules and the earlier illustrated-journey fixtures.
- `interface-preview.mjs` and `interface-preview.css` construct the four frozen interface views with native text, shapes and the platform’s original photos.
- `assets/interface` contains the Paris and lounge photographs copied from the platform.
- `assets/video/cathay-flex.mp4` is the latest supplied film, copied from `video/Cathay Flex Pitch (new vid v2).mp4`.
- `assets/deck` contains accepted project illustrations. Their origins are recorded in `provenance.json`.

## Interaction design

Each section handles one communication task and fits the available screen height at ordinary laptop and phone sizes. Narrow screens use selectors for parallel research and sustainability details. Shorter phones omit repeated introductory copy while preserving the main explanation, evidence and resource participation rules. Content stays in normal page flow without scroll locking or mandatory scroll snapping.

The passenger-flow diagram follows the deck’s stakeholder model. Its five selectable stages explain the requesting passenger, the helping passenger, Cathay’s booking updates and credit settlement. It does not execute a booking or change a balance.

The four interface previews reproduce the content and visual structure of the approved platform screenshots. Text and interface shapes are native browser elements. The app contents are frozen, with no internal scrolling or account actions. The surrounding tabs switch between Journey, Request changes, Earn credits and View balance.

The opening video button loads the latest film in a native video dialog. Closing it pauses playback and returns focus to the opening button. The film’s music attribution appears below the player.

The earlier matching lab, technical precedents, Day Two and commercial accounting explanation are absent from the public page. The `/technology/` address redirects to the inline matching explanation. Earlier pure engine modules and tests remain in the repository for maintenance and provenance, and the homepage does not load them.

The closing contains the Cathay Flex logo and the approved closing line. Additional buttons, benefits and supporting paragraphs do not belong in that section.

## Publishing

The maintained source is this `website` directory. GitHub Pages publishes the root of `cathayflex/cathayflex.github.io` on `main`. Updating the project repository alone does not publish the public site.

Private PwC reference material is excluded. Research links accompany the relevant evidence. Keep resource earning rules, exact logos and source attribution intact when revising the public copy.
