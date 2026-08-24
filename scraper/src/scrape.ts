import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { Identifier, IdentifierKind } from "./types";

// TODO: This file could be cleaned up. Move constants to a separate file, and clean up the scrape function. It's a bit messy right now
const PACKS = ["behavior_pack", "resource_pack"];
const SKIP_DIRS = new Set([".git", "node_modules", ".github", "dist"]);
const INCLUDE_EXTENSIONS = new Set([".json", ".material", ".molang"]);
const IDENTIFIER_REGEX = /\b(variable|context|temp|v|c|t)\.([A-Za-z0-9_]+)/gi;
const SHORTHANDS = new Set(["v", "c", "t"]);
const KIND_MAP: Record<string, IdentifierKind> = {
    variable: "variable",
    v: "variable",
    context: "context",
    c: "context",
    temp: "temp",
    t: "temp",
};

// Basic walk function to recursively walk a directory and collect files with specific extensions, while skipping certain directories
function walk(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (!SKIP_DIRS.has(entry)) walk(full, out);
            continue;
        }
        const dot = entry.lastIndexOf(".");
        const ext = dot >= 0 ? entry.slice(dot).toLowerCase() : "";
        if (INCLUDE_EXTENSIONS.has(ext)) out.push(full);
    }
}

// Grabs an entity name and strips it. e.g. "warden.animation.json" becomes "warden"
function grabEntityName(relativePath: string): string {
    const base = basename(relativePath);
    const dot = base.indexOf(".");
    return dot > 0 ? base.slice(0, dot) : base;
}

export function scrape(sourceDir: string): Map<string, Identifier> {
    const files: string[] = [];
    // Walk through the packs and collect files
    for (const root of PACKS) {
        const dir = join(sourceDir, root);
        if (existsSync(dir)) walk(dir, files);
    }

    // Setup return map
    const map = new Map<string, Identifier>();

    // Read every file
    for (const file of files) {
        let content: string;
        content = readFileSync(file, "utf8");
        const relativePath = relative(sourceDir, file).split(sep).join("/");
        const entity = grabEntityName(relativePath);
        const lines = content.split(/\r?\n/);
        // Aggregate counts per file
        // TODO: This can be cleaner for sure but I don't want to spend too much time on it right now
        const perFile = new Map<string, { count: number; shorthand: number; lines: number[] }>();
        // Iterate over all the lines
        // TODO: This code is ugly af, needs cleaning up
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            IDENTIFIER_REGEX.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = IDENTIFIER_REGEX.exec(line)) !== null) {
                const keyword = m[1]!.toLowerCase();
                const kind = KIND_MAP[keyword]!;
                const member = m[2]!;
                const name = `${kind}.${member}`;
                let pf = perFile.get(name);
                if (!pf) {
                    pf = { count: 0, shorthand: 0, lines: [] };
                    perFile.set(name, pf);
                }
                pf.count++;
                if (SHORTHANDS.has(keyword)) pf.shorthand++;
                if (pf.lines[pf.lines.length - 1] !== i + 1) pf.lines.push(i + 1);
            }
        }

        // TODO: This code is ugly af, needs cleaning up
        for (const [name, pf] of perFile) {
            const dot = name.indexOf(".");
            const kind = name.slice(0, dot) as IdentifierKind;
            const member = name.slice(dot + 1);
            let id = map.get(name);
            if (!id) {
                id = {
                    name,
                    kind,
                    member,
                    totalCount: 0,
                    shorthandCount: 0,
                    fileCount: 0,
                    entities: [],
                    files: [],
                };
                map.set(name, id);
            }
            id.totalCount += pf.count;
            id.shorthandCount += pf.shorthand;
            id.fileCount += 1;
            id.files.push({ path: relativePath, entity, count: pf.count, lines: pf.lines });
        }
    }

    return map;
}
