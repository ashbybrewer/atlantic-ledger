# The Atlantic Ledger

An evidence-aware, scroll-driven visualization of the trans-Atlantic slave
trade. The project is built as a portfolio piece about movement at scale,
source provenance, and the limits of historical reconstruction.

## Run

```bash
python3 server.py
```

Open [http://127.0.0.1:8091](http://127.0.0.1:8091), or double-click
`Start Atlantic Ledger.command` on macOS.

## What the first release proves

- Loads 36,000+ official compact voyage records and animates the 30,000+
  records with usable years plus source and destination coordinates on Canvas.
- Moves from guided scrollytelling into a free-explore timeline.
- Renders one dot per person for a selected ship.
- Opens exact, source-linked dossiers for the Clotilda and the Zong.
- Shows a named-person evidence chain for Bora without inventing missing facts.
- Adds person-specific and regional probability journey models beyond the ship.
- Makes major embarkation and landing hubs hoverable with data-derived profiles.
- Color-codes routes and particles by recorded carrier nationality.
- Makes documented, inferred, and unknown claims visually distinct.

## The central data rule

The interface never converts a regional estimate into an exact individual
journey. It uses three evidence levels:

1. **Documented**: directly stated by a surviving source.
2. **Inferred**: bounded reconstruction or imputation by a cited project.
3. **Unknown**: not supported by the currently joined archive.

This matters especially for ancestral homes, ethnic identity, causes of
enslavement, auctions, plantation assignments, and post-landing lives.

## Sources

- [SlaveVoyages](https://www.slavevoyages.org/): ships, routes, counts,
  participants, named captives, and source citations.
- [Enslaved.org](https://enslaved.org/): linked people, events, places, and
  source records.
- [Slave Societies Digital Archive](https://slavesocieties.org/): millions of
  digitized church and secular records from slave societies.
- [Enslaved.org Recommended Practices](https://docs.enslaved.org/recommendedPractices/):
  responsible historical slavery data modeling.

The committed `data/ledger.json` is a compact snapshot. Rebuild it with a
SlaveVoyages API token:

```bash
SLAVEVOYAGES_TOKEN=... python3 scripts/build_snapshot.py
```

No token is committed.

See [RESEARCH_PLAN.md](RESEARCH_PLAN.md) for the evidence graph, archive joins,
population lenses, plantation-condition rules, and genetics/bioarchaeology
policy that guide the larger build.

## Next research joins

The next release should add post-landing event chains from Enslaved.org and
the Slave Societies Digital Archive, then carefully sourced population and
labor-condition lenses. Bioarchaeology and genetics should appear only as
study-specific corroboration with clear ethical provenance, never as a machine
for assigning every person a modern ethnic label.
