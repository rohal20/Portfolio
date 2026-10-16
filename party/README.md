# Live cursors (optional)

Out of the box the "other visitors" cursors only work between tabs of the same browser
(a built-in fallback), so you can demo it by opening the site in two tabs.
To make it work between real visitors you need a tiny relay server. PartyKit has a free tier.

1. `cd party`
2. `npx partykit login` (GitHub login) then `npx partykit deploy`
3. It prints a host such as `rohal-cursors.<your-name>.partykit.dev`
4. Put that host in `js/features.js`:  `const REALTIME_HOST = 'rohal-cursors.<your-name>.partykit.dev';`
5. Commit and push. Vercel redeploys.

Privacy: visitors get a random name like "curious-otter". Only a name, a colour and the pointer
position are sent, nothing is stored, and no cookies or IDs persist.
