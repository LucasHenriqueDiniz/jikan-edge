#!/usr/bin/env python3
"""Draws the component view of src/ as an Excalidraw file, from the real imports.

    python3 tools/architecture_diagram.py

This diagram is GENERATED and this file owns it. Do not nudge boxes in Obsidian —
the next run overwrites them with no conflict and no diff anyone reads. Demoting it
to hand-owned means deleting this script and saying so in the embedding note.

It restates data that already exists in the repo, which is the case the hexagram
`diagrams` skill names for generating rather than drawing: the edges are counted
from the actual `from '...'` statements between top-level folders of src/, so the
picture cannot drift from the code without the count changing.

Regenerating is byte-identical: every id, seed and nonce is derived from a stable
key with sha256, and `updated` is a fixed stamp. Verify with `diff -q`.

Python 3.9, stdlib only.
"""
import hashlib
import itertools
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, "src")
OUT = os.path.join(HERE, "docs", "architecture", "diagrams",
                   "component-view.excalidraw.md")

# The hexagon, left to right: what drives the application, the application itself,
# the boundary, the core, what the application drives, and what cuts across.
# A folder that is in none of these still gets drawn, in its own column, because a
# generator that silently drops a new folder is worse than an ugly diagram.
# The column ORDER is chosen, not assumed. Everything in this codebase points at
# `domain`, so putting the core in the middle of a left-to-right line forces half
# the arrows to run backwards. Measured over every permutation of these six groups,
# this order gives 8 short runs and 1 backward edge; core-in-the-middle gives 4 and
# 5. The one backward arrow left is `domain -> services`, which is the violation —
# it SHOULD be the line that looks wrong.
LAYERS = [
    ("driving", "what calls in", ["http"]),
    ("application", "use cases", ["services"]),
    ("driven", "what it calls out to",
     ["adapters", "repositories", "parsers", "source"]),
    ("boundary", "ports", ["ports"]),
    ("core", "the domain", ["domain"]),
    ("support", "cross-cutting", ["config", "observability"]),
]
TECH = "TypeScript"

BOX_W, BOX_H = 200, 78
PITCH = BOX_W + 190          # the skill's rule: box width + 160 at least
ROW = 122
# ⚠️ A two-line label at fontSize 11 is 11 x 1.25 x 2 = 27.5px tall. A lane
# spacing below that guarantees every label overlaps its neighbour — which is what
# 26 did, and no structural assertion catches it because nothing checks labels
# against each other. 44 leaves clearance.
LANE = 44
STAMP = 1

STROKE = "#1e1e1e"
MUTED = "#495057"
BAD = "#c92a2a"
FILL = {"core": "#e6efea", "boundary": "#fff9db", "driving": "#e7f5ff",
        "application": "#f3f0ff", "driven": "#f8f9fa", "support": "#f1f3f5"}


# ------------------------------------------------------------------ the graph


def scan_imports():
    """Folders of src/, and how many times each imports from another.

    Only relative and `@/`-rooted imports count: a package from node_modules is not
    a component of this system and does not belong in a component view.
    """
    tops = sorted(d for d in os.listdir(SRC) if os.path.isdir(os.path.join(SRC, d)))
    files, edges = {}, {}
    for top in tops:
        files[top] = 0
        for root, _, names in os.walk(os.path.join(SRC, top)):
            for name in names:
                if not name.endswith((".ts", ".tsx")):
                    continue
                files[top] += 1
                path = os.path.join(root, name)
                with open(path, encoding="utf-8", errors="ignore") as handle:
                    text = handle.read()
                # ⚠️ `import type` is erased at build time: it creates no runtime
                # dependency at all. Counting the two together makes the diagram
                # lie in the direction that matters most — `services -> ports` is
                # 24 type-only imports, which is the hexagon WORKING, and drawing
                # it like a runtime edge says the opposite.
                for match in re.finditer(
                        r"""import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]""",
                        text):
                    only_type, target = bool(match.group(1)), match.group(2)
                    if target.startswith("."):
                        resolved = os.path.normpath(os.path.join(root, target))
                        dest = os.path.relpath(resolved, SRC).split(os.sep)[0]
                    elif target.startswith(("@/", "src/")):
                        dest = target.split("/")[1]
                    else:
                        continue
                    if dest in tops and dest != top:
                        value, kind = edges.get((top, dest), (0, 0))
                        edges[(top, dest)] = (value + (0 if only_type else 1),
                                              kind + (1 if only_type else 0))
    return files, edges


def stable(kind, key):
    """An id or a seed derived from a stable key, so a rerun is byte-identical."""
    digest = hashlib.sha256((kind + ":" + key).encode("utf-8")).hexdigest()
    return digest[:16] if kind == "id" else int(digest[:8], 16) % (2 ** 31)


def relationship(src, dst, counts):
    """The label for a line, in the direction of the DEPENDENCY.

    C4: every line is labelled, the label consistent with direction and intent, and
    "ideally avoiding single words like 'Uses'". The count is what makes it useful
    here — it is the number this diagram exists to keep honest.
    """
    verbs = {
        ("http", "services"): "dispatches requests to",
        ("http", "domain"): "returns domain types",
        ("http", "source"): "reads upstream config",
        ("http", "config"): "reads settings from",
        ("services", "parsers"): "parses payloads with",
        ("services", "domain"): "operates on",
        ("services", "ports"): "depends on the port",
        ("services", "source"): "fetches upstream via",
        ("services", "config"): "reads settings from",
        ("services", "repositories"): "reaches the adapter directly",
        ("parsers", "domain"): "produces",
        ("ports", "domain"): "is typed by",
        ("ports", "parsers"): "is typed by",
        ("ports", "source"): "is typed by",
        ("repositories", "domain"): "stores and returns",
        ("repositories", "parsers"): "decodes rows with",
        ("repositories", "ports"): "implements the port",
        ("adapters", "repositories"): "wires",
        ("adapters", "ports"): "implements the port",
        ("domain", "services"): "depends outward on",
        ("source", "config"): "reads settings from",
        ("source", "ports"): "is typed by",
    }
    value, kind = counts
    verb = verbs.get((src, dst), "depends on")
    if not value:
        return "{}\n{} type imports".format(verb, kind)
    if not kind:
        return "{}\n{} imports".format(verb, value)
    return "{}\n{} + {} type".format(verb, value, kind)


def violations(edges):
    """The hexagon's rules, checked against the graph rather than asserted.

    They are REPORTED and drawn in red rather than aborting the run: a diagram that
    refuses to exist is a diagram nobody sees, and seeing the violation is the point.
    The exit code still carries the verdict, so CI can fail on it.
    """
    driven = ("adapters", "repositories", "parsers", "source")
    found = []
    for (src, dst), (value, kind) in sorted(edges.items()):
        if src == "domain":
            found.append(((src, dst), "the core depends outward"))
        elif src == "ports" and dst in driven:
            # ARCHITECTURE.md carries this one as an open gap in its own words:
            # "the port points outward at its own adapter's directory".
            found.append(((src, dst), "the port points at its own adapter"))
        elif src == "services" and dst in ("repositories", "adapters"):
            found.append(((src, dst), "the application names its adapter"
                          + (" (type only)" if not value else "")))
    return found


# ------------------------------------------------------------------- geometry


def anchor(box, side, t=0.5, gap=8):
    """Absolute point on an element edge, plus the fixedPoint ratio the binding needs.

    ⚠️ A bound arrow is NOT re-routed when the scene loads — Excalidraw renders the
    stored `points` verbatim and only recalculates when something is dragged. A
    generator that joins box centres therefore draws every arrow straight through
    both boxes while every structural check still passes. Every endpoint here is on
    an edge, and the binding ratio comes from the same call so the two cannot
    disagree.
    """
    x, y, w, h = box["x"], box["y"], box["width"], box["height"]
    return {
        "r": ((x + w + gap, y + h * t), [1, t]),
        "l": ((x - gap, y + h * t), [0, t]),
        "t": ((x + w * t, y - gap), [t, 0]),
        "b": ((x + w * t, y + h + gap), [t, 1]),
    }[side]


def lay_out(files):
    """A box per folder, one column per layer, stacked and vertically centred."""
    placed, known = {}, set()
    for layer in LAYERS:
        known |= set(layer[2])
    extra = [f for f in sorted(files) if f not in known and files[f]]
    layers = list(LAYERS) + ([("other", "not in the hexagon", extra)] if extra else [])

    tallest = max(len([f for f in names if files.get(f)]) for _, _, names in layers)
    for column, (kind, _, names) in enumerate(layers):
        present = [f for f in names if files.get(f)]
        top = (tallest - len(present)) * ROW / 2.0
        for row, folder in enumerate(present):
            placed[folder] = {
                "id": stable("id", folder), "kind": kind, "folder": folder,
                "x": float(column * PITCH), "y": top + row * ROW,
                "width": float(BOX_W), "height": float(BOX_H),
            }
    return placed, layers


def route(src, dst, lane):
    """Points for one arrow, always orthogonal, never over a box.

    Adjacent columns get the straight run in the empty gap between them. Anything
    else — a jump over a column, or a backward edge — drops into a lane BELOW every
    box and comes back up, which is the only place a long run is guaranteed free.
    """
    forward = dst["x"] > src["x"]
    adjacent = abs(dst["x"] - src["x"]) < PITCH * 1.5

    if forward and adjacent:
        (ax, ay), a_ratio = anchor(src, "r")
        (bx, by), b_ratio = anchor(dst, "l")
        mid = (ax + bx) / 2.0
        points = [[0, 0], [mid - ax, 0], [mid - ax, by - ay], [bx - ax, by - ay]]
        if abs(ay - by) < 0.5:                    # same row: one straight run
            points = [[0, 0], [bx - ax, 0]]
        return (ax, ay), points, a_ratio, b_ratio, "r", "l"

    # ⚠️ Dropping straight out of the bottom crosses whatever else stands in the
    # same column — which is what the crossing assertion caught the first time this
    # ran. Every vertical here runs in a GAP between columns instead, and the long
    # horizontal runs in a lane below every box.
    (ax, ay), a_ratio = anchor(src, "r")
    (bx, by), b_ratio = anchor(dst, "r")
    gap_src = src["x"] + BOX_W + (PITCH - BOX_W) / 2.0
    gap_dst = dst["x"] + BOX_W + (PITCH - BOX_W) / 2.0
    if abs(gap_src - gap_dst) < 1:
        gap_dst += 34                      # same column: two lanes, not one line
    points = [[0, 0],
              [gap_src - ax, 0],
              [gap_src - ax, lane - ay],
              [gap_dst - ax, lane - ay],
              [gap_dst - ax, by - ay],
              [bx - ax, by - ay]]
    return (ax, ay), points, a_ratio, b_ratio, "r", "r"


def assert_orthogonal(points, name):
    """An elbow arrow with a diagonal segment is not an elbow arrow."""
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        if abs(x1 - x2) > 0.5 and abs(y1 - y2) > 0.5:
            sys.exit("diagonal segment in {}: {} -> {}".format(
                name, (x1, y1), (x2, y2)))


def assert_no_crossings(boxes, arrows):
    """Every segment against every filled box. This is the load-bearing assertion."""
    bad = []
    for arrow in arrows:
        ox, oy = arrow["x"], arrow["y"]
        absolute = [(ox + px, oy + py) for px, py in arrow["points"]]
        for (x1, y1), (x2, y2) in zip(absolute, absolute[1:]):
            lo_x, hi_x = sorted((x1, x2))
            lo_y, hi_y = sorted((y1, y2))
            for box in boxes:
                # The endpoints sit on their own boxes' edges, by construction.
                if box["id"] in (arrow["startBinding"]["elementId"],
                                 arrow["endBinding"]["elementId"]):
                    continue
                bx, by = box["x"], box["y"]
                bw, bh = box["width"], box["height"]
                if lo_x < bx + bw and hi_x > bx and lo_y < by + bh and hi_y > by:
                    bad.append((arrow["id"], box["id"]))
    if bad:
        sys.exit("arrow crosses a box: {}".format(bad[:6]))


def path_midpoint(arrow):
    """Half the path LENGTH, not a vertex.

    Where Excalidraw puts a bound arrow label. Picking the middle *point* of the
    list instead lands on the end of a two-point arrow — which is how the first
    collision check here reported five collisions that were not there.
    """
    points = [(arrow["x"] + px, arrow["y"] + py) for px, py in arrow["points"]]
    spans = [math.hypot(b[0] - a[0], b[1] - a[1])
             for a, b in zip(points, points[1:])]
    half = sum(spans) / 2.0
    for (a, b), span in zip(zip(points, points[1:]), spans):
        if span == 0:
            continue
        if half <= span:
            ratio = half / span
            return (a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio)
        half -= span
    return points[-1]


def label_bounds(text_element, container):
    lines = text_element["text"].split("\n")
    width = max(len(l) for l in lines) * text_element["fontSize"] * 0.58
    height = len(lines) * text_element["fontSize"] * 1.25
    if container["type"] == "arrow":
        cx, cy = path_midpoint(container)
    else:
        cx = container["x"] + container["width"] / 2.0
        cy = container["y"] + container["height"] / 2.0
    return (cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)


def assert_labels_readable(elements):
    """No label may sit on another. Nothing else here checks this.

    ⚠️ The first version of this diagram had every arrow label piled on its
    neighbour and every structural assertion passed, because they check segments
    against boxes and text against its own container — never a label against a
    label. The cause was arithmetic: a two-line label at fontSize 11 is 27.5px
    tall and the lanes were 26px apart.
    """
    by_id = {e["id"]: e for e in elements}
    boxes = [(label_bounds(e, by_id[e["containerId"]]), e["text"])
             for e in elements
             if e["type"] == "text" and by_id.get(e.get("containerId"))]
    for (a, ta), (b, tb) in itertools.combinations(boxes, 2):
        if a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]:
            sys.exit("labels overlap: {!r} and {!r}".format(
                ta.replace("\n", " "), tb.replace("\n", " ")))


def assert_text_fits(container, text, font=13):
    """A label taller or wider than the box it is bound to is a broken diagram."""
    lines = text.split("\n")
    if len(lines) * font * 1.25 > container["height"] - 8:
        sys.exit("label taller than its box: {}".format(text))
    if max(len(l) for l in lines) * font * 0.58 > container["width"] - 12:
        sys.exit("label wider than its box: {}".format(text))


# -------------------------------------------------------------------- emitting


def base(kind, key, **extra):
    """The field set every element shares, mirrored from a file the plugin wrote."""
    element = {
        "id": stable("id", key), "type": kind, "x": 0.0, "y": 0.0,
        "width": 0.0, "height": 0.0, "angle": 0, "strokeColor": STROKE,
        "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
        "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": None, "seed": stable("s", key), "version": 1,
        "versionNonce": stable("s", key), "isDeleted": False,
        "boundElements": None, "updated": STAMP, "link": None, "locked": False,
    }
    element.update(extra)
    return element


def label(container, text, key, font=13, colour=STROKE):
    """The text half of a labelled shape. Both halves point at each other."""
    return base("text", key,
                x=container["x"] + 6, y=container["y"] + 6,
                width=container["width"] - 12,
                height=len(text.split("\n")) * font * 1.25,
                strokeColor=colour, fontSize=font, fontFamily=1, text=text,
                textAlign="center", verticalAlign="middle",
                containerId=container["id"], originalText=text, rawText=text,
                lineHeight=1.25, autoResize=False)


def build():
    files, edges = scan_imports()
    placed, layers = lay_out(files)
    broken = dict(violations(edges))

    elements, texts = [], []
    for folder in sorted(placed):
        spot = placed[folder]
        box = base("rectangle", folder, x=spot["x"], y=spot["y"],
                   width=spot["width"], height=spot["height"],
                   backgroundColor=FILL.get(spot["kind"], "#f8f9fa"),
                   roundness={"type": 3},
                   boundElements=[{"id": stable("id", folder + ":t"),
                                   "type": "text"}])
        # C4: the type and the technology are written IN the box, so colour is
        # reinforcement and nothing depends on being able to see it.
        text = "{}\n[Component · {}]\n{} files".format(folder, TECH, files[folder])
        assert_text_fits(box, text)
        elements.append(box)
        texts.append(label(box, text, folder + ":t"))

    floor = max(s["y"] + s["height"] for s in placed.values())
    arrows, lane_at = [], floor + 60
    for index, ((src, dst), counts) in enumerate(sorted(edges.items())):
        key = "{}->{}".format(src, dst)
        (ax, ay), points, a_ratio, b_ratio, _, _ = route(
            placed[src], placed[dst], lane_at + index * LANE)
        assert_orthogonal(points, key)
        colour = BAD if (src, dst) in broken else MUTED
        # Dashed is the relationship that disappears at build time.
        dashed = counts[0] == 0
        arrow = base("arrow", key, x=ax, y=ay,
                     width=max(abs(p[0]) for p in points),
                     height=max(abs(p[1]) for p in points),
                     strokeColor=colour, roundness={"type": 2}, points=points,
                     strokeStyle="dashed" if dashed else "solid",
                     lastCommittedPoint=None, elbowed=True, fixedSegments=[],
                     startIsSpecial=False, endIsSpecial=False,
                     startBinding={"elementId": placed[src]["id"], "focus": 0,
                                   "gap": 8, "fixedPoint": a_ratio},
                     endBinding={"elementId": placed[dst]["id"], "focus": 0,
                                 "gap": 8, "fixedPoint": b_ratio},
                     startArrowhead=None, endArrowhead="arrow",
                     boundElements=[{"id": stable("id", key + ":t"),
                                     "type": "text"}])
        arrows.append(arrow)
        texts.append(label(arrow, relationship(src, dst, counts), key + ":t",
                           font=11, colour=colour))

    assert_no_crossings(elements, arrows)
    assert_labels_readable(elements + arrows + texts)
    # Shapes before the arrows that bind them: array order is the z-order, and
    # `index` is omitted so Excalidraw assigns valid fractional keys itself.
    return elements + arrows + texts, files, edges, broken, layers


def legend(layers, broken):
    """C4 requires a key. It is markdown in the note, not shapes on the canvas —
    a legend drawn as boxes is one more thing the crossing assertion has to dodge."""
    rows = ["| layer | what it is | folders |", "|---|---|---|"]
    for kind, what, names in layers:
        rows.append("| **{}** | {} | {} |".format(
            kind, what, ", ".join("`{}`".format(n) for n in names)))
    out = ["\n".join(rows), "",
           "Every box is `[Component · {}]` with its file count. An arrow points "
           "at what the component **depends on**, never at where the bytes go, and "
           "carries the number of imports behind it. **A dashed arrow is "
           "`import type` only** — erased at build time, so it is a compile-time "
           "coupling and not a runtime dependency.".format(TECH)]
    if broken:
        out += ["", "**Red arrows are the hexagon's rules being broken:**", ""]
        for (src, dst), why in sorted(broken.items()):
            out.append("- `{}` → `{}` — {}".format(src, dst, why))
    return "\n".join(out)


def write(elements, files, edges, broken, layers):
    scene = {
        "type": "excalidraw", "version": 2,
        "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin",
        "elements": elements,
        "appState": {"gridSize": None, "gridStep": 5, "gridModeEnabled": False,
                     "viewBackgroundColor": "#ffffff"},
        "files": {},
    }
    bound = "\n".join(
        "{} ^{}".format(e["text"].replace("\n", " "), e["id"])
        for e in elements if e["type"] == "text")

    note = """---

excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==

# Component view — `src/`

**GENERATED by `tools/architecture_diagram.py`. Do not nudge the boxes**: the next
run overwrites them with no conflict and no diff anyone reads. To take it by hand,
delete the generator and say so here.

Saved uncompressed (`parsed`) on purpose — compressed, the diff is unreadable.

{legend}

# Excalidraw Data

## Text Elements
{bound}

## Drawing
```json
{scene}
```
%%
"""
    body = note.format(legend=legend(layers, broken), bound=bound,
                       scene=json.dumps(scene, indent="\t", ensure_ascii=False))
    folder = os.path.dirname(OUT)
    if not os.path.isdir(folder):
        os.makedirs(folder)
    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write(body)


def main():
    elements, files, edges, broken, layers = build()
    write(elements, files, edges, broken, layers)
    print("{} folders, {} relationships -> {}".format(
        len(files), len(edges), os.path.relpath(OUT, HERE)))
    for (src, dst), why in sorted(broken.items()):
        sys.stderr.write("  violation: {} -> {} — {}\n".format(src, dst, why))
    # The verdict is the exit code, so CI can fail on a violation while a human
    # still gets the drawing that shows it.
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
