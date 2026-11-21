# NagarLens demo video: plan and script (Team 11)

**Deliverable:** one MP4 with the screen walkthrough and audio narration in sync, 2:00 (extended cut 3:00 if the submission allows it). It is built by one command, `demo/walkthrough.py`, so it can be re-made in three minutes after any merge.
**Ready for internal review by 14:30, final by 14:45. Recorder and voice: Kshitij.**
Every number in the voiceover is checked against the app by `demo/check_demo.py`. Run it before recording and after every merge. If it prints FAIL, fix the line or the code; never narrate a number it rejects.

## The story in one sentence

> Mumbai billed ₹13.43 Cr for 2025 monsoon road repairs. ₹3.22 Cr of it needs a second look. Recover that money first, then spend it where the risk is highest.

The whole video stays in one ward, **L · Kurla**, so the viewer follows one place from the money to the complaint to the plan. Each beat answers one judging criterion.

## Plan for the next 90 minutes

| When | What | Who |
|---|---|---|
| now | Put `ANTHROPIC_API_KEY` in `.env`, restart the API, open each demo screen once so the Claude answers are cached; commit `data/cache/ai_cache.json` | Kshitij + lead session |
| 13:45 | Run `demo/check_demo.py` and `demo/walkthrough.py --fast`; read the script aloud once against a timer | Kshitij |
| 14:00 | PRs open. Decide which teammate beats are in (table below) | Kshitij |
| 14:15 | Merge cut-off. Re-run both checks on `main` | lead session |
| before 14:15 | Listen to the narration preview (`--narration-only`) and pick the female or male Indian voice | Kshitij |
| 14:15–14:30 | Build the video: `.venv/Scripts/python demo/walkthrough.py`. Watch it once end to end | Kshitij |
| 14:30–14:45 | Internal review against the checklist at the bottom; one re-take if needed | whole team |
| 14:45 | Export 1080p MP4, upload, paste the link in the submission form | Kshitij |

## Shot list and voiceover: 2:00 cut

Read at a steady pace: about 275 words, which leaves ten seconds of slack. Clicks are in **bold**.

| # | Time | Screen | What you do | Voiceover | Criterion |
|---|---|---|---|---|---|
| 1 | 0:00–0:13 | `/` hero band, ward L | Hold on the dark band: ₹13.43 Cr → ₹3.22 Cr → Next rupee plan | "Every monsoon, Mumbai pays to fix the same roads again, and nobody can easily say where the money went or whether the fix lasted. NagarLens follows every rupee, from a citizen's complaint to the repair bill. Of thirteen point four three crore billed last season, three point two two crore needs a second look. The data is synthetic." | The pitch |
| 2 | 0:13–0:30 | `/` money flow and ward map | Scroll to "Follow the rupee". Trace Billed → work type → outcome with the cursor, end on "Paid during warranty" | "Take Kurla ward. It billed a hundred and ten percent of its budget. Most repairs held, but thirty-nine point six lakh was billed on roads still under warranty." | Connects the trail |
| 3 | 0:30–0:57 | `/audit` | **What doesn't add up?** → **Possible duplicate bill**. The first lead (AUD-0133) opens with two bills side by side. Point at the `=` marks, then **Hold for evidence** | "Three exact rules, tuned so normal variation is never flagged. Here is one lead. Two bills on LBS Marg: same contractor, same method, same area, three days apart, half a percent different. One has three citizen complaints behind it. The other has none. It's a lead, not an accusation, so the officer decides: hold for evidence." | Audit accuracy |
| 4 | 0:57–1:12 | `/case` | **Follow one case** (WO25-02068 is preselected). Run the cursor along the six steps, then scroll to the complaints | "Every bill traces back to people. Four complaints, one in Marathi, led to this cave-in repair. It was late, failed within thirty days, and sits on a road still under warranty." | Connects the trail |
| 5 | 1:12–1:32 | `/scorecards` | **Who is responsible?** Pause on the blue "System problem" banner, then scroll to the Mahalaxmi card: chips and the 38% vs 23% tile | "Who is responsible? We compare like with like. Twenty-four hour deadlines are missed by almost everyone, so that is a system problem. Durability is where contractors differ: on the same repair methods, this one re-opens thirty-eight percent of fixes where its peers manage twenty-three." | Fair accountability |
| 6 | 1:32–1:52 | `/next-rupee` | **Where should the next rupee go?** Pause on the green banner. Type **500000** in the budget box, then scroll down a little so the tiles (9 funded, 16 deferred, 5 to warranty) and the first ranked cards with their chips are in frame | "Then reinvest. Kurla overspent, so the plan uses money it can recover. Open complaints are ranked by risk: hospital roads, bus routes, flood hotspots. Cut the budget to five lakh and it funds nine, defers sixteen, and never overspends. Five more go back to the warranty contractor at zero cost." | Budget smarts |
| 7 | 1:52–2:00 | `/ask` | **Ask about my complaint** → **Ask** (the Marathi question is prefilled) | "And a citizen can ask, in Marathi, what happened to her complaint, and get the answer in Marathi. NagarLens: recover, then reinvest." | Usable demo |

## Extended cut (3:00): optional beats

Use these only if the submission allows three minutes. Each is 10 to 15 seconds and slots in after the beat named.

| After beat | Screen and action | Voiceover |
|---|---|---|
| 2 | `/` ward map: hover two wards, click another, click back to L | "Every ward is on the map, shaded by rupees to review. Click one and every page follows." |
| 3 | `/audit`: **Above rate card**, open the first lead, show the three bars | "The rate-card rule only fires above one point four times the standard cost. Normal jobs sit between point seven five and one point three, and they are never flagged." |
| 5 | `/scorecards`: **wards**, find Ward L | "Kurla finishes thirty-two percent of repairs on time. That looks bad, but wards with the same deadlines and flood risk manage thirty-four, so Kurla is in line. We don't blame a ward for its rain." |
| 6 | `/next-rupee`: drag **Hospitals & schools** to 0, then back | "Every weight is adjustable. Seven of the top ten issues differ from simply counting complaints." |
| 7 | `/ask`: scroll to the tiles under the answer | "The answer comes from the linked records: the work order, the contractor, the bill, and whether the fix held." |

## Teammate features: add a beat only if merged by 14:15

| Feature (owner) | Where it goes | Line to add | If not merged |
|---|---|---|---|
| Recommended verdict + fair hearing (Harsh) | Beat 3, before the decision click | "NagarLens recommends a verdict and shows both sides: the auditor's case and the fair explanation." | Keep beat 3 as written |
| Evidence-request letter (Shariyan) | Beat 3, after the decision click | "One click drafts a request for evidence. Not a legal notice." | Skip |
| Rain and flood context on scorecards (Shariyan) | Beat 5 | "Each card shows the heavy-rain weeks the work was done in." | Keep beat 5 as written |
| Strategy comparison (Aditya) | Beat 6, after typing the budget | "The same five lakh spent three ways. The risk plan covers more hospital roads and flood spots than chasing complaint counts." (say only numbers on screen) | Keep beat 6 as written |
| Road history page (Deven) | Beat 4, click the road name | "One page per road: every repair, every rupee, every repeat failure." | Use the road table on `/case` |

Adding a beat means cutting something. In the 2:00 cut, drop beat 4's second sentence first, then the last sentence of beat 6.

## Honesty rules for the voiceover

- Say "the data is synthetic" once (beat 1). The "Synthetic (organizer)" badge is on every page.
- Say "billed", never "paid" or "spent by BMC": the dataset has bills, not payments.
- Flags are "leads" or "needs a second look". Never fraud, scam, overcharging or cheating.
- Only say "Claude wrote this" when the badge on screen reads "Written by Claude". Without the API key the badges read "Template (Claude offline)"; in that case describe what the text is, not who wrote it.
- Name the fictional contractor only in beat 5, and only with its numbers next to it.

## How the video is made (narration always in sync)

`demo/walkthrough.py` drives Chrome through the seven beats and records the screen. Sync is by construction:
each beat has one narration clip, the beat stays on screen for exactly the length of its clip (plus a 0.7 s pause),
the clicks inside a beat happen at fixed points of that clip (for example "Hold for evidence" is pressed as the
last sentence of beat 3 is spoken), and each clip is placed on the audio track at the second its beat started.
Longer or shorter narration just makes that beat longer or shorter; picture and voice cannot drift apart.

**Step 1: checks** (both servers running; API on :8000, web app on :3000)

```
.venv/Scripts/python demo/check_demo.py            # must end: ALL CLAIMS MATCH THE APP
.venv/Scripts/python demo/walkthrough.py --fast    # every beat "ok", "page errors: none"
```

**Step 2: narration**. The build picks the voice in this order:

1. **Your own recording**, if `demo/narration/beat1.wav` … `beat7.wav` exist (one per beat, reading the voiceover column
   above). Beats without a file use the voice below, so you can replace them one at a time.
2. **Microsoft neural Indian-English voice (the default, chosen by the lead).** Free, no account or key. It sends the
   narration text to Microsoft's online speech service. One-time install: `uv pip install --python .venv edge-tts`.
   - Male `en-IN-PrabhatNeural` is the default, at `--rate +20%`: the final take runs 1:59.
   - Female: add `--voice en-IN-NeerjaNeural`.
   - Speed is `--rate +15%` by default, because at natural speed the voice needs about 2:23. Use `--rate +0%` only
     if the submission allows a longer video.
   - Listen before recording: `.venv/Scripts/python demo/walkthrough.py --narration-only` makes the seven clips and
     `demo/out/narration_preview_<voice>.wav` without touching the screen.
   - Clips are cached in `demo/out/tts_cache/`, so the final take needs no network unless a line changed.
   - If the service fails, the build stops with the reason. It never falls back to the robotic voice on its own.
3. **ElevenLabs** (`--tts elevenlabs`, key in `.env` as `ELEVENLABS_API_KEY`). Tested on 21 Nov: the key works, but on
   the free plan the API refuses library voices, and ElevenLabs' Indian voices are library voices. It works with no
   code change after a plan upgrade; `--list-voices` shows the Indian voices on the account.
4. **Offline Windows voice** (`--tts sapi`): no network, robotic. For rehearsal only.

**Step 3: build**

```
.venv/Scripts/python demo/walkthrough.py           # -> demo/out/nagarlens_demo.mp4 (1440×900, H.264 + AAC)
```

It takes about as long as the video. It prints the second each beat starts and saves one still per beat next to
the MP4. With the default voice the 2:00 cut comes out at about 1:59; another voice or speed changes the length, never the sync. `demo/out/` is ignored by git; upload the MP4
to the submission, do not commit it.

Rules for a clean take:

- Nobody edits `frontend/` while it records. A half-saved file shows up as an error overlay in the video.
  For the final take, record a production build: `cd frontend && npm run build && npm run start`.
- Run it after the 14:15 merge cut-off, so the video shows the app that is submitted.
- It resets the officer decision on AUD-0133 before the take, so the "Hold for evidence" click visibly changes the screen.
- If you change a voiceover line, change it in both places: the table above and `NARRATION` in `demo/walkthrough.py`.
- To add a teammate beat or an extended-cut beat, add an entry to `NARRATION` and a block of clicks in `main()`.

**Recording by hand instead** (OBS or Win+Alt+R): one clean browser window at 1440×900, 100% zoom, notifications off,
ward L selected, read from this file on a second screen. Use this only if the scripted build fails.

Last resort, if the web app itself is broken: the Streamlit fallback (`.venv/Scripts/python -m streamlit run app.py`)
tells the same story in tabs. The figures are the same; the clicks differ.

## Review checklist (14:30–14:45)

- [ ] Under the time limit, and the first ten seconds state the problem and the headline number.
- [ ] Every number spoken is visible on screen at that moment.
- [ ] Each of the five judging criteria has its beat: audit accuracy (3), fair accountability (5), budget smarts (6), connects the trail (2, 4), usable demo (7).
- [ ] "Synthetic" is said once and no blame word is spoken or shown.
- [ ] No loading spinner, error box, dev badge, or personal tab/notification on screen.
- [ ] Audio is clear from start to finish; no clipped first word.
- [ ] Voice and picture match at every beat change (the build prints the beat start times; spot-check three).
- [ ] The repo link in the submission opens the README with the two start commands.
