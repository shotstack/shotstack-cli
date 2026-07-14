# First render: discovery interview

Load this when the user is new to Shotstack: a fresh install, no Edit JSON in
the project, no saved credentials, or an open-ended ask like "render a first
video". Skip the interview when the user has already specified what to build.
A fully-specified ask is its own answer.

A first video is most useful when it matches what the user is actually trying
to make. A short interview gets there faster than guessing.

## The interview

Ask conversationally, batched into one or two messages. Skip any question the
project already answers (e.g. a Next.js e-commerce app full of product images
answers question 2).

1. **What should the video do?** Social clips, product or listing videos,
   personalised outreach, in-app content, something else? Listen for the job,
   not the feature.
2. **What content or data exists?** Images, footage, audio or brand assets in
   the project or at URLs; structured data (CSV, JSON, database, CMS) that
   could drive repeated or personalised videos.
3. **Where will the videos go?** Destination decides format: 9:16 for
   TikTok/Reels/Shorts, 1:1 or 4:5 for feeds, 16:9 for YouTube/web. When in
   doubt for social, default to 1080x1920 (9:16).
4. **One video or many?** Both make fine first renders, but the composition
   differs: pipelines should use merge fields from the start.

## From answers to a first render

- Compose ONE Edit JSON that answers the four questions. Make it something
  worth keeping, not a minimal demo.
- Use the user's real assets when they exist (host local files first:
  `shotstack ingest upload <file> --watch`, then reference the returned URL).
  If nothing is to hand, build from the Shotstack asset library
  (`references/asset-library.md`) and motion-graphic snippets
  (`references/html5-snippets.md`), matched to their stated use case.
- Use their brand where it exists: colours, fonts and logos from the project
  or their site rather than an invented look. Follow the house motion
  language (`references/motion.md`).
- If they chose "many": add merge fields (`{{ placeholder }}`) for the parts
  that vary per video, and show one render with sample values.
- Loop: compose, then `shotstack validate`, then preview (`shotstack studio`
  for a human look, or straight to render), then `shotstack render edit.json
  --env stage --watch`.
- Afterwards, explain what they have: the Edit JSON is a reusable template,
  stage renders are free, and the same JSON renders in production by
  switching `--env`. Point to merge fields and the render API for scale.

## Tone

Brisk, concrete and curious about the user's project. Batch questions, don't
drip-feed. One good clarifying question beats three generic ones.
