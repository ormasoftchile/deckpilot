# Episode 01 — The way we build software is changing

<!-- id: intro -->

## How to deal with the changing way of work?

Things I see in day-to-day engineering work:

- Systems that are not well integrated
- The growing number of tools we are expected to keep up with

---

<!-- id: denser -->

## Software work became denser

And **faster**.

- More tools.
- More contexts.
- More coordination.
- More decisions per hour.

---

<!-- id: three-layers -->

## Existing operational problem before AI

Engineering work runs on three separate layers:

- Code, which is what actually executes.
- Documentation, which describes intent.
- Operational knowledge, which lives in people, tickets, and chat threads.

---

<!-- id: manual-integration -->

## These layers are not deeply integrated.

So engineers end up connecting everything manually.

They translate prose into actions.

They fill missing assumptions.

They recover context from memory.

They keep the system moving by patching gaps.

---

<!-- id: incident-response -->

## Incident response.

There is a runbook,
but it is mostly text.

So someone has to interpret it under pressure,
convert it into exact operations,
and deal with implicit critical details.

---

<!-- id: onboarding -->

## Or onboarding.

A new engineer gets documents, recordings, and tribal advice.

But what they need is executable knowledge:
something that can be run, verified, and replayed.

---

<!-- id: tool-growth -->

## Now add the second pressure: tool growth.

Every month brings new models,

new agent frameworks,

new orchestration layers,

new dev workflows,

new "must-know" patterns.

---

<!-- id: tool-cost -->

## Each new tool promises leverage.

But in aggregate, the cost is real:

- More surface area to understand.
- More context switching.
- More shallow knowledge across too many subjects.
- More pressure to keep up.

---

<!-- id: cognitive-overload -->

## This creates cognitive overload.

Engineers feel it:

- "Am I using the right stack?"
- "What changed this week?"
- "How do I stay current without burning cycles on constant rewrites?"

---

<!-- id: real-problem -->

## So the problem is more than "too many tools."

We are adding tool complexity on top of systems
that were already weakly integrated.

> That combination breaks flow.

---

<!-- id: ai-exposes-debt -->

## AI exposes integration debt

AI systems operate on representations.

So when workflows are implicit,
context is fragmented,
or operational knowledge only exists in people,
the gaps become visible immediately.

The issue is not just model quality.

The issue is that much of engineering work
still depends on humans reconstructing context manually.

---

<!-- id: new-framing -->

## This changes the framing I can make

- Not:
"How do I use every new tool?"

- But:
"How do I build systems that absorb tool change without overwhelming me?"

---

<!-- id: direction -->

## For me, the direction is practical.

- Make knowledge executable.
- Make context explicit.
- Make workflows reproducible.
- Make handoffs machine-readable.

> To reduce patching manually.

---

<!-- id: series-intent -->

This is what I am exploring in this series.

I am not trying to chase every trend.
I am trying to design workflows that are easier to run and easier to maintain.

---

<!-- id: next-episode -->

In the next episode,
I will start with one practical step:

turning documentation into executable artifacts.

Because when knowledge can run,
you spend less time translating,
and more time building.