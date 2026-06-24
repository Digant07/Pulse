import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";

const codeBuildClient = new CodeBuildClient({ region: "ap-south-1" });
const MASTER_BUCKET_NAME = "depolyments-bucket";

// ─── Framework Presets ────────────────────────────────────────────────────────
// Keys cover BOTH the Lambda's own naming AND the Render backend's naming,
// so a mismatch can never crash the function.
const FRAMEWORK_PRESETS = {
  // Next.js
  nextjs:     { installCmd: "npm install", buildCmd: "next build",      outputDir: "out"            },
  next:       { installCmd: "npm install", buildCmd: "npm run build",   outputDir: ".next"          },

  // React (Vite or CRA)
  react:      { installCmd: "npm install", buildCmd: "npm run build",   outputDir: "dist"           },
  "react-cra":{ installCmd: "npm install", buildCmd: "npm run build",   outputDir: "build"          },
  vite:       { installCmd: "npm install", buildCmd: "npm run build",   outputDir: "dist"           },

  // Vue
  vue:        { installCmd: "npm install", buildCmd: "npm run build",   outputDir: "dist"           },

  // Svelte / SvelteKit
  svelte:     { installCmd: "npm install", buildCmd: "npm run build",   outputDir: "build"          },

  // Astro
  astro:      { installCmd: "npm install", buildCmd: "astro build",     outputDir: "dist"           },

  // Nuxt
  nuxt:       { installCmd: "npm install", buildCmd: "nuxt generate",   outputDir: "dist"           },

  // Gatsby
  gatsby:     { installCmd: "npm install", buildCmd: "gatsby build",    outputDir: "public"         },

  // Angular
  angular:    { installCmd: "npm install", buildCmd: "npm run build",   outputDir: "dist"           },

  // Remix
  remix:      { installCmd: "npm install", buildCmd: "npm run build",   outputDir: "public"         },

  // Static / Vanilla (no build step)
  vanilla:    { installCmd: 'echo "Skipping install - static files"', buildCmd: 'echo "Skipping build - static files"', outputDir: "." },
  static:     { installCmd: 'echo "Skipping install - static files"', buildCmd: 'echo "Skipping build - static files"', outputDir: "." },
};

// Sensible fallback so unknown frameworks never crash
const DEFAULT_PRESET = { installCmd: "npm install", buildCmd: "npm run build", outputDir: "dist" };

export const handler = async (event) => {
  console.log("Raw incoming event:", JSON.stringify(event));

  try {
    let requestBody = event.body;
    if (typeof event.body === "string") {
      requestBody = JSON.parse(event.body);
    }

    const {
      repository,
      framework: rawFramework,
      deploymentId,
      projectId,
      url,
      callbackUrl,
      // Accept optional overrides from the Render backend payload
      installCmd: payloadInstallCmd,
      buildCommand: payloadBuildCmd,
      outputDirectory: payloadOutputDir,
    } = requestBody;

    if (!repository) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing repository string from Render." }),
      };
    }

    // Normalize framework key
    let framework = rawFramework || "vanilla";
    if (framework === "static" || !framework) {
      framework = "vanilla";
    }

    const subdomain = url.replace("https://", "").split(".")[0];
    const repoUrl = repository.includes("https://")
      ? repository
      : `https://github.com/${repository}.git`;
    const finalDeploymentId =
      deploymentId || `deploy-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Look up preset, fall back to DEFAULT_PRESET for unknown frameworks
    const preset = FRAMEWORK_PRESETS[framework] || DEFAULT_PRESET;

    // Prefer explicit values from the Render payload, then fall back to preset
    const installCmd = payloadInstallCmd || preset.installCmd;
    const buildCmd   = payloadBuildCmd   || preset.buildCmd;
    const outputDir  = payloadOutputDir  || preset.outputDir;

    const environmentVariablesOverride = [
      { name: "DEPLOYMENT_ID", value: finalDeploymentId },
      { name: "PROJECT_ID",    value: projectId || "" },
      { name: "URL",           value: url || "" },
      { name: "CALLBACK_URL",  value: callbackUrl || "" },
      { name: "BUCKET_NAME",   value: MASTER_BUCKET_NAME },
      { name: "INSTALL_CMD",   value: installCmd },
      { name: "BUILD_CMD",     value: buildCmd },
      { name: "SUBDOMAIN",     value: subdomain },
      { name: "OUTPUT_DIR",    value: outputDir },
      { name: "FRAMEWORK",     value: framework },
    ];

    const command = new StartBuildCommand({
      projectName: "VercelCloneBuildEngine",
      sourceLocationOverride: repoUrl,
      environmentVariablesOverride,
    });

    console.log(`Starting build for ${repoUrl} (${framework}) with ID ${finalDeploymentId}`);
    console.log(`  installCmd: ${installCmd}`);
    console.log(`  buildCmd:   ${buildCmd}`);
    console.log(`  outputDir:  ${outputDir}`);

    await codeBuildClient.send(command);

    return {
      statusCode: 202,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Build initiated successfully",
        deploymentId: finalDeploymentId,
        status: "QUEUED",
      }),
    };
  } catch (error) {
    console.error("Orchestrator Lambda Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to start build pipeline",
        details: error.message,
      }),
    };
  }
};
