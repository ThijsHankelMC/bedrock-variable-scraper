# bedrock-variable-scraper

A registry of every `variable.*`, `context.*` and `temp.*` usage in the vanilla Minecraft Bedrock behavior & resource packs ([Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)).

## What it does

The scraper walks the `behavior_pack` and `resource_pack` folders of a `bedrock-samples` checkout, scans every `.json`, `.material` and `.molang` file, and records each identifier match (including the `v.`, `c.` and `t.` shorthands). For every identifier it tracks:

- Total occurrence count and shorthand usage count
- The files it appears in, with line numbers and per-file counts
- The entities it belongs to (derived from file names, e.g. `warden.animation.json` becomes `warden`)

## Usage

Requires Node.js and a local clone of [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples).

```powershell
cd scraper
npm install
```

> **Note (PowerShell):** quote the `--` separator (`"--"`) so PowerShell passes it through to npm instead of consuming it.

### `init` - rebuild everything from scratch

Wipes the output data and scrapes every release from the very first tag onward, oldest-first, so version diffs are computed correctly. Release tags are fetched from the GitHub API.

```powershell
npm run init "--" --repo C:\path\to\bedrock-samples --out ..\data --force
```

| Flag           | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `--repo <dir>` | Path to a local `bedrock-samples` git clone (required)       |
| `--out <dir>`  | Output directory (required)                                  |
| `--previews`   | Also include preview releases (excluded by default)          |
| `--force`      | Wipe existing data; refuses to run without it if data exists |

### `backfill` - scrape missing versions

Fetches all release tags and scrapes any versions not already present in the index. Existing versions are skipped unless `--force` is passed.

```powershell
npm run backfill "--" --repo C:\path\to\bedrock-samples --out ..\data
```

| Flag           | Description                                               |
| -------------- | --------------------------------------------------------- |
| `--repo <dir>` | Path to a local `bedrock-samples` git clone (required)    |
| `--out <dir>`  | Output directory (required)                               |
| `--tags v1,v2` | Only process these tags (always respected, even previews) |
| `--limit N`    | Only process the N newest tags                            |
| `--previews`   | Also include preview releases (excluded by default)       |
| `--force`      | Regenerate versions that already exist                    |

Both `init` and `backfill` check out each tag in the `--repo` clone while scraping, then restore the original ref. Set `GITHUB_TOKEN` (or `GH_TOKEN`) to avoid GitHub API rate limits.

### `scrape` - scrape a single version

Scrapes whatever is currently checked out in a source directory and adds it to the index.

```powershell
npm run scrape "--" --source C:\path\to\bedrock-samples --version 1.26.40.05 --out ..\data
```

| Flag              | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `--source <dir>`  | Directory containing `behavior_pack` / `resource_pack` (required)   |
| `--version <ver>` | Version label for the snapshot (required)                           |
| `--out <dir>`     | Output directory (required)                                         |
| `--ref <ref>`     | Reference string stored with the snapshot (defaults to the version) |
| `--force`         | Overwrite the version if it already exists                          |

## Snapshot format

Each snapshot in `data/versions/` looks like:

```jsonc
{
    "version": "1.26.40.05",
    "ref": "v1.26.40.05",
    "generatedAt": "2026-08-24T21:02:54.749Z",
    "identifierCount": 622,
    "totalOccurrences": 6205,
    "counts": { "variable": 599, "context": 5, "temp": 18 },
    "identifiers": [
        {
            "name": "variable.attack_time",
            "kind": "variable",
            "member": "attack_time",
            "totalCount": 42,
            "shorthandCount": 3,
            "fileCount": 12,
            "entities": ["warden", "zombie"],
            "files": [{ "path": "resource_pack/animations/warden.animation.json", "entity": "warden", "count": 4, "lines": [12, 87] }],
        },
    ],
}
```

## Development

```powershell
cd scraper
npm run typecheck
```

## License

See [LICENSE](LICENSE).
