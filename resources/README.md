# Resources: skills and MCP servers

Everything the AI agent used to build Compety beyond writing code. If you want to build something similar, this is the toolbox.

- **Skills** are written procedures (a `SKILL.md` file) that the agent loads when a task needs them.
- **MCP servers** ([Model Context Protocol](https://modelcontextprotocol.io)) give the agent tools to act outside the editor: drive a browser, push to GitHub.

## Skills

### Third-party skills

These belong to their authors. They are **linked, not copied**: install them from the original source so you get the latest version and the author gets the credit.

| Skill | Author | Licence | Used for |
|---|---|---|---|
| [apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design) | [Emil Kowalski](https://github.com/emilkowalski) | MIT | Apple's interface and motion principles, distilled from the WWDC design talks. Used for the full frontend review: charts, headers, iOS menus, Dynamic Type, haptics, light mode |
| [emil-design-eng](https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng) | [Emil Kowalski](https://github.com/emilkowalski) | MIT | UI polish and animation decisions: easing, durations, sheets, toasts, gestures |
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | [Next Level Builder](https://github.com/nextlevelbuilder) | MIT | Searchable palettes, font pairings, chart types and UX guidelines. Used to check every colour against WCAG contrast in dark and light mode |

Both Emil Kowalski skills come from the same repository, [emilkowalski/skills](https://github.com/emilkowalski/skills), which has more worth a look (`animate-expo`, `mobile-native`, `review-animations`).

### Our own skills

| Skill | Used for |
|---|---|
| [paper-reader](skills/paper-reader/SKILL.md) | Searches PubMed and PubMed Central, reads the **full text** of each paper (methods, results, limitations, tables), rates the evidence and stores the findings in a reference library inside the project. It ran as a loop over effort measurement for each sport and its health effects. The scoring algorithm was built on that library |

It is published here so you can reuse it. It needs no API keys.

## MCP servers

| Server | Maintainer | Used for |
|---|---|---|
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Google Chrome team | Drove a real Chrome: previewed every HTML mockup before any React Native was written, and filled in App Store Connect (version, build, release notes, screenshots, pricing check, submission for review) |
| [GitHub MCP server](https://github.com/github/github-mcp-server) | GitHub | Pushed to this public repository and wrote these pages |

### Two setup notes from Windows

- **Chrome DevTools MCP** works best attached to a Chrome started with `--remote-debugging-port=9222` and its own profile, so the agent uses a browser where you are already signed in to App Store Connect. Point the server at it with `--browserUrl http://127.0.0.1:9222`.
- **GitHub MCP server**: run the local binary in `stdio` mode with a personal access token in the `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable. The HTTP mode with an `Authorization` header did not authenticate from the agent's CLI. Keep the token out of any file you commit.
