import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { compareVersions, generate } from "./generate";
import { BackfillArgs } from "./types";

// TODO: Move to config
const UPSTREAM = "Mojang/bedrock-samples";

// TODO: Add comments and clean up
function parseArgs(argv: string[]): BackfillArgs {
    const args: Partial<BackfillArgs> = { force: false, previews: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case "--repo":
                args.repo = argv[++i];
                break;
            case "--out":
                args.out = argv[++i];
                break;
            case "--tags":
                args.tags = argv[++i]!.split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                break;
            case "--limit":
                args.limit = parseInt(argv[++i]!, 10);
                break;
            case "--previews":
                args.previews = true;
                break;
            case "--force":
                args.force = true;
                break;
            default:
                throw new Error(`Unknown argument: ${a}`);
        }
    }
    if (!args.repo || !args.out) {
        throw new Error("Usage: backfill --repo <git clone path> --out <dir> [--tags v1,v2] [--limit N] [--previews] [--force]");
    }
    return args as BackfillArgs;
}

function git(repo: string, ...cmd: string[]): string {
    return execFileSync("git", ["-C", repo, ...cmd], { encoding: "utf8" }).trim();
}

// TODO: Add comments and clean up
async function fetchReleaseTags(): Promise<string[]> {
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    const headers: Record<string, string> = {
        accept: "application/vnd.github+json",
        "user-agent": "bedrock-molang-registry",
    };
    if (token) headers.authorization = `Bearer ${token}`;

    const tags: string[] = [];
    for (let page = 1; page <= 5; page++) {
        const res = await fetch(`https://api.github.com/repos/${UPSTREAM}/releases?per_page=100&page=${page}`, { headers });
        if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
        const batch = (await res.json()) as Array<{ tag_name: string; draft: boolean }>;
        if (!batch.length) break;
        for (const r of batch) if (!r.draft) tags.push(r.tag_name);
        if (batch.length < 100) break;
    }
    return tags;
}

// TODO: Add comments and clean up
async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    await runBackfill(args);
}

export async function runBackfill(args: BackfillArgs): Promise<void> {
    let tags = args.tags ?? (await fetchReleaseTags()).filter((t) => args.previews || !/preview/i.test(t));
    tags = [...new Set(tags)].sort(compareVersions);
    if (args.limit && args.limit > 0) tags = tags.slice(-args.limit);

    if (!tags.length) {
        console.log("No tags to process.");
        return;
    }

    let originalRef: string;
    try {
        originalRef = git(args.repo, "symbolic-ref", "--quiet", "--short", "HEAD");
    } catch {
        originalRef = git(args.repo, "rev-parse", "HEAD");
    }

    console.log(`Backfilling ${tags.length} versions into ${args.out}:`);
    console.log(tags.join(", "));

    try {
        for (const tag of tags) {
            const version = tag.replace(/^v/i, "");
            console.log(`\n=== ${tag} (${version}) ===`);
            git(args.repo, "checkout", "--quiet", tag);
            generate({ source: args.repo, version, ref: tag, out: args.out, force: args.force });
        }
    } finally {
        try {
            git(args.repo, "checkout", "--quiet", originalRef);
            console.log(`\nRestored ${args.repo} to ${originalRef}.`);
        } catch (err) {
            console.warn(`Could not restore original ref (${originalRef}):`, err);
        }
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
