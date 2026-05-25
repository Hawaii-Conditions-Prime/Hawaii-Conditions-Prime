# Hawaii Conditions MCP Server — Claude Notes

## Node.js Version

- This repo targets **Node.js 24** (`engines.node >= 24` in package.json)
- Use `@types/node@^24.0.0` in devDependencies
- Always use `actions/checkout@v5` (not v4) in GitHub Actions — v5 supports Node.js 24, which becomes the default on June 2nd, 2026

## MCP Registry

- Server name: `io.github.Hawaii-Conditions-Prime/hawaii-conditions` (the `io.github.<owner>` namespace must match the GitHub org that runs the OIDC publish)
- Published via `.github/workflows/publish-mcp.yml` using GitHub OIDC auth (`login github-oidc`)
- Trigger: push a `v*` tag, or use **Actions → Run workflow** selecting the correct branch
- `server.json` description must be ≤ 100 characters
- Transport URL: `https://hawaii-conditions-prime.vercel.app/api/mcp` (not `/mcp`)
- Remote servers use the `remotes` array in `server.json`, not `packages`
