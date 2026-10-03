#!/usr/bin/env python3
"""Build path-only Cathay Flex lockups from the official Cathay Cargo master.

The brushwing and CATHAY contours are preserved. FLEX is custom lettering
using the master’s cap height, stem weight, flared terminals and baseline.
"""
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/brand/cathay-cargo-original.svg"
NS = "{http://www.w3.org/2000/svg}"
paths = ET.parse(SOURCE).getroot().findall(f".//{NS}path")
wing = paths[1].attrib["d"]
cathay = paths[2].attrib["d"]

# Cap height is 100. Stem width and terminal curvature follow the source H.
# The source T informs the open horizontal terminals. The source Y informs X.
letters = {
    "F": "M0 0 H67 C75 0 77 -1.13 77 -1.13 L77 18.78 L76.34 18.27 C76.34 18.27 70.85 9.65 59.39 9.65 H27.54 V43 H49 C58 43 61 37.8 61 37.8 L61.66 37.2 V58.45 L61 57.8 C61 57.8 58 52.65 49 52.65 H27.54 V86.5 C27.54 98.3 34.07 99.32 34.07 99.32 L34.7 100 H0 L0.69 99.32 C0.69 99.32 7.16 98.3 7.16 86.5 V13.3 C7.16 1.5 0.69 0.68 0.69 0.68 Z",
    "L": "M0 0 H34.7 L34.07 0.68 C34.07 0.68 27.54 1.5 27.54 13.3 V90.35 H48 C63 90.35 72 79 72 79 L72.8 78.5 L67.1 100 H0 L0.69 99.32 C0.69 99.32 7.16 98.3 7.16 86.5 V13.3 C7.16 1.5 0.69 0.68 0.69 0.68 Z",
    "E": "M0 0 H64 C72 0 74 -1.13 74 -1.13 V18.78 L73.34 18.27 C73.34 18.27 67.85 9.65 56.39 9.65 H27.54 V42 H48 C57 42 60 36.8 60 36.8 L60.66 36.2 V57.45 L60 56.8 C60 56.8 57 51.65 48 51.65 H27.54 V90.35 H52 C65 90.35 74 79 74 79 L74.8 78.5 L69.1 100 H0 L0.69 99.32 C0.69 99.32 7.16 98.3 7.16 86.5 V13.3 C7.16 1.5 0.69 0.68 0.69 0.68 Z",
    "X": "M0 0 H39.99 L39.36 0.68 C39.36 0.68 30.75 3.05 37.22 13.44 L56.8 43.7 L76.65 13.52 C83.43 3.16 74.85 0.68 74.85 0.68 L74.16 0 H104.66 L103.98 0.68 C103.98 0.68 95.34 1.75 87.82 13.52 L62.7 51.85 L86.4 86.5 C94.8 98.3 101.6 99.32 101.6 99.32 L102.3 100 H62.1 L62.78 99.32 C62.78 99.32 70.9 97.1 64.55 87.1 L44.1 56.65 L24.6 86.5 C17.2 97.5 24.7 99.32 24.7 99.32 L25.38 100 H-4.3 L-3.62 99.32 C-3.62 99.32 4.75 98.1 12.7 86.5 L38.25 48.1 L14.04 13.44 C6.47 1.67 0.66 0.68 0.66 0.68 Z",
}
positions = {"F": 0, "L": 87, "E": 170, "X": 258}
flex = "\n".join(f'      <path data-letter="{letter}" transform="translate({positions[letter]} 0)" d="{path}"/>' for letter, path in letters.items())
wordmark = f'''<path d="{cathay}"/>
    <g transform="translate(101.344388 11.9128447) scale(.118891153)">
{flex}
    </g>'''


def svg(layout, viewbox, width, height, artwork):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{viewbox}" role="img" aria-labelledby="logo-title logo-desc">
  <title id="logo-title">Cathay Flex</title>
  <desc id="logo-desc">{layout} lockup for the Team Globe Cathay Hackathon concept. Official Cathay brushwing and wordmark with custom FLEX lettering.</desc>
  <g fill="#006B6E" fill-rule="nonzero">
{artwork}
  </g>
</svg>
'''

# The horizontal layout retains the master’s original spacing and baseline.
horizontal = svg("Horizontal", "-0.5 -0.5 145.5 25", 1164, 200, f'''    <path d="{wing}"/>
    {wordmark}''')
# The stacked layout places a larger brushwing above the centered wordmark.
stacked = svg("Stacked", "-1 -1 120 49.5", 960, 396, f'''    <g transform="translate(48.57 0) scale(1.1)"><path d="{wing}"/></g>
    <g transform="translate(-26.0800281 22.6)">{wordmark}</g>''')
(ROOT / "assets/cathay-flex-logo.svg").write_text(horizontal)
(ROOT / "assets/cathay-flex-logo-stacked.svg").write_text(stacked)
print("Built horizontal and stacked Cathay Flex SVGs")
