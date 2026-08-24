import { Identifier, KindCounts, Snapshot } from "./types";

export function buildSnapshot(map: Map<string, Identifier>, version: string, ref: string): Snapshot {
    // Sort identifiers by name
    const identifiers = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    // Iterate over identifiers and sort files and entities
    for (const id of identifiers) {
        id.files.sort((a, b) => a.path.localeCompare(b.path));
        id.entities = [...new Set(id.files.map((f) => f.entity))].sort((a, b) => a.localeCompare(b));
    }

    const counts: KindCounts = { variable: 0, context: 0, temp: 0 };
    let totalOccurrences = 0;
    for (const id of identifiers) {
        counts[id.kind]++;
        totalOccurrences += id.totalCount;
    }

    return {
        version,
        ref,
        generatedAt: new Date().toISOString(),
        identifierCount: identifiers.length,
        totalOccurrences,
        counts,
        identifiers,
    };
}
