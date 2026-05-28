const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = withRorkMetro(getDefaultConfig(__dirname));

// Hermes rejects dynamic import() in @supabase/supabase-js's ESM build (2.106.0+).
// Force the CJS entry, which uses require() for optional OpenTelemetry tracing.
const supabaseCjs = require.resolve("@supabase/supabase-js/dist/index.cjs");
const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === "@supabase/supabase-js") {
      return { filePath: supabaseCjs, type: "sourceFile" };
    }

    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }

    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
