# Pitches

**One document per piece of work, written before the work is researched or built.** It is the cheapest
place to be wrong: arguing with a pitch costs a paragraph, arguing with a half-built feature costs the
build.

A pitch answers six things:

| | |
|---|---|
| problem | what is wrong today, and who it is wrong for |
| solution | what is proposed, and the shape of the architecture it implies |
| surface | the interfaces and APIs it touches |
| scope | both halves. What is in, and what is explicitly out |
| open questions | what has to be answered before this is buildable. These become the research notes |
| done | how it gets tested, and what success looks like |

**Scope is two lists or it is one wish.** The out-list is what stops the feature growing quietly
between the pitch and the plan.

A pitch is not a plan. It says what and why; `plans/` says in what order, one numbered vertical slice
at a time.

Client work branches the whole tree: `docs/clients/<client>/pitches/`, and the same for research,
plans and postmortems. House work stays here.

`/hexagram:pitch <feature>` writes one from this shape. See the `workflow` skill for where it sits in
the loop.
