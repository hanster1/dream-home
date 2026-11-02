# Maison Rêve: Dream Home Designer

Pick a setting, an architecture, a plan and a scale, then see your house photographed outside, inside and (for some combinations) at twilight.

**Live:** https://dream-home-spencer-73ef.vercel.app

## Design playbook
I used one playbook: **Editorial Luxury Magazine** (the Architectural Digest / Kinfolk approach). That means serif display type (Cormorant Garamond) over a quiet sans (Inter), a warm near-black page, one brass accent (#c9a86a), full-bleed photography, and slow, cinematic motion: a Ken Burns hero, a curtain-wipe reveal and cross-fades between views. See DESIGN.md.

## How it works
- The app is a static site with no build step: `index.html`, `styles.css`, `data.js` and `app.js`.
- Images are served from jsDelivr (pinned to a commit of this repo) in production and from /img locally.
- All 57 images were pre-generated, photoreal and converted to WebP, with `-sm` thumbnails:
  - 15 settings (5 categories × 3)
  - 30 exteriors. Each site has 2 architectures rendered into that exact landscape, so each category has all 6.
  - 6 interiors, one per architecture
  - 6 twilight shots
- If the setting you picked doesn't have a render in your architecture, the app shows the same architecture at a sibling site in the same category and labels it.
- Save and compare use `localStorage`. Share puts the full design into the URL hash, so `/#setting=tahoe&style=japandi&layout=two&size=residence` opens straight to the reveal.
- No API keys and no live generation. Nothing secret ships to the client.

## Run locally
`npx serve .` or `python3 -m http.server`
