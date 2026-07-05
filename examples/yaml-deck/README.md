# Acme CLI

A tiny command-line tool that does one thing well. This README is ordinary
Markdown — it is **not** modified for presentation. The deck references it
as-is and splits it into slides at each section heading.

## Installation

Install from npm. No configuration required to get started.

```bash
npm install -g acme-cli
```

## Usage

Run the command with a target file. Output is written next to the input.

```bash
acme build ./src/index.ts
```

## Configuration

Drop an `acme.config.json` in your project root to customize behavior:

- `outDir` — where build artifacts land
- `minify` — strip whitespace and comments
- `watch` — rebuild on file changes

## License

MIT. Contributions welcome.
