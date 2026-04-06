import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

function generateHash(str: string): string {
  let h1 = 0x01234567 ^ 0x811c9dc5;
  let h2 = 0x89abcdef ^ 0x811c9dc5;

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x1000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x1000193);
  }

  return (
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0")
  );
}

const PLURAL_SEPARATOR = "||||";

interface IntlEntry {
  text: string;
  pluralOne?: string;
  pluralOther?: string;
}

function extractIntlStrings(code: string): Map<string, IntlEntry> {
  const strings = new Map<string, IntlEntry>();
  const regex =
    /\bintl\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*(?:,[^)]*)?\)/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const text = match[1] ?? match[2];
    if (text) {
      const id = generateHash(text);

      if (text.includes(PLURAL_SEPARATOR)) {
        const [one, other] = text.split(PLURAL_SEPARATOR).map((s) => s.trim());
        strings.set(id, { text, pluralOne: one, pluralOther: other });
      } else {
        strings.set(id, { text });
      }
    }
  }

  return strings;
}

function scanDir(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...scanDir(fullPath, extensions));
    } else if (
      entry.isFile() &&
      extensions.some((ext) => entry.name.endsWith(ext))
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function readJsonSafe(filePath: string): Record<string, string> {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.trim()) return JSON.parse(content);
  } catch {
    // Should be a valid json
  }
  return {};
}

function setSorted(target: Record<string, string>, key: string, value: string) {
  target[key] = value;
}

export function intlExtractPlugin(): Plugin {
  let srcDir: string;
  let localesDir: string;

  function getLocalePaths(): Map<string, string> {
    const locales = new Map<string, string>();
    if (!fs.existsSync(localesDir)) return locales;

    for (const entry of fs.readdirSync(localesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "migrations") continue;
      const jsonPath = path.join(localesDir, entry.name, `${entry.name}.json`);
      locales.set(entry.name, jsonPath);
    }
    return locales;
  }

  function scanAllFiles(): Map<string, IntlEntry> {
    const allStrings = new Map<string, IntlEntry>();
    const files = scanDir(srcDir, [".ts", ".tsx"]);

    for (const file of files) {
      if (file.endsWith(path.join("utils", "intl.ts"))) continue;

      const code = fs.readFileSync(file, "utf-8");
      const strings = extractIntlStrings(code);

      for (const [id, entry] of strings) {
        allStrings.set(id, entry);
      }
    }

    return allStrings;
  }

  function updateLocaleFiles(allStrings: Map<string, IntlEntry>) {
    const sortedEntries = [...allStrings.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    for (const [, localePath] of getLocalePaths()) {
      const existing = readJsonSafe(localePath);
      const localeJson: Record<string, string> = {};

      for (const [id, entry] of sortedEntries) {
        if (entry.pluralOne != null && entry.pluralOther != null) {
          setSorted(
            localeJson,
            `${id}_one`,
            existing[`${id}_one`] ?? entry.pluralOne,
          );
          setSorted(
            localeJson,
            `${id}_other`,
            existing[`${id}_other`] ?? entry.pluralOther,
          );
        } else {
          setSorted(localeJson, id, existing[id] ?? entry.text);
        }
      }

      const newContent = JSON.stringify(localeJson, null, 2) + "\n";
      const currentContent = fs.existsSync(localePath)
        ? fs.readFileSync(localePath, "utf-8")
        : "";

      if (currentContent !== newContent) {
        fs.writeFileSync(localePath, newContent);
      }
    }
  }

  return {
    name: "vite-plugin-intl-extract",

    configResolved(config) {
      srcDir = path.resolve(config.root, "src");
      localesDir = path.resolve(srcDir, "intl/locales");
    },

    buildStart() {
      const allStrings = scanAllFiles();
      updateLocaleFiles(allStrings);
    },

    transform(code, id) {
      if (!id.startsWith(srcDir)) return;
      if (id.includes(path.join("utils", "intl.ts"))) return;
      if (!(id.endsWith(".ts") || id.endsWith(".tsx"))) return;
      if (!code.includes("intl(")) return;

      const regex = /\bintl\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
      let result = code;
      let offset = 0;
      let changed = false;
      let match;

      while ((match = regex.exec(code)) !== null) {
        const stringLiteral = match[1];
        const quote = stringLiteral[0];
        const text = stringLiteral.slice(1, -1);
        const hash = generateHash(text);

        const replacement = `intl(${quote}${hash}${quote}`;
        const start = match.index + offset;
        const end = start + match[0].length;
        result = result.slice(0, start) + replacement + result.slice(end);
        offset += replacement.length - match[0].length;
        changed = true;
      }

      if (!changed) return;
      return { code: result, map: null };
    },

    handleHotUpdate({ file }) {
      if (file.endsWith(".json")) return;
      if (!file.startsWith(srcDir)) return;
      if (!(file.endsWith(".ts") || file.endsWith(".tsx"))) return;

      const allStrings = scanAllFiles();
      updateLocaleFiles(allStrings);
    },
  };
}
