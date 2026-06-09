# Ledger — the fat, durable decision store

One `.bn` file per resolved decision. Burhan holds the *machine-interpretable* justification
(claims with confidence ceilings, `cite`-chains, `falsified_when` contestation conditions);
daftar holds the *narrative* receipt. The spine ([../STATE.md](../STATE.md)) only indexes this — it is loaded on demand.

## Conventions

- **Inherited prior** → `NNNN-<slug>-inherited.bn`: a high-ceiling `claim` adopting a SIG prior unchanged, with `assume` naming the source (e.g. an Accepted ADR).
- **Deviation** → `Cxxx-<slug>-deviation.bn`: a `lemma`/`theorem` proving the prior insufficient (`because illah = …` / `proves …`), a `claim` citing it at a *lowered* ceiling, and a `falsified_when` capturing what would overturn it. Pairs with a `Cxxx` ADR.
- **Open question (optional pre-resolution)** → a low/zero-confidence `claim` so `mizan_recommend_next_experiment` can rank it.

## Validate / interpret

```bash
cd ~/apps/adam/tools/burhan && PYTHONPATH=src python3 -m burhan.cli /home/mk/apps/sig-moonwalk/plan/facts/<file>.bn
PYTHONPATH=src python3 bin/burhan-converge   # cross-decision contradiction hunt
PYTHONPATH=src python3 bin/burhan-perturb     # prior-fix audit
```

## Narrative receipts (daftar)

```bash
bun ~/apps/adam/tools/daftar/bin/daftar add decision --title="<q>" --body="<resolution>" --project=/home/mk/apps/sig-moonwalk
bun ~/apps/adam/tools/daftar/bin/daftar query "<topic>" --project=/home/mk/apps/sig-moonwalk --budget-tokens=800
```
