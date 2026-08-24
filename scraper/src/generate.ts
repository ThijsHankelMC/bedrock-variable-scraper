import type { GenerateOptions, GenerateResult, VersionsIndex, Snapshot, VersionEntry } from "./types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSnapshot } from "./snapshot_builder";
import { scrape } from "./scrape";

// TODO: Move to helpers?
export function readJson<T>(path: string): T | undefined {
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

// TODO: Move to helpers?
export function writeJson(path: string, value: unknown): void {
    writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

// TODO: Move to helpers?
export function compareVersions(a: string, b: string): number {
    const pa = a
        .replace(/^v/i, "")
        .split(/[.\-+]/)
        .map((n) => parseInt(n, 10) || 0);
    const pb = b
        .replace(/^v/i, "")
        .split(/[.\-+]/)
        .map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

// TODO: Add comments
export function generate(options: GenerateOptions): GenerateResult {
    const ref = options.ref ?? options.version;
    const log = options.quiet ? () => {} : (msg: string) => console.log(msg);

    const versionsDir = join(options.out, "versions");
    mkdirSync(versionsDir, { recursive: true });

    const indexPath = join(options.out, "versions.json");
    const index = readJson<VersionsIndex>(indexPath) ?? { updatedAt: "", latest: "", versions: [] };

    const alreadyExists = index.versions.some((v) => v.version === options.version);
    if (alreadyExists && !options.force) {
        log(`Version ${options.version} already present. Use --force to regenerate. Skipping.`);
        return { built: false, version: options.version, added: [], removed: [], latest: index.latest };
    }

    const snapshot = buildSnapshot(scrape(options.source), options.version, ref);

    const others = index.versions.filter((v) => v.version !== options.version);
    const lower = others.filter((v) => compareVersions(v.version, options.version) < 0).sort((a, b) => compareVersions(b.version, a.version));
    const previous = lower[0];

    const currentNames = new Set(snapshot.identifiers.map((i) => i.name));
    let added: string[];
    let removed: string[];

    if (previous) {
        const prevSnap = readJson<Snapshot>(join(versionsDir, `${previous.version}.json`));
        const prevNames = new Set((prevSnap?.identifiers ?? []).map((i) => i.name));
        added = [...currentNames].filter((n) => !prevNames.has(n)).sort();
        removed = [...prevNames].filter((n) => !currentNames.has(n)).sort();
    } else {
        added = [...currentNames].sort();
        removed = [];
    }

    writeJson(join(versionsDir, `${options.version}.json`), snapshot);

    const entry: VersionEntry = {
        version: options.version,
        ref,
        generatedAt: snapshot.generatedAt,
        identifierCount: snapshot.identifierCount,
        totalOccurrences: snapshot.totalOccurrences,
        counts: snapshot.counts,
        added,
        removed,
    };

    const merged = [...others, entry].sort((a, b) => compareVersions(b.version, a.version));
    const latest = merged[0]!.version;

    const newIndex: VersionsIndex = {
        updatedAt: new Date().toISOString(),
        latest,
        versions: merged,
    };
    writeJson(indexPath, newIndex);

    const latestSnap = latest === options.version ? snapshot : readJson<Snapshot>(join(versionsDir, `${latest}.json`));
    if (latestSnap) writeJson(join(options.out, "latest.json"), latestSnap);

    return { built: true, version: options.version, added, removed, latest };
}
