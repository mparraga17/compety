# How the launch videos were made

Compety's two launch videos, a 28-second intro and an 87-second explainer of how the app works, were made the same way as the app: an AI agent wrote the code, a product manager reviewed every render and asked for changes. No video editor and no After Effects. Every frame is drawn by code, so the same command always produces the same MP4.

## The tools

| Tool | Author | Role |
|---|---|---|
| [Remotion](https://www.remotion.dev) | [Remotion](https://github.com/remotion-dev/remotion) | Video written in React. It renders frame by frame, so nothing depends on how fast the computer is, and it encodes the MP4 (H.264, ready for X) with its bundled ffmpeg. `npx remotion studio` previews, `npx remotion render` exports |
| [Three.js](https://threejs.org) | [three.js authors](https://github.com/mrdoob/three.js) | Every 3D object: the iPhones, the wristband, the floating layers, the data packet travelling between them |
| [Mixamo](https://www.mixamo.com) | Adobe | Real motion capture for the sports shots: a different athlete for running, tennis, barre, pilates and strength. The animations are downloaded as FBX and loaded into Three.js |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Google Chrome team | The agent used it to browse Mixamo and download the clips, in a Chrome already signed in |
| [apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design) skill | [Emil Kowalski](https://github.com/emilkowalski) | The style brief for the explainer: one idea per shot, thin type, lots of empty space, slow camera, no effects |

Mixamo's animations are free to use in your own projects, but the FBX files themselves cannot be redistributed, so they are not in this repository.

## How each video is built

**Intro (28 s)**

1. **Sports, 0 to 7 s.** Mixamo motion capture drawn with custom shaders that imitate a pencil sketch: construction rings, a traced outline, hatching, and a line that "boils" every three frames. Neon brand purple on a black grid floor, Tron style. Each shot is a close-up of one body part (the feet in barre, the arm and racket in tennis), blurred and brief, so it reads like a memory rather than a render.
2. **The journey, 7 to 28 s.** A 3D wristband sends the workout to a 3D iPhone showing Apple Health, then to the engine, Supabase, and a friend's iPhone that receives the real "Lead change" notification. It ends with the leaderboard, a chat in glass cards, and the app icon.

**Explainer, "Anatomy" (87 s)**

The exploded view from Apple's product videos: the iPhone opens into five floating layers (Interface, Health, Engine, Sync, Friends). Each layer in turn lights up, unfolds a chain of five steps with the tool behind each one, and the iPhone turns to face the camera to show the real screen for the step being explained.

## Lessons from the renders

- **Copy the screens from the real code, never from imagination.** The phone screens are redrawn by reading the app's own screens and theme: same copy, same colours, same tab bar. The first versions invented states the app does not have, and anyone who downloads the app would notice.
- **Blur does not hide text in this renderer.** The canvas renderer ignores blur on text, so readable copy stays readable. Anything private (the scoring rules) is drawn as text-less bars instead.
- **Generated figures look robotic.** Procedural stick figures were replaced with real motion capture, and then softened further with blur and short shots.
- **Use only the app's palette.** An early accent red looked out of place because the app barely uses red; everything moved to the brand purples.
- **Review stills, not just the full video.** Rendering single frames at key timestamps takes seconds and catches most layout problems before a full render.
