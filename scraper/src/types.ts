export type IdentifierKind = "variable" | "context" | "temp";

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
