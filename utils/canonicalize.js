const fs = require("fs");
const path = process.argv[2];

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeys(item));
  }

  const sorted = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }

  return sorted;
}

try {
  const content = fs.readFileSync(path, "utf-8");
  const pkgJson = JSON.parse(content);

  // Skip private packages - they won't be published/attested
  if (pkgJson.private === true) {
    console.log(`⏭️  Skipped (private): ${path}`);
    return;
  }

  const sorted = sortObjectKeys(pkgJson);
  const canonicalized = JSON.stringify(sorted, null, 2) + "\n";
  fs.writeFileSync(path, canonicalized, "utf-8");
  console.log(`✅ Canonicalized: ${path}`);
} catch (error) {
  console.error(`❌ Error processing ${path}:`, error.message);
  process.exit(1);
}
