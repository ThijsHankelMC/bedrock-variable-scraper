import { scrape } from "./scrape";

const sourceDir = process.argv[2];
if (!sourceDir) {
    process.exit(1);
}

const map = scrape(sourceDir);
for (const id of [...map.values()].sort((a, b) => b.totalCount - a.totalCount).slice(0, 20)) {
    console.log(`${id.name}: ${id.totalCount} uses in ${id.fileCount} files`);
}
