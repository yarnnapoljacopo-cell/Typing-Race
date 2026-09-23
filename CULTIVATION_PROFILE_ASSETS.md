# Cultivation profile assets

Created with the built-in `image_gen` tool. The original reference was inspected before generation. Transparent PNGs are bundled locally with the application; no remote image service is required to display them.

- `artifacts/writing-sprint/public/cultivation/cultivator-male.png`
- `artifacts/writing-sprint/public/cultivation/cultivator-female.png`

## Male cultivator prompt

Use case: stylized-concept. Asset type: transparent cutout character for a cultivation-themed writing app profile. Primary request: a complete full body male Chinese xianxia cultivator seated cross-legged, eyes softly closed, hands relaxed on the knees, serene meditation, adult around 25, long black hair in a small topknot with one antique gold hairpin. Layered ivory and charcoal-blue flowing robes, understated antique gold edging, muted jade sash. Slightly cartoonish painterly illustration, expressive clean silhouette, elegant hand-painted ink and watercolor texture, appealing friendly face, fine restrained details like a beautiful illustrated storybook, not 3D, not photorealistic, not anime gloss. Centered front three-quarter view, full robe, crossed legs and hands visible, compact meditative silhouette. Thin wisps of pale mist around the lower hem only. Color palette charcoal ink, dusty slate blue, warm ivory, antique gold, muted jade; inspired by classical Chinese mountain ink paintings. Genuine transparent background with alpha, no scenery, no text, no UI, no framing, no symbols. Keep all hands anatomically natural, no extra fingers. Render square with breathing room around figure. The app will animate this figure gently as a breathing meditation.

## Female cultivator prompt

Use case: stylized-concept. Asset type: transparent cutout character for a cultivation-themed writing app profile. Primary request: a complete full body female Chinese xianxia cultivator seated cross-legged, eyes softly closed, hands relaxed on the knees, serene meditation, adult around 25, long black hair partly gathered with a small antique gold and muted jade hairpin. Layered modest ivory and muted jade flowing robes, understated antique gold edging and dusty slate blue sash. Slightly cartoonish painterly illustration, expressive clean silhouette, elegant hand-painted ink and watercolor texture, appealing friendly face, fine restrained details like a beautiful illustrated storybook, not 3D, not photorealistic, not anime gloss. Centered front three-quarter view, full robe, crossed legs and hands visible, compact meditative silhouette. Thin wisps of pale mist around the lower hem only. Color palette charcoal ink, dusty slate blue, warm ivory, antique gold, muted jade; inspired by classical Chinese mountain ink paintings. Genuine transparent background with alpha, no scenery, no text, no UI, no framing, no symbols. Keep all hands anatomically natural, no extra fingers. Render square with breathing room around figure. The app will animate this figure gently as a breathing meditation.

## Behavior

- Enabled through the optional Cultivation skin; Classic keeps its existing profile layout and customization.
- Appearance is selected by the person using the app and saved by account ID on this device. Demo storage is separate. An unselected profile displays a labeled male preview; no gender is inferred from identity or account details.
- Animation uses a small breathing transform. The pause control and the operating system’s reduced-motion setting can stop it.
- The eight cultivation realms use the existing rank thresholds: 0, 500, 2,000, 7,000, 20,000, 60,000, 175,000, and 450,000 XP. They change presentation only, never rewards or progression.
- Invalid global leaderboard positions are suppressed instead of displaying `undefinedth`.

## Validation

`pnpm --filter @workspace/writing-sprint typecheck` passes.
`git diff --check` passes.

| Before | After |
| --- | --- |
| Profile avatar and ranks were identical in every skin. | Cultivation uses the generated animated character, parchment surfaces, and cultivation realm names. |
| No character appearance choice. | Male and female choices are stored per account on this device, with an explicit storage error if persistence is unavailable. |
| A narrow profile card on wide displays. | Cultivation profile uses an 850px maximum width, with the portrait alongside XP progression on wide displays and a stacked view on smaller displays. |
| Invalid leaderboard position could produce `undefinedth`. | Only valid positive numeric positions render. |
| Profile controls used emoji icons. | Cultivation uses restrained library icons and the labels Spirit Pouch, Treasures, and Alchemy; Classic retains the original labels and icons. |
| Profile accent selection had no indication it belongs to the Classic skin. | Cultivation explicitly labels these settings as saved for the Classic skin. |
