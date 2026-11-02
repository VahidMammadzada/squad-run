# Device and Playables Test Suite checklist

Two checks that need a real phone and a YouTube developer account. Tick each line; anything that fails, note the phone, the scene and what you saw.

## 1. Real-phone frame rate

YouTube sets no frame-rate requirement, so the targets below are ours: the game should feel smooth on a mid-range phone.

### Setup
1. Put the PC and the phone on the same Wi-Fi.
2. Run `npm run phone`. It builds the production game and serves it on the network. Note the `Network:` URL it prints (e.g. `http://192.168.1.20:4173/`).
3. If the phone can't open it, allow Node.js through Windows Firewall for private networks.
4. On the phone, open the URL with `?fps` on the end (e.g. `http://192.168.1.20:4173/?fps`). The phone needs internet too, because the YouTube SDK script loads from youtube.com.

The meter in the top-left corner shows:
- **fps**: frames in the last second. Green at 55 or more, yellow at 40–54, red below 40.
- **worst ms**: the slowest single frame in that second. 17 ms is a 60 fps frame, and anything over 50 ms is a visible hitch.
- **calls / tris**: the 3D renderer's draw calls and triangles.
- **W×H @ratio**: the 3D canvas resolution and the device pixel ratio.

### What to play and the targets
| Moment | How to get there | Target |
|---|---|---|
| Title screen | open the game | 55+ fps |
| Early run | level 1–3 | 55+ fps, worst under 34 ms |
| Big squad | a later level, take every × gate | 50+ fps, worst under 50 ms |
| Shootout with confetti | finish any level | no hitch over 100 ms |
| Walkable stadium | after a level, walk end to end | 50+ fps |
| Stall sheet open | open SCOUT and LOCKER ROOM | 50+ fps |

- [ ] Tested on an Android phone: model ______ result ______
- [ ] Tested on an iPhone: model ______ result ______
- [ ] Phone stays cool enough after 5 minutes of play, with no slowdown
- [ ] Text and buttons look sharp on the phone (not soft or blurry), in menus, the HUD and the stadium
- [ ] Stadium touch: drag the joystick into TRAINING and keep your finger down until the menu opens, then lift. Nothing is bought and the menu stays open. Walking slowly past a stall doesn't open it. Tapping the floor beside a counter walks you there and stops.

To jump straight to a heavy scene, run `npm run dev -- --host` instead. On the phone, open `http://<pc-ip>:8080/?fps&scene=Game&level=20` or `?fps&scene=Stadium`. Dev builds are a little slower than production, so use these only to find problem spots, then confirm the numbers with `npm run phone`.

If a phone is slow, send me the meter numbers for the worst moment. The usual fixes are a lower pixel-ratio cap (currently 2), fewer visible squad members, or lighter stadium detail at high tiers.

## 2. Local run-through with the mock SDK (before uploading)

Run `npm run dev` and open `http://localhost:8080/?mock`. A debug panel lets you trigger SDK events.

- [ ] **Pause / Resume:** during a run, press Pause. The squad, 3D world and sounds all stop. Resume continues from the same spot.
- [ ] **Audio:** press Audio on/off during a run. No sound while it's off, and sound returns when it's back on.
- [ ] **Interstitial, ok:** play from level 4 and finish 2 levels. Leaving the stadium with PLAY logs `requestInterstitialAd`, and the next level starts after the ad.
- [ ] **Interstitial, fail:** set Ads to `fail` and repeat. The next level starts right away.
- [ ] **Interstitial, hang (10 s timeout):** set Ads to `hang` and repeat. The next level starts by itself about 10 s after pressing PLAY. Interstitials also need 90 s since the last one, so wait or reload first.
- [ ] **Rewarded:** on Game Over, REVIVE works with Ads `ok` and fails cleanly with `fail`. RETRY and STADIUM are always usable.
- [ ] **Save failures:** Fail next load, then reload. The game starts and doesn't overwrite the old save. Fail next save, then finish a level. The game carries on.

## 3. Playables Test Suite (real SDK)

1. Build with `npm run build`, then zip the contents of `dist/` (not the folder itself).
2. In the YouTube Playables Developer Portal, upload the zip as a new release. On its **Test** step, open the **Test Suite** link. That step also has a phone preview link and QR code.
3. Work through the checks below in the Test Suite, then repeat the key ones on the phone preview.

Lifecycle:
- [ ] The SDK loads before game code. The Test Suite checks this, and `index.html` loads it first.
- [ ] `firstFrameReady` fires while the loading screen is visible. `gameReady` fires only once the Title menu can be tapped.
- [ ] Initial load is under 5 s on a phone. The build is ~0.5 MiB compressed against a 15 MiB recommendation.

Input:
- [ ] On desktop, Esc closes a stall menu and the Shop. Arrow keys steer in a run and walk in the stadium.

Pause and audio:
- [ ] Pause from the suite stops the game loop, the 3D rendering and the sound. Resume continues.
- [ ] Switching tabs or locking the phone does nothing by itself. The game pauses only on the SDK's pause.
- [ ] YouTube mute silences everything, and unmute restores sound. Device volume and the system mute are respected.

Ads:
- [ ] Interstitials only appear when leaving the stadium for the next level (PLAY or the tunnel), never during a run. The first is no earlier than level 4, then at least 2 levels and 90 s apart.
- [ ] The game is paused and silent during an interstitial, and resumes cleanly afterwards.
- [ ] If an interstitial errors or never finishes, the next level starts within ~10 s.
- [ ] Rewarded ads (revive, ×3 coins, merch ×2, scout refresh, doctor heal, campaign extend) start only from their labelled buttons. The non-ad option stays full-size beside them.
- [ ] Monetization is turned on in the Developer Portal.

Save and score:
- [ ] Progress (level, coins, fans, purchases) survives a reload.
- [ ] The score shown on YouTube equals the club's fans in the game.
- [ ] An old save (from before the club update) loads without errors.

Content Security Policy (optional, catches problems before certification):
- [ ] With the game served locally in Chrome, override the `Content-Security-Policy` header of `index.html` with the policy from the Test Suite guide (DevTools → Sources → Overrides). Play a level and check the console shows no CSP violations.

## Known build notes
- The Phaser chunk is ~1.19 MB on disk (318 KB gzipped). That's above YouTube's *recommended* 512 KiB per file but far below the 30 MiB hard limit. The other files are under 512 KiB.
