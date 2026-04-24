#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "public", "packages");
const JS_SDK_DIR = path.join(REPO_ROOT, "sdks", "javascript", "trace-log-sdk");
const PYTHON_SDK_DIR = path.join(REPO_ROOT, "sdks", "python");
const JAVA_MODULES = [
  {
    key: "java-core",
    coordinate: "com.traceai:trace-log-sdk",
    moduleDir: path.join(REPO_ROOT, "sdks", "java", "trace-log-sdk"),
    artifactHint: "trace-log-sdk",
  },
  {
    key: "java-spring-starter",
    coordinate: "com.traceai:trace-log-spring-boot-starter",
    moduleDir: path.join(REPO_ROOT, "sdks", "java", "trace-log-spring-boot-starter"),
    artifactHint: "trace-log-spring-boot-starter",
  },
];

const CONTENT_TYPE_BY_EXT = {
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jar": "application/java-archive",
  ".whl": "application/zip",
  ".tgz": "application/gzip",
  ".gz": "application/gzip",
  ".zip": "application/zip",
};

function runCommand(command, args, { cwd, env = {} }) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} exited with status ${result.status}`,
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout.trim();
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

async function sha256OfFile(filePath) {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function contentTypeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] || "application/octet-stream";
}

async function describeArtifact(absPath) {
  const stat = await fs.stat(absPath);
  const relative = toPosix(path.relative(OUTPUT_DIR, absPath));
  return {
    fileName: path.basename(absPath),
    relativePath: `packages/${relative}`,
    downloadPath: `/packages/${relative}`,
    sizeBytes: stat.size,
    sha256: await sha256OfFile(absPath),
    contentType: contentTypeOf(absPath),
  };
}

function parsePyProjectVersion(text) {
  const match = text.match(/^\s*version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : "1.0.0";
}

function parsePackageJsonVersion(text) {
  try {
    const parsed = JSON.parse(text);
    return {
      name: parsed.name || "@traceai/trace-log-sdk",
      version: parsed.version || "1.0.0",
    };
  } catch {
    return {
      name: "@traceai/trace-log-sdk",
      version: "1.0.0",
    };
  }
}

async function resolveLatestJar(moduleDir, artifactHint) {
  const targetDir = path.join(moduleDir, "target");
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jar"))
    .map((entry) => entry.name)
    .filter((name) => !name.includes("-sources") && !name.includes("-javadoc") && !name.startsWith("original-"))
    .sort((a, b) => {
      const aScore = a.includes(artifactHint) ? 1 : 0;
      const bScore = b.includes(artifactHint) ? 1 : 0;
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      return a.localeCompare(b);
    });
  if (candidates.length === 0) {
    throw new Error(`No jar artifact found in ${targetDir}`);
  }
  return path.join(targetDir, candidates[0]);
}

async function copyFileToDir(srcFile, dstDir, dstFileName = null) {
  await ensureDir(dstDir);
  const target = path.join(dstDir, dstFileName || path.basename(srcFile));
  await fs.copyFile(srcFile, target);
  return target;
}

async function buildJavascriptPackages(registry) {
  const outputDir = path.join(OUTPUT_DIR, "javascript");
  await ensureDir(outputDir);

  const { name, version } = parsePackageJsonVersion(
    await fs.readFile(path.join(JS_SDK_DIR, "package.json"), "utf8"),
  );
  const npmCacheDir = path.join(os.tmpdir(), "trace-log-platform-npm-cache");
  await ensureDir(npmCacheDir);
  const packOutput = runCommand("npm", ["pack", "--pack-destination", outputDir], {
    cwd: JS_SDK_DIR,
    env: {
      npm_config_cache: npmCacheDir,
      NPM_CONFIG_CACHE: npmCacheDir,
    },
  });
  const tarballName = packOutput.split(/\r?\n/).filter(Boolean).pop();
  if (!tarballName) {
    throw new Error("npm pack did not output a tarball name");
  }
  const tarballPath = path.join(outputDir, tarballName);
  const browserRuntimePath = await copyFileToDir(
    path.join(REPO_ROOT, "src", "sdk", "frontend-sdk.js"),
    outputDir,
    `trace-log-frontend-sdk-${version}.js`,
  );

  registry.packages.push({
    key: "javascript-npm",
    language: "javascript",
    ecosystem: "npm",
    packageName: name,
    version,
    summary: "Node.js SDK package for backend service tracing and log reporting.",
    installCommands: ["npm install <TRACE_PLATFORM_URL>/packages/javascript/" + path.basename(tarballPath)],
    files: [await describeArtifact(tarballPath)],
  });

  registry.packages.push({
    key: "javascript-browser-runtime",
    language: "javascript",
    ecosystem: "browser-script",
    packageName: "TraceLogSDK browser runtime",
    version,
    summary: "Browser script SDK runtime for non-npm web integration.",
    installCommands: ['<script src="<TRACE_PLATFORM_URL>/packages/javascript/' + path.basename(browserRuntimePath) + '"></script>'],
    files: [await describeArtifact(browserRuntimePath)],
  });
}

async function buildPythonPackages(registry) {
  const outputDir = path.join(OUTPUT_DIR, "python");
  await ensureDir(outputDir);

  const pyprojectText = await fs.readFile(path.join(PYTHON_SDK_DIR, "pyproject.toml"), "utf8");
  const version = parsePyProjectVersion(pyprojectText);

  runCommand("python3", ["-m", "pip", "wheel", "--no-build-isolation", "--no-deps", ".", "-w", outputDir], {
    cwd: PYTHON_SDK_DIR,
  });

  const wheels = (await fs.readdir(outputDir))
    .filter((name) => name.endsWith(".whl"))
    .sort((a, b) => a.localeCompare(b));
  if (wheels.length === 0) {
    throw new Error("No wheel artifact generated for Python SDK");
  }

  const wheelPath = path.join(outputDir, wheels[wheels.length - 1]);
  registry.packages.push({
    key: "python-wheel",
    language: "python",
    ecosystem: "pip",
    packageName: "trace-log-sdk",
    version,
    summary: "Python SDK wheel package for Flask/FastAPI and generic backend services.",
    installCommands: ["pip install <TRACE_PLATFORM_URL>/packages/python/" + path.basename(wheelPath)],
    files: [await describeArtifact(wheelPath)],
  });
}

async function buildJavaPackages(registry) {
  const outputDir = path.join(OUTPUT_DIR, "java");
  await ensureDir(outputDir);

  for (const module of JAVA_MODULES) {
    try {
      runCommand("mvn", ["-q", "-DskipTests", "package"], { cwd: module.moduleDir });
    } catch (error) {
      registry.warnings.push(`maven package failed for ${module.coordinate}: ${error.message}`);
    }

    const latestJar = await resolveLatestJar(module.moduleDir, module.artifactHint);
    const copiedJar = await copyFileToDir(latestJar, outputDir);
    const fileName = path.basename(copiedJar);
    const versionMatch = fileName.match(/-(\d+\.\d+\.\d+(?:[-.A-Za-z0-9]*)?)\.jar$/);
    const version = versionMatch ? versionMatch[1] : "1.0.0";

    registry.packages.push({
      key: module.key,
      language: "java",
      ecosystem: "maven",
      packageName: module.coordinate,
      version,
      summary: "Java artifact for Trace Log integration.",
      installCommands: [
        `<dependency><groupId>${module.coordinate.split(":")[0]}</groupId><artifactId>${module.coordinate.split(":")[1]}</artifactId><version>${version}</version></dependency>`,
      ],
      files: [await describeArtifact(copiedJar)],
    });
  }
}

async function writeCatalog(registry) {
  const filePath = path.join(OUTPUT_DIR, "index.json");
  await fs.writeFile(filePath, JSON.stringify(registry, null, 2), "utf8");
}

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await ensureDir(OUTPUT_DIR);

  const registry = {
    schemaVersion: "v1",
    generatedAt: new Date().toISOString(),
    buildCommand: "npm run sdk:package",
    packages: [],
    warnings: [],
  };

  await buildJavascriptPackages(registry);
  await buildPythonPackages(registry);
  await buildJavaPackages(registry);
  await writeCatalog(registry);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir: OUTPUT_DIR,
        packageCount: registry.packages.length,
        warnings: registry.warnings,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
