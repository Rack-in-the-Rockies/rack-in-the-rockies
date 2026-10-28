# AI event designer

The event editor has a **Design with AI** panel. An admin describes the look
they want ("icy winter blues, snowflakes, mittens, and teacups, with a cozy
handwritten feel"), clicks **Generate design**, and Claude designs the banner:
colors, a title accent font, how the mahjong tiles are arranged, and the small
illustrations painted on the tiles. The live preview updates right away.
Nothing goes live until the event is saved.

## Setting up the API key

The designer calls Claude through the Anthropic API, which needs an API key.
Until one is set, the Generate button shows "AI design is not set up yet."

### 1. Create the key

1. Go to the Claude Console at <https://platform.claude.com> and sign in (or
   create an account for Rack in the Rockies).
2. Open **Billing** and add a payment method and some credits. $10 to $20
   covers a lot of designs (see Cost below).
3. Optional but recommended: under **Limits**, set a monthly spend limit, for
   example $20, so a surprise can't run up a bill.
4. Open **API Keys**, click **Create Key**, name it `rack-in-the-rockies-site`,
   and copy the key. It starts with `sk-ant-` and is only shown once.

### 2. Add it to Vercel

1. In Vercel, open the Rack in the Rockies project, then **Settings** >
   **Environment Variables**.
2. Add a variable named `ANTHROPIC_API_KEY` with the key as its value. Tick
   **Production** and **Preview**.
3. Save, then redeploy (**Deployments** > the latest deployment > **...** >
   **Redeploy**) so the site picks it up.

### 3. Local development (optional)

Add the same line to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Treat the key like a password: never commit it, and never prefix it with
`NEXT_PUBLIC_` (that would expose it in the browser). Only signed-in admins
can trigger a generation; the key never leaves the server.

## Cost

Each click of Generate is one request to Claude Opus 5.5 and typically costs
around 5 to 15 cents. The Console's **Usage** page shows actual spend.

## How it works

- `lib/theme-designer.ts` sends the event details and the description to
  Claude and asks for a design recipe in a fixed JSON shape (structured
  outputs). If Claude declines a request, the API retries it on a fallback
  model automatically.
- `lib/event-theme.ts` sanitizes every recipe before it is saved or shown:
  colors must be hex, icon shapes are plain geometry (paths, circles,
  ellipses, rectangles, lines) with clamped coordinates, and text colors are
  adjusted until they meet WCAG contrast against the background, cards, and
  buttons. A recipe can never inject markup or break the layout.
- `components/event-hero-custom-decor.tsx` renders the tiles; the hero,
  announcement bar, and registration form read the palette from `--ev-*`
  CSS variables.
- The recipe is stored in `events.theme` (jsonb) and the description in
  `events.theme_prompt`. When a theme is set it overrides the Background art
  dropdown. An uploaded event image still replaces the tile art, but the
  theme's colors stay.
- Generation can take up to a minute, so the event editor pages set
  `maxDuration = 180`.
