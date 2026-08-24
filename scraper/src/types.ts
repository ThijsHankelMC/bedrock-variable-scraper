export type IdentifierKind = "variable" | "context" | "temp";
export type KindCounts = Record<IdentifierKind, number>;

// TODO: Add comments
export interface FileUsage {
    path: string;
    entity: string;
    count: number;
    lines: number[];
}

// TODO: Add comments
export interface Identifier {
    name: string;
    kind: IdentifierKind;
    member: string;
    totalCount: number;
    shorthandCount: number;
    fileCount: number;
    entities: string[];
    files: FileUsage[];
}

// TODO: Add comments
export interface Args {
    source: string;
    version: string;
    out: string;
    ref?: string;
    force: boolean;
}

// TODO: Add comments
export interface GenerateOptions {
    source: string;
    version: string;
    out: string;
    ref?: string;
    force?: boolean;
    quiet?: boolean;
}

// TODO: Add comments
export interface GenerateResult {
    built: boolean;
    version: string;
    added: string[];
    removed: string[];
    latest: string;
}

// TODO: Add comments
export interface Snapshot {
    version: string;
    ref: string;
    generatedAt: string;
    identifierCount: number;
    totalOccurrences: number;
    counts: KindCounts;
    identifiers: Identifier[];
}

// TODO: Add comments
export interface VersionEntry {
    version: string;
    ref: string;
    generatedAt: string;
    identifierCount: number;
    totalOccurrences: number;
    counts: KindCounts;
    added: string[];
    removed: string[];
}

// TODO: Add comments
export interface VersionsIndex {
    updatedAt: string;
    latest: string;
    versions: VersionEntry[];
}

// TODO: Add comments
export interface BackfillArgs {
    repo: string;
    out: string;
    tags?: string[];
    limit?: number;
    force: boolean;
}
