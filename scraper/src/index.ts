import { generate } from "./generate";
import { Args } from "./types";

// Parse command line arguments
function parseArgs(argv: string[]): Args {
    const args: Partial<Args> = { force: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        // Handle command line arguments
        switch (a) {
            // Source directory containing the source files
            case "--source":
                args.source = argv[++i];
                break;
            // Version of the source files to scrape
            case "--version":
                args.version = argv[++i];
                break;
            // Output directory for the generated files
            case "--out":
                args.out = argv[++i];
                break;
            // Optional reference string for the generated files
            case "--ref":
                args.ref = argv[++i];
                break;
            // Force overwrite of existing files
            case "--force":
                args.force = true;
                break;
            default:
                throw new Error(`Unknown argument: ${a}`);
        }
    }
    if (!args.source || !args.version || !args.out) {
        throw new Error("Usage: scrape --source <dir> --version <ver> --out <dir> [--ref <ref>] [--force]");
    }
    return args as Args;
}

const args = parseArgs(process.argv.slice(2));
generate({
    source: args.source,
    version: args.version,
    out: args.out,
    ref: args.ref,
    force: args.force,
});
