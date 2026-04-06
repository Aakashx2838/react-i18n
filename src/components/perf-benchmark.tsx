import { useState, useCallback, createElement } from "react";
import i18next from "i18next";
import {
  I18nextProvider,
  useTranslation,
  initReactI18next,
} from "react-i18next";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useIntl } from "../utils/intl";

const ITERATIONS = 100_000;
const RENDER_COUNT = 2_000;

/**
 * Separate i18next instance configured the "default" way:
 * human-readable keys, namespace-based, standard useTranslation() usage.
 */
const defaultI18n = i18next.createInstance();
defaultI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        welcome: "Welcome to React",
        greeting: "Hello {{name}}",
        notifications_one: "{{name}} has {{count}} notification",
        notifications_other: "{{name}} has {{count}} notifications",
        items_one: "{{count}} item",
        items_other: "{{count}} items",
        location: "{{city}}, {{country}} — {{temperature}}°C",
        unread: "{{name}} has {{count}} unread messages",
      },
    },
  },
  lng: "en",
  interpolation: { escapeValue: false },
  pluralSeparator: "_",
});

/**
 * Our approach uses hash keys generated at build time.
 * i18next (the main instance) is already initialized in src/intl/i18n.ts
 * with hash-based keys like "71740c8c2e8fb474": "Welcome to React".
 * The intl() wrapper gets its string arg transformed to the hash at build time.
 */

interface BenchmarkResult {
  name: string;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
}

function runSuite(name: string, fn: () => void): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 1_000; i++) fn();

  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const totalMs = performance.now() - start;

  return {
    name,
    totalMs,
    avgMs: totalMs / ITERATIONS,
    opsPerSec: Math.round(ITERATIONS / (totalMs / 1000)),
  };
}

interface RenderBenchmarkResult {
  name: string;
  renderTimeMs: number;
  componentCount: number;
}

/**
 * A component that uses the default i18next t() with human-readable keys.
 * This is what a "normal" react-i18next setup looks like.
 */
function DefaultTranslatedItem({ count }: { count: number }) {
  const { t } = useTranslation(undefined, { i18n: defaultI18n });
  return createElement(
    "span",
    null,
    t("notifications", { name: "Aakash", count }),
  );
}

/**
 * A component that uses our intl() approach.
 * The string gets hash-transformed at build time by the Vite plugin.
 */
function IntlTranslatedItem({ count }: { count: number }) {
  const intl = useIntl();
  return createElement(
    "span",
    null,
    intl(
      "{{name}} has {{count}} notification |||| {{name}} has {{count}} notifications",
      { name: "Aakash", count },
    ),
  );
}

export function PerfBenchmark() {
  const intl = useIntl();
  const [funcResults, setFuncResults] = useState<BenchmarkResult[]>([]);
  const [renderResults, setRenderResults] = useState<RenderBenchmarkResult[]>(
    [],
  );
  const [running, setRunning] = useState(false);

  const runBenchmark = useCallback(() => {
    setRunning(true);

    requestAnimationFrame(() => {
      const results: BenchmarkResult[] = [];
      const defaultT = defaultI18n.t.bind(defaultI18n);

      // ─── Simple string (no interpolation) ───
      results.push(
        runSuite("default t(): simple string", () => {
          defaultT("welcome");
        }),
      );
      results.push(
        runSuite("intl(): simple string", () => {
          intl("Welcome to React");
        }),
      );

      // ─── String with interpolation ───
      results.push(
        runSuite("default t(): interpolation", () => {
          defaultT("greeting", { name: "Aakash" });
        }),
      );
      results.push(
        runSuite("intl(): interpolation", () => {
          intl("Hello {{name}}", { name: "Aakash" });
        }),
      );

      // ─── Pluralization ───
      results.push(
        runSuite("default t(): plural", () => {
          defaultT("notifications", { name: "Aakash", count: 99 });
        }),
      );
      results.push(
        runSuite("intl(): plural", () => {
          intl(
            "{{name}} has {{count}} notification |||| {{name}} has {{count}} notifications",
            { name: "Aakash", count: 99 },
          );
        }),
      );

      // ─── Multiple variables ───
      results.push(
        runSuite("default t(): multi-var", () => {
          defaultT("location", {
            city: "Kathmandu",
            country: "Nepal",
            temperature: 28,
          });
        }),
      );
      results.push(
        runSuite("intl(): multi-var", () => {
          intl("{{city}}, {{country}} — {{temperature}}°C", {
            city: "Kathmandu",
            country: "Nepal",
            temperature: 28,
          });
        }),
      );

      setFuncResults(results);
      setRunning(false);
    });
  }, [intl]);

  const runRenderBenchmark = useCallback(() => {
    setRunning(true);

    requestAnimationFrame(() => {
      const results: RenderBenchmarkResult[] = [];

      // ── Default react-i18next: useTranslation() + t() in each component ──
      const container1 = document.createElement("div");
      document.body.appendChild(container1);
      const root1 = createRoot(container1);

      const defaultComponents = Array.from({ length: RENDER_COUNT }, (_, i) =>
        createElement(DefaultTranslatedItem, { key: i, count: i }),
      );

      const startDefault = performance.now();
      flushSync(() => {
        root1.render(
          createElement(
            I18nextProvider,
            { i18n: defaultI18n },
            createElement("div", null, ...defaultComponents),
          ),
        );
      });
      const defaultTime = performance.now() - startDefault;

      results.push({
        name: "default t() — useTranslation() per component",
        renderTimeMs: defaultTime,
        componentCount: RENDER_COUNT,
      });

      root1.unmount();
      container1.remove();

      // ── Our intl(): useIntl() + function call per component ──
      const container2 = document.createElement("div");
      document.body.appendChild(container2);
      const root2 = createRoot(container2);

      const intlComponents = Array.from({ length: RENDER_COUNT }, (_, i) =>
        createElement(IntlTranslatedItem, { key: i, count: i }),
      );

      const startIntl = performance.now();
      flushSync(() => {
        root2.render(createElement("div", null, ...intlComponents));
      });
      const intlTime = performance.now() - startIntl;

      results.push({
        name: "intl() — useIntl() per component",
        renderTimeMs: intlTime,
        componentCount: RENDER_COUNT,
      });

      root2.unmount();
      container2.remove();

      setRenderResults(results);
      setRunning(false);
    });
  }, []);

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        i18n Performance Benchmark
      </h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Comparing <strong>default react-i18next</strong> (human-readable keys)
        vs <strong>intl()</strong> (build-time hash keys)
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.5rem",
          padding: "1rem",
          background: "#f9fafb",
          borderRadius: 8,
          fontSize: "0.85rem",
          fontFamily: "monospace",
        }}
      >
        <div>
          <strong style={{ fontFamily: "system-ui" }}>Default approach:</strong>
          <pre style={{ margin: "0.5rem 0", whiteSpace: "pre-wrap" }}>
            {`const { t } = useTranslation();
t("notifications", {
  name: "Aakash",
  count: 99,
});`}
          </pre>
        </div>
        <div>
          <strong style={{ fontFamily: "system-ui" }}>Our approach:</strong>
          <pre style={{ margin: "0.5rem 0", whiteSpace: "pre-wrap" }}>
            {`const intl = useIntl();
intl(
  "{{name}} has {{count}} notification
  |||| {{name}} has {{count}} notifications",
  { name: "Aakash", count: 99 },
);`}
          </pre>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={runBenchmark}
          disabled={running}
          style={{
            padding: "0.5rem 1.5rem",
            fontSize: "1rem",
            cursor: running ? "not-allowed" : "pointer",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: running ? "#eee" : "#fff",
          }}
        >
          {running ? "Running..." : "Run Function Benchmark"}
        </button>
        <button
          onClick={runRenderBenchmark}
          disabled={running}
          style={{
            padding: "0.5rem 1.5rem",
            fontSize: "1rem",
            cursor: running ? "not-allowed" : "pointer",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: running ? "#eee" : "#fff",
          }}
        >
          {running ? "Running..." : "Run Render Benchmark"}
        </button>
      </div>

      {funcResults.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
            Function Call Performance ({ITERATIONS.toLocaleString()} iterations)
          </h2>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "2rem",
            }}
          >
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={thStyle}>Test</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total (ms)</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Avg (ms)</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ops/sec</th>
              </tr>
            </thead>
            <tbody>
              {funcResults.map((r, i) => {
                const isGroupStart = i % 2 === 0;
                return (
                  <tr
                    key={r.name}
                    style={{
                      borderTop: isGroupStart ? "2px solid #ddd" : undefined,
                      background: r.name.startsWith("intl()")
                        ? "#f0fdf4"
                        : undefined,
                    }}
                  >
                    <td style={tdStyle}>{r.name}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {r.totalMs.toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {r.avgMs.toFixed(6)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {r.opsPerSec.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <SummaryTable results={funcResults} />
        </>
      )}

      {renderResults.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
            React Render Performance ({RENDER_COUNT.toLocaleString()}{" "}
            components)
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={thStyle}>Approach</th>
                <th style={{ ...thStyle, textAlign: "right" }}>
                  Render Time (ms)
                </th>
                <th style={{ ...thStyle, textAlign: "right" }}>
                  Per Component (ms)
                </th>
              </tr>
            </thead>
            <tbody>
              {renderResults.map((r) => (
                <tr
                  key={r.name}
                  style={{
                    background: r.name.includes("intl()")
                      ? "#f0fdf4"
                      : undefined,
                  }}
                >
                  <td style={tdStyle}>{r.name}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {r.renderTimeMs.toFixed(2)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {(r.renderTimeMs / r.componentCount).toFixed(6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderResults.length === 2 && (
            <p
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                background: "#f0fdf4",
                borderRadius: 6,
                border: "1px solid #bbf7d0",
              }}
            >
              intl() render is{" "}
              <strong>
                {(
                  renderResults[0].renderTimeMs / renderResults[1].renderTimeMs
                ).toFixed(2)}
                x
              </strong>{" "}
              faster than default useTranslation() render
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTable({ results }: { results: BenchmarkResult[] }) {
  const categories = ["simple string", "interpolation", "plural", "multi-var"];

  return (
    <div
      style={{
        padding: "1rem",
        background: "#f9fafb",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
        Summary: intl() vs default t()
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Category</th>
            <th style={{ ...thStyle, textAlign: "right" }}>default t() (ms)</th>
            <th style={{ ...thStyle, textAlign: "right" }}>intl() (ms)</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Difference</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const defaultResult = results.find(
              (r) => r.name === `default t(): ${cat}`,
            );
            const intlResult = results.find((r) => r.name === `intl(): ${cat}`);
            if (!defaultResult || !intlResult) return null;
            const speedup = defaultResult.totalMs / intlResult.totalMs;

            return (
              <tr key={cat}>
                <td style={tdStyle}>{cat}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {defaultResult.totalMs.toFixed(2)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {intlResult.totalMs.toFixed(2)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontWeight: "bold",
                    color: speedup > 1 ? "#16a34a" : "#dc2626",
                  }}
                >
                  {speedup.toFixed(2)}x {speedup > 1 ? "faster" : "slower"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "2px solid #ddd",
  fontSize: "0.875rem",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
  fontSize: "0.875rem",
};
