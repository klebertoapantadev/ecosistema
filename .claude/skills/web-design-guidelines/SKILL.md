---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Fetch fresh guidelines before each review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to retrieve the latest rules. The fetched content contains all the rules and output format instructions.

## Usage

When a user provides a file or pattern argument:
1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.

## Ecosistema Repository Overrides (Mandatory)
<!-- Reglas Obligatorias del Monorepo Ecosistema -->

- **No Tailwind CSS (`AGENTS.md` Rule #17):** Never recommend or write Tailwind CSS classes. All CSS fixes must use explicit React `style={{ ... }}` objects and native CSS classes/variables in `apps/*/app/globals.css`.
- **Sober Palette & Compact Scale:** Validate panel views against `gobernanza/productos/*/sistema-visual.md` (sober warm-editorial palette, zero neon/saturated fills or flashy gradients, compact heading sizes `h1` `1.12rem` / `h2` `0.92–0.94rem`, WCAG AA contrast, and concise 2–3 word button labels with `title` + `aria-label`).
