# Data contract

`ledger.json` is a compact, reproducible snapshot built from the official
SlaveVoyages API. It contains:

- documented trans-Atlantic voyage animation records;
- the source and destination port geometry needed to draw them;
- source-linked featured dossiers for the Clotilda, the Zong, and Bora.

The visualization distinguishes three evidence levels:

- **Documented**: directly present in a surviving record.
- **Inferred**: reconstructed or imputed by the source database.
- **Unknown**: not recoverable from the currently joined archive.

Rebuild with:

```bash
SLAVEVOYAGES_TOKEN=... python3 scripts/build_snapshot.py
```

The token is intentionally not committed.
