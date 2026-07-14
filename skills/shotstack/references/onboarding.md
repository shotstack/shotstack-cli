# First render: discovery interview

**The gate: do not compose an Edit until the user has answered the questions
below (or explicitly said "just show me anything").** Setting up the CLI and
key can proceed; writing the video cannot.

"Render my first video" is not a specification. It says nothing about the
subject, the content, the format or where the video will go. Neither does
"set up Shotstack". If any of those are unstated, ask. A first video is only
useful when it matches what the user is actually trying to make, and a short
interview gets there faster than guessing.

Skip the interview only when the user has stated what the video is (e.g.
"make a 9:16 promo from the images in ./assets with the tagline X"), or has
declined to answer.

## The interview

Ask conversationally, batched into one or two messages, and wait for the
reply. Skip any question the project already answers (e.g. a Next.js
e-commerce app full of product images answers question 2).

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
