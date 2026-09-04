# Diagrams

Architecture diagrams in Excalidraw format, rendered by the Obsidian **Excalidraw**
community plugin (zsviczian). Two valid file types:

- `<name>.excalidraw.md` — markdown wrapper with the scene embedded. **This is the file of record.**
- `<name>.excalidraw` — pure JSON. The plugin opens it in *compatibility mode* with reduced
  functionality, so keep it only as an auto-exported sibling, never as the source

Link them from architecture notes with `![[diagram-name]]` (Obsidian embed syntax).

## Who owns a diagram

Every diagram is owned by **a generator in `tools/`** or by **your hands** — never
both. A hand-tuned diagram that somebody then regenerates loses the tuning silently:
no conflict, no diff, nothing to notice.

**Generate** when the diagram restates data the repo already holds (transcription
drifts), when it is too large for a reviewer to check by eye, or when it must not
regress — a generator can assert no arrow crosses a box and no label overflows its
container. Derive ids and seeds from stable keys (`sha256("id:" + key)` truncated)
with a fixed `updated` stamp, so re-running produces a **byte-identical file**.

**Draw by hand** when the diagram is one-off or explanatory, when the shape *is* the
thinking, or when it has fewer than a dozen elements. Hand-editing in Obsidian is
safe: moving a box fires the plugin's re-routing, so bound arrows snap to their edges
correctly. This is the mode Excalidraw exists for.

⚠️ **Not with the `excalidraw` MCP.** It draws on hosted excalidraw.com — a diagram
in the cloud, not a file this vault can render. Local plugin, local file, no MCP.

Full house style, including the Excalidraw binding trap that costs the most and the
C4 rules every element must carry: the `diagrams` skill.
