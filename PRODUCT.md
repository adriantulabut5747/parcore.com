# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A mixed audience in roughly even parts: gamers looking for Clash of Clans base layouts and army comps (plus guides for Minecraft Java, Valorant, CODM, Genshin Impact and Tekken), and people hunting for free websites (movies, anime, manga, music, games, AI tools) through Web Resources. Both arrive from search or shared links, often on phones, wanting one specific thing fast.

## Product Purpose

Parchrome (parchrome.netlify.app) collects game guides and a curated directory of free websites in one place. Success is a visitor finding the layout, army, guide or site they came for and coming back for the next one.

## Positioning

Undecided; not stated beyond the site's own description: "CoC base layouts and army comps, guides for Minecraft, Genshin Impact, Valorant, CODM and Tekken, and free websites for movies, anime and games."

## Operating Context

Solo-built and actively growing: several sections and tabs are planned but not built yet (e.g. Valorant Find Players, Tools, Guides, Chat Art, Valo Quiz). Pages are reached directly from Google results and from shared base links (`#base-thNN-<id>`).

## Capabilities and Constraints

- Static site: plain HTML/CSS/JS, no build step, no framework, deployed on Netlify from GitHub.
- Content lives in JSON (site listings, TH layouts, nav, search indexes) and is rendered at runtime.
- Firebase/Firestore collects feedback, Valorant searches, Web Resources submissions and layout likes.
- Clan stats refresh via a scheduled GitHub Action.
- Folder reorganisation to clean URLs (`/coc/…`, `/valorant/…`) in progress (Oct 2026).

## Brand Commitments

- Name: Parchrome. Speaks in the brand voice ("Parchrome"), not as a person.
- Contact email: wildparchrome@gmail.com. No social links for now.
- Site copy: plain, specific sentences; no rhetorical questions or fragments.

## Evidence on Hand

Real content only: 610 web-resource listings, TH8–TH18 layouts and armies, clan stats. No testimonials, user counts or press exist; do not invent them.

## Product Principles

1. Get the visitor to the thing they came for in as few taps as possible.
2. Content is data: add to JSON, not to markup.
3. Old links must keep working; shared links are a promise.
4. Be honest about what isn't built yet.
