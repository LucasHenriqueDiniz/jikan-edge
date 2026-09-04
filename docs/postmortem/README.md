# Postmortems

**Everything already in the past that is worth a record** — not only outages.

| kind | tag |
|---|---|
| a plan or slice finished | `kind/plan` |
| a bug fixed | `kind/bugfix` |
| an incident | `kind/incident` |
| a migration or a rename | `kind/migration` |
| a claim that turned out wrong | `kind/wrong-claim` |

The last one is the one people skip and it is worth the most: shipped code explains itself, a wrong
measurement leaves nothing behind unless you write it down.

**Tag the failure mode, not just the component.** `area/infra` finds it while you work on infra;
`dns` finds it when the next thing is a DNS problem, which is when you actually need it.

The section that earns the document is **"what changed so it cannot recur"**, written as a table of
`was → is now`. If that table is empty the postmortem is not finished.

See the `postmortem` skill.
