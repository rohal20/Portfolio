# rohal.dev portfolio

Neo-brutalist, heavily animated single-page portfolio. No build step.

```
index.html      page markup (sections in page order, SEO/OG tags in <head>)
css/styles.css  all styles (design tokens in :root, then sections in page order)
js/main.js      all behaviour (GSAP + ScrollTrigger, smooth scroll, overlays, Bit, games)
og-image.png    social share preview
vercel.json     clean URLs, security + cache headers
```

Open `index.html` directly, or serve the folder with any static server.
GSAP 3.12.5 and Google Fonts load from CDNs. To receive contact-form messages, set
`WEB3FORMS_KEY` at the top of the contact section in `js/main.js`.
