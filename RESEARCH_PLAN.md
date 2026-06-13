# Research architecture

Atlantic Ledger is designed as a graph of people, events, places, voyages, and
sources. The long-term goal is to reconstruct as much of a person's forced
journey as surviving evidence permits, without turning gaps into invented
precision.

## Claim levels

Every displayed claim must carry one of these statuses:

| Status | Meaning | Example |
| --- | --- | --- |
| `documented` | A cited source directly records the claim. | Bora was recorded aboard the *NS de Regla*. |
| `linked` | Two or more records are joined by a documented scholarly linkage. | A voyage arrival linked to a later sale event. |
| `inferred` | A bounded scholarly reconstruction or source-database imputation. | Likely language group inferred from a recorded name. |
| `estimated` | A statistical population estimate, never an individual claim. | Estimated total embarkations in a region and decade. |
| `unknown` | The current evidence does not permit the claim. | A person's ancestral village or cause of capture. |

## Journey graph

```text
ancestral home?
  -> capture or enslavement event?
  -> overland or coastal movement?
  -> sale / transfer?
  -> embarkation port
  -> named ship and Middle Passage
  -> disembarkation port
  -> auction / sale / transfer?
  -> residence / plantation / household?
  -> later forced relocation?
  -> family, resistance, manumission, death?
```

Question marks are intentional. The interface should show the break in the
evidence chain rather than silently bridge it.

## Source joins

### Trans-Atlantic and intra-American movement

- [SlaveVoyages](https://www.slavevoyages.org/): ships, dates, routes, counts,
  voyage participants, named captives, resistance, and source citations.
- [Intra-American Slave Trade Database](https://www.slavevoyages.org/blog/the-intraamerican-slave-trade-database/169):
  subsequent maritime forced movements within the Americas.

### Named people, auctions, sales, and life events

- [Enslaved.org](https://enslaved.org/): person-event-place-source graph,
  including sale, transfer, residence, birth, death, and manumission events.
- [Louisiana Slave Database through Enslaved.org](https://enslaved.org/search/all?projects=Louisiana+Slave+Database):
  a major route into named sale and life-event records.
- [Slave Societies Digital Archive](https://slavesocieties.org/): digitized
  baptism, marriage, burial, sale, manumission, and other records across the
  Atlantic world.

### Population and location lenses

- [IPUMS full-count datasets of enslaved people and slaveholders](https://assets.ipums.org/_files/ipums/working_papers/ipums_wp_2024-01.pdf):
  1850 and 1860 U.S. slave schedules for population-level analysis.
- [National Archives 1860 Census records](https://www.archives.gov/research/census/1860):
  archival context and surviving slave schedules.

These schedules usually omit enslaved people's names. They may support a
population or location lens, but rarely an exact person linkage.

### Plantation conditions and life expectancy

There is no responsible universal "plantation conditions" or "life expectancy"
field. These must be constructed at a specific place and time from records such
as plantation journals, inventories, work logs, hospital logs, birth and burial
registers, census schedules, and peer-reviewed scholarship.

The interface should show:

- sample size and coverage years;
- which people are missing from the source;
- whether mortality is observed or estimated;
- whether a comparison is plantation-, colony-, crop-, or region-specific.

### Genetics, isotopes, and origins

Genetic and isotope evidence belongs in study-specific case studies, with
community and research ethics made visible. It may narrow possible regional
origins or identify biological relationships. It must not be used to assign
every enslaved person to a modern ethnic group.

Candidate evidence modules:

- [Catoctin Furnace genetic study](https://www.science.org/doi/10.1126/science.ade4995)
- [Sub-Saharan African strontium isoscape](https://www.nature.com/articles/s41467-024-55256-0)
- [African Origins methodology](https://legacy.slavevoyages.org/blog/methodology-african-origins)

## Core entity model

```text
Person
  id, recorded_names[], status, sex, age, relationships[]

Event
  id, type, date_range, place_id, participants[], source_ids[]

Voyage
  id, ship, dates, itinerary[], embarked, landed, outcome, source_ids[]

Place
  id, name, geometry, place_type, parent_id

Claim
  subject_id, predicate, object, certainty, source_ids[], note

Source
  id, title, archive, citation, image_or_manifest_url
```

The `Claim` entity is the load-bearing part of the model. It allows two facts
about the same person to carry different evidence quality and prevents a visual
join from becoming an unsupported historical claim.

## Portfolio bar

The finished project should demonstrate:

- scroll-driven narrative that transitions into free exploration;
- Canvas or WebGL rendering of large movement data;
- linked-data modeling across incompatible archives;
- visible provenance and uncertainty;
- responsible design judgment on a difficult subject;
- performance profiling, accessible interaction, and reproducible data builds.
