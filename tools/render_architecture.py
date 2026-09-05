#!/usr/bin/env python3
"""Renders the generated diagram to SVG, from the STORED points.

    python3 tools/render_architecture.py && open docs/architecture/diagrams/preview.svg

⚠️ This exists because structural validation passes on diagrams that are visibly
broken. A preview that joins box centres would hide exactly the class of bug the
generator's geometry is written to avoid, so this reads the same `points` Excalidraw
will read and nothing else.

Python 3.9, stdlib only.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, "docs", "architecture", "diagrams",
                   "component-view.excalidraw.md")
OUT = os.path.join(HERE, "docs", "architecture", "diagrams", "preview.svg")


def escape(text):
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def main():
    with open(SRC, encoding="utf-8") as handle:
        scene = json.loads(re.search(r"```json\n(.*?)\n```",
                                     handle.read(), re.S).group(1))
    elements = scene["elements"]
    xs, ys = [], []
    for element in elements:
        xs += [element["x"], element["x"] + element.get("width", 0)]
        ys += [element["y"], element["y"] + element.get("height", 0)]
        for px, py in element.get("points", []):
            xs.append(element["x"] + px)
            ys.append(element["y"] + py)
    pad = 40
    minx, miny = min(xs) - pad, min(ys) - pad
    width, height = max(xs) - minx + pad, max(ys) - miny + pad

    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="{:.0f}" height="{:.0f}" '
           'viewBox="0 0 {:.0f} {:.0f}"><rect width="100%" height="100%" '
           'fill="#fff"/>'.format(width, height, width, height)]
    for element in elements:
        x, y = element["x"] - minx, element["y"] - miny
        if element["type"] == "rectangle":
            out.append('<rect x="{:.1f}" y="{:.1f}" width="{:.1f}" height="{:.1f}" '
                       'rx="8" fill="{}" stroke="{}" stroke-width="2"/>'.format(
                           x, y, element["width"], element["height"],
                           element["backgroundColor"], element["strokeColor"]))
        elif element["type"] == "arrow":
            path = " ".join("{}{:.1f},{:.1f}".format("M" if i == 0 else "L",
                                                     x + px, y + py)
                            for i, (px, py) in enumerate(element["points"]))
            out.append('<path d="{}" fill="none" stroke="{}" stroke-width="2"/>'
                       .format(path, element["strokeColor"]))
        elif element["type"] == "text":
            lines = element["text"].split("\n")
            size = element["fontSize"]
            for row, line in enumerate(lines):
                out.append('<text x="{:.1f}" y="{:.1f}" font-size="{}" '
                           'font-family="sans-serif" text-anchor="middle" '
                           'fill="{}">{}</text>'.format(
                               x + element["width"] / 2.0,
                               y + (row + 1) * size * 1.25, size,
                               element["strokeColor"], escape(line)))
    out.append("</svg>")
    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write("".join(out))
    print("{} elements -> {}".format(len(elements), os.path.relpath(OUT, HERE)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
