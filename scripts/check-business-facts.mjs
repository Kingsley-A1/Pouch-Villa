#!/usr/bin/env node
/**
 * Fails the build when a business fact is hardcoded in source.
 *
 * AGENTS.md §4: phone numbers, bank details, addresses, prices, policy wording and
 * the like belong in the admin settings store, never in a source file. This is the
 * check that keeps that rule real rather than aspirational.
 *
 * Run with --selftest to prove it still catches a deliberate violation — that proof
 * is part of the Phase 0 gate.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const RULES = [
  {
    id: "nigerian-phone",
    description: "Nigerian phone number",
    pattern: /(?:\+?234|\b0)[789][01]\d{8}\b/,
  },
  {
    id: "whatsapp-link",
    description: "wa.me link with a number",
    pattern: /wa\.me\/\d/,
  },
  {
    id: "email-literal",
    description: "email address literal",
    pattern: /[a-zA-Z0-9._%+-]+@(?!example\.|test\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  },
  {
    id: "naira-amount",
    description: "naira currency amount",
    pattern: /₦\s?\d/,
  },
  {
    id: "account-number",
    description: "10-digit bank account number",
    pattern: /\b\d{10}\b/,
  },
];

/** Settings, seed fixtures and tests are where these values are allowed to appear. */
const EXEMPT = [
  /^tests\//,
  /(^|\/)tests\//,
  /(^|\/)__tests__\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /(^|\/)scripts\/check-business-facts\.mjs$/,
  /(^|\/)packages\/pv-backend\/src\/db\/seed-data\.ts$/,
  /(^|\/)docs\//,
  /(^|\/)\.github\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)README\.md$/,
  /(^|\/)AGENTS\.md$/,
  /(^|\/)\.env\.example$/,
];

const SCANNED = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|sql)$/;

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((file) => SCANNED.test(file))
    .filter((file) => !EXEMPT.some((rule) => rule.test(file)));
}

function scan(files) {
  const findings = [];
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    content.split("\n").forEach((line, index) => {
      // A line may opt out where the match is provably not a business fact.
      if (line.includes("business-facts-allow")) return;
      for (const rule of RULES) {
        const match = rule.pattern.exec(line);
        if (match) {
          findings.push({ file, line: index + 1, rule, text: match[0] });
        }
      }
    });
  }
  return findings;
}

function report(findings) {
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line}  ${finding.rule.description} — "${finding.text}"`,
    );
  }
}

if (process.argv.includes("--selftest")) {
  const samples = [
    ["nigerian-phone", "const number = '08088071657';"],
    ["whatsapp-link", "const link = 'https://wa.me/2348088071657';"],
    ["email-literal", "const address = 'orders@pouchvilla.ng';"],
    ["naira-amount", "const price = '₦15,000';"],
    ["account-number", "const account = '0123456789';"],
  ];
  let failed = 0;
  for (const [id, sample] of samples) {
    const rule = RULES.find((candidate) => candidate.id === id);
    if (!rule.pattern.test(sample)) {
      console.error(`SELFTEST FAIL: ${id} did not match its own sample`);
      failed += 1;
    } else {
      console.log(`selftest ok: ${id} catches ${JSON.stringify(sample)}`);
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

const findings = scan(trackedFiles());
if (findings.length > 0) {
  console.error(`\nHardcoded business facts found in ${findings.length} place(s):\n`);
  report(findings);
  console.error("\nThese belong in the admin settings store, not in source. See AGENTS.md §4.\n");
  process.exit(1);
}

console.log("No hardcoded business facts found.");
