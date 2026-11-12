# Design notes

Why the website looks and behaves the way it does. Read this before changing the stylesheet.

## Who it's for

Most listeners are older, many aren't confident with technology, and most are on a phone or tablet, often arriving from Facebook. So:

- Listen live is the biggest thing on the home page and plays in one tap, in place.
- All five pages are always on show in the header, on phones too. There is no menu button to find.
- Body text is 19px with generous line spacing, everything is sized in `rem`, and the Text size buttons scale the whole page (115% and 130%).
- Anything you can press is at least 44px tall.
- Buttons and messages say what happens in plain words: Listen live, Stop, "The connection dropped. Reconnecting…".
- Nothing moves unless it tells the listener something.

## Where the look comes from

The station's own material, not a template:

- **Navy and coral** are the logo's colours. Navy is the station colour. Coral is kept for "Jim is live" and for things that went wrong.
- **Cream and amber** are from Jim's studio photo: the wall behind him and the On Air sign. The page is cream instead of white. Amber is used for Listen live and nothing else, so the one thing most people came to do is the one thing that colour means.
- **Besley** is a Clarendon, the letter of country show posters and old radio dials. It's used for headings, the song title, Jim's own words and the Listen button.
- **Atkinson Hyperlegible Next** was drawn for readers with low vision. It's used for everything that is read.
- **The home page is the studio**: the sign, the Listen button and Jim at the microphone on navy, with what's playing along the bottom. The faint stripes echo the wooden panel behind Jim in the photo.
- **The sign** is dark and says "24-hour playlist" most of the time, and lights up coral with "Jim is live" during his shows.

Dark mode is deep navy, never grey or brown, and follows the device until the listener chooses.

Jim can change the navy to sea green, heather or charcoal in the editor. Amber and coral stay the same in every one.

## Contrast

Measured with the WCAG formula. Body text is 15:1 on cream and 15.6:1 in dark mode. The quietest text (grey notes) is 7:1 on cream and 6.3:1 on the darker cream panels. Navy text on the amber button is 9.2:1. White on the coral sign is 5.4:1.

## Layout rules

- One wide column of 70rem, with 1.25rem gutters on phones and 2rem from tablets up.
- Every page after the home page opens with its name on a navy band that carries on from the header.
- Photos sit in fixed frames with a white edge, so any photo Jim uploads fits.
- On a phone the home page order is: sign, headline, Listen live, now playing, Jim's photo. On wider screens the photo sits beside the Listen button.
- Blocks that depend on live data (Up next, Just played) stay hidden until the data arrives, so nobody sees placeholder text.
- No rule lines between sections and no boxes around things that don't need them. The show times table and the questions list keep their row lines because rows need them.

## Motion

All of it is feedback, and all of it is switched off when the device asks for reduced motion.

| What moves | When | Why |
|---|---|---|
| A ring turns on the Listen button | While the station is connecting | Shows the press was heard |
| The level bars beside "Now playing" | Only while sound is playing | Shows the station is on |
| The sign flickers on | Once, when Jim goes live | Draws the eye to the change |
| The song slides out and the next slides in | When the song changes | Shows the change happened |
| Just played slides along one place | When a song finishes | Keeps the list readable as it changes |
| The player bar and the full player rise | When they open | Shows where they came from |
| A page fades in over 0.16 seconds | When a page opens | Softens the swap without holding anyone up |

There are no scroll effects and nothing loops while the station is silent.

## Things the stylesheet has to keep

- The Content-Security-Policy in `public/_headers` allows no inline styles or scripts and no outside fonts. Fonts live in `public/fonts/`.
- `js/first.js` is loaded before the page is drawn so saved text size and dark mode never flash. It must stay a plain script, not a module.
- Inputs are styled with `input:not([type])`.
- `tests/site.test.mjs` lists every hook the scripts, the editor and Netlify Forms rely on.
- Older iPads are common among listeners, so the stylesheet avoids `light-dark()` and `color-mix()`. That is why the dark colours are written out twice.

## The link-preview picture

`design/link-preview.html` is the source of `public/images/link-preview.jpg`, the 1200 by 630 picture Facebook shows when the site is shared. Open it in a browser at that size and save a screenshot. Facebook remembers pictures by address, so give a changed picture a new file name and update `og:image` in `public/index.html`.
