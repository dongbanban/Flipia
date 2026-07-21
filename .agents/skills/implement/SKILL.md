---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

## Ticket lifecycle

If implementing from a ticket file (under `.scratch/<feature>/issues/`):

1. **Start** — change `Status:` in the ticket file from `ready-for-agent` to `in-progress`. Read the ticket body and acceptance criteria before writing any code.
2. **Done** — mark every acceptance criterion checkbox as `- [x]`, change `Status:` to `done`, then append the commit SHA and a one-line summary under `## Comments`.

## Build

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.
