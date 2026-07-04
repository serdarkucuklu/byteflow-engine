# Task 5 Report — Post-process: music mux (ffmpeg → final vertical mp4)

## Files created/modified
- Created `publish/post-process.mjs` — exports `postProcess({videoPath, musicPath, outPath})`.
- Created `assets/music/README.md` — royalty-free music placement note.
- Created `publish/post-process.test.mjs`.
- Modified `package.json` — added `"postprocess": "node publish/post-process.mjs"` script.
- Modified `.gitignore` — added `assets/music/_*.mp3` so the test-generated synthetic tone
  fixture isn't committed as a binary.
- Modified `.superpowers/sdd/progress.md` — added Task 5 ledger line.

## Path bug vs. the plan (fixed, per task instructions)

The plan's test builds the music path as:
```js
fileURLToPath(new URL(mp3, 'file://' + musicDir + '/'))
```
`musicDir` here is already a filesystem path string produced by `fileURLToPath` (e.g.
`D:\AI\Playground\16-byteflow-engine\assets\music\`). Prefixing that with `file://` does not
produce a valid URL — Windows paths use backslashes and a drive letter (`D:\`), which collide
with URL syntax (`D:` reads as a scheme, backslashes aren't valid path separators in a URL).
`new URL(mp3, ...)` on that string throws/resolves incorrectly on Windows.

Fix: imported `join` from `node:path` and used `join(musicDir, mp3)` instead — a plain
filesystem path join, which is what was actually intended (resolve the discovered `.mp3`
filename against the music directory). Verified this resolves correctly and the test passes.
No other path construction in the plan needed changes; `postProcess`, `build.mjs`'s
`musicDir + '/' + mp3` (Task 6, not touched here) and `post-process.mjs` itself were left as
specified since `execFileSync`/ffmpeg accept both `/` and `\` on Windows.

## Test output (verbatim, trimmed of ffmpeg banner noise)

```
$ node --test publish/post-process.test.mjs
TAP version 13
...
# Subtest: produces final mp4 with audio at 1080x1920
ok 1 - produces final mp4 with audio at 1080x1920
  ---
  duration_ms: 901.0773
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1360.9157
```

Full root suite (`node --test`, includes Task 1/2/5 tests — 10 total) also passes:
```
# tests 10
# pass 10
# fail 0
```

No real mp3 existed in `assets/music/`, so the test's `before()` hook generated
`assets/music/_test_tone.mp3` via `ffmpeg -f lavfi -i sine=frequency=220:duration=30
-c:a libmp3lame`, exactly as the plan specifies.

## ffprobe of the produced `dist/final.mp4`

```
$ ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height \
    -of default=noprint_wrappers=1 dist/final.mp4
codec_name=h264
codec_type=video
width=1080
height=1920
codec_name=aac
codec_type=audio
duration=13.300000
```

Confirms: video stream unchanged (h264, 1080x1920, copied from `render/output/project.mp4`),
genuine AAC audio stream present, duration matches the source video (13.3s, since `-t`/
`-shortest` clamp the looped/faded music to the video's length).

## Commit
`460d511` — "feat(byteflow): ffmpeg music post-process"

## Concerns
- `dist/final.mp4` currently carries the synthetic 220Hz test tone as its only available
  "music" (no real royalty-free track has been placed in `assets/music/` yet) — that's
  expected at this stage; Task 6's plan explicitly defers adding a real Pixabay/Uppbeat mp3
  to its own step. `assets/music/README.md` documents where to drop one.
- The plan's `build.mjs` (Task 6, out of scope here) does its own `mp3` filename filter
  (`!f.startsWith('_')`) so it will correctly skip the synthetic `_test_tone.mp3` once a real
  track is added — verified by reading that file's logic, not exercised in this task.
