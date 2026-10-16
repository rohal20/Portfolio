# rohal.dev portfolio

Neo-brutalist, heavily animated single-page portfolio. No build step.

```
index.html      page markup (sections in page order, SEO/OG tags in <head>)
css/styles.css  all styles (design tokens in :root, then sections in page order)
css/features.css  styles for the v16 features (npm ls, Friday deploy, theme drawer, live cursors)
js/main.js      all behaviour (GSAP + ScrollTrigger, smooth scroll, overlays, Bit, games)
js/features.js  v16 features: npm ls, sudo hire rohal + hidden commands, Friday deploy, theme drawer, live cursors
party/          optional PartyKit relay for live cursors (see party/README.md)
og-image.png    social share preview
vercel.json     clean URLs, security + cache headers
```

Open `index.html` directly, or serve the folder with any static server.
GSAP 3.12.5 and Google Fonts load from CDNs. To receive contact-form messages, set
`WEB3FORMS_KEY` at the top of the contact section in `js/main.js`.
