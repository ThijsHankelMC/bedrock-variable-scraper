import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runBackfill } from "./backfill";
import { InitArgs } from "./types";

// TODO: Add comments and clean up
function parseArgs(argv: string[]): InitArgs {
    const args: Partial<InitArgs> = { force: false, previews: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case "--repo":
                args.repo = argv[++i];
                break;
            case "--out":
                args.out = argv[++i];
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
        throw new Error("Usage: init --repo <git clone path> --out <dir> [--previews] [--force]");
    }
    return args as InitArgs;
}

// Wipes any existing data and rebuilds every version from the very first release
async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    const indexPath = join(args.out, "versions.json");
    if (existsSync(indexPath) && !args.force) {
        throw new Error(`Existing data found in ${args.out}. Use --force to wipe and rebuild from scratch.`);
    }

    for (const target of ["versions", "versions.json", "latest.json"]) {
        const path = join(args.out, target);
        if (existsSync(path)) {
            console.log(`Removing ${path}`);
            rmSync(path, { recursive: true });
        }
    }

    await runBackfill({ repo: args.repo, out: args.out, previews: args.previews, force: false });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
