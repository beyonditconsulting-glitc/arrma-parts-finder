/** Run only on a trusted backend/dev machine. Never bundle or invoke from Expo. */
import { createEbayClient, readEbayConfig } from "../src/integrations/ebay.mjs";

try {
  const config = readEbayConfig();
  if (process.argv.includes("--check-config")) {
    console.log(
      JSON.stringify({
        configured: true,
        environment: config.environment,
        marketplaceId: config.marketplaceId,
        accessVerified: false,
      }),
    );
  } else {
    const partNumber = process.argv[2];
    const brand = process.argv[3] || "ARRMA";
    if (!partNumber)
      throw new Error(
        "Usage: node --use-env-proxy scripts/ebay-check.mjs PART_NUMBER [BRAND], or --check-config",
      );
    const result = await createEbayClient(config).searchPart(
      { brand, partNumber },
      { limit: 5 },
    );
    // Only normalized public listing observations are printed; auth/config is never serialized.
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
