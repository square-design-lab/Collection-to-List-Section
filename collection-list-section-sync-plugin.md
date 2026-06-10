# Collection → List Section Sync Plugin
### Squarespace Plugin Documentation

Sync any Squarespace collection (Store, Blog, Events) into a List Section — live, no manual updates needed. The List Section becomes a display shell; this plugin fetches real collection data and maps it in at runtime.

---

## How It Works

The plugin scans every page section that contains a `.list-section-title` element. If the title text includes a `{sync=...}` tag pointing to a collection URL, the plugin fetches that collection's data via Squarespace's JSON API and maps it onto the List Section's existing `<li>` elements — replacing titles, images, descriptions, and buttons with live collection content.

If the title text contains no `{sync=...}` tag, the section is flagged as `data-list-section-sync="false"` and left untouched.

---

## File Structure

```
plugin/
├── plugin.js      # Core plugin logic
└── plugin.css     # Visibility, animation, and layout styles
```

---

## Installation

1. Add `plugin.css` to your Squarespace site's Custom CSS (or inject via Code Block).
2. Add `plugin.js` to your site footer via **Settings → Advanced → Code Injection** or a Code Block with a `<script>` tag.
3. In any List Section's title field, add the sync tag (see Usage below).

---

## Usage

### Setting Up a Synced Section

In the **List Section title field**, append a sync tag using the following syntax:

```
{sync=/collection-url-path}
```

**Examples:**

| Intent | Title Field Value |
|---|---|
| Sync a store | `Featured Products {sync=/shop}` |
| Sync a blog | `Latest Posts {sync=/blog}` |
| Sync events (upcoming) | `Upcoming Events {sync=/events}` |
| Sync events (past) | `Past Events {sync=/events?events=past}` |
| Sync all events | `All Events {sync=/events?events=both}` |
| Sync featured/starred items only | `Staff Picks {sync=/shop?featured}` |
| Title hidden (sync only) | `{sync=/shop}` |

> The `{sync=...}` tag is automatically stripped from the visible title after initialization. If the remaining text is empty, the title element is hidden entirely.

---

## Features

### 1. Live Collection Data Fetching

The plugin fetches collection data from Squarespace's `?format=json` endpoint at runtime. It supports:

- **Store collections** — products with pricing, sale states, and variants
- **Blog collections** — posts with titles, excerpts, and thumbnails
- **Event collections** — events with start/end dates and date tags

Pagination is handled automatically. If the collection has more items than the List Section has `<li>` slots, the plugin fetches additional pages until it has enough items to fill all slots (up to the number of list items present in the section).

---

### 2. Featured / Starred Item Filtering

Append `?featured` to the collection URL to restrict output to items marked as starred/featured in Squarespace:

```
{sync=/shop?featured}
```

Items where `starred !== true` are excluded before mapping begins.

---

### 3. Event Type Filtering

For event collections, control which events are displayed using the `?events=` parameter:

| Parameter | Result |
|---|---|
| *(none)* | Upcoming events only (default) |
| `?events=past` | Past events only |
| `?events=both` | All events (upcoming + past) |

```
{sync=/events?events=past}
```

---

### 4. Image Mapping & Sync Marking

Each collection item's `assetUrl` is applied to the corresponding `<img>` element. The plugin:

- Appends `?isSyncedImage=true` to each image URL for CSS targeting
- Clones the original `<img>` node, applies the new `src`, `data-src`, and `data-image` attributes, and clears the `srcset`
- Hides the original image element (`display: none`) to prevent flicker during load
- Reveals synced images only after `data-list-section-sync="initialized"` is set on the section

This prevents unstyled/original images from flashing before the plugin maps in the real data.

---

### 5. Title Mapping with Optional Link

Titles are written into `.list-item-content__title`. The `titleLink` setting controls whether the title text is wrapped in an anchor tag:

```js
titleLink: true  // <a href="...">Title</a>
titleLink: false // <span>Title</span>
```

---

### 6. Product Pricing Display

For store items, pricing is automatically appended to the title element. The plugin reads the first variant's pricing data and handles both regular and on-sale states:

**Regular price:**
```html
<a href="/product">Product Name</a> <span class="price">$49</span>
```

**On sale:**
```html
<a href="/product">Product Name</a>
<span>
  <span class="price">$29</span>
  <span class="price" style="text-decoration: line-through; margin-left: 5px;">$49</span>
</span>
```

Currency symbols are resolved from a built-in map covering 21 currencies (USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, SEK, NZD, MXN, SGD, HKD, NOK, KRW, TRY, RUB, INR, BRL, ZAR, PLN).

---

### 7. Excerpt / Description Mapping

If a `.list-item-content__description` element exists in the list item, it is populated with the collection item's `excerpt` field (HTML-safe).

---

### 8. Button Link Mapping

If a button element (`a.list-item-content__button`) exists, its `href` is updated to point to the collection item's URL. The button's inner HTML is preserved from the first list item template.

For items where `passthrough: true` (external link products), `sourceUrl` is used instead of `fullUrl`.

---

### 9. Image Link Overlay

When `imageLink: true` is set in the plugin settings, a full-size anchor element is overlaid on the image container:

```html
<a href="/collection-item-url" class="image-link"></a>
```

Positioned absolutely to cover the full image area (see CSS). This creates a clickable image without altering the image element itself.

---

### 10. Event Date Tags

For items where `recordTypeLabel === 'event'`, a date tag block is injected into the image container:

```html
<div class="eventlist-datetag">
  <div class="eventlist-datetag-inner">
    <div class="eventlist-datetag-startdate eventlist-datetag-startdate--month">Jun</div>
    <div class="eventlist-datetag-startdate eventlist-datetag-startdate--day">10</div>
    <div class="eventlist-datetag-enddate">to Jun 12</div>
    <div class="eventlist-datetag-status"></div>
  </div>
</div>
```

Dates are formatted using `toLocaleDateString('en-US', { month: 'short' })`.

---

### 11. List Item Trimming

If the List Section contains more `<li>` elements than the collection has items, excess list items are removed from the DOM automatically. This prevents empty/ghost items from rendering.

---

### 12. Template Normalization

Before mapping data, all `<li>` elements are set to match the first item's inner HTML. This ensures consistent markup across all list items regardless of what was manually entered in the Squarespace editor.

---

### 13. Carousel Controller Removal

If the List Section uses Squarespace's `UserItemsListCarousel` controller, the plugin detects this and removes the `data-controller` attribute after the carousel binds — preventing Squarespace's carousel from conflicting with the synced layout. A `MutationObserver` handles cases where the controller binding happens asynchronously.

---

### 14. Animation Reset (CSS)

Squarespace's built-in list section animations (fade, scale, slide, clip, flex) can conflict with the plugin's rendering. The CSS resets all animation pre-states once `data-list-section-sync="initialized"` is applied:

| Animation Class | Reset Applied |
|---|---|
| `.preFade` | `opacity: 1` |
| `.preScale` | `opacity: 1; transform: scale(1)` |
| `.preSlide` | `opacity: 1; transform: initial` |
| `.preClip` | `opacity: 1; transform: translateZ(0); clip-path: initial` |
| `.preFlex` | `opacity: 1; transform: initial; clip-path: initial` |
| `.animation-segment-parent-hidden` | `opacity: 1` |

---

### 15. Visibility State Management

The plugin uses a `data-list-section-sync` attribute on the section element to control CSS-driven visibility during loading:

| State | Meaning |
|---|---|
| `loading` | Plugin has started, hide images + title |
| `initialized` | Data mapped successfully, reveal everything |
| `false` | No sync tag found, render section normally |

This prevents layout shifts and image flashes during the fetch-and-map cycle. In Squarespace edit mode (`body.sqs-edit-mode-active`), all elements remain visible regardless of state so editors can work normally.

---

### 16. Edit Mode Compatibility

CSS rules are scoped with `body:not(.sqs-edit-mode-active)` so that:

- Images are always visible in the editor
- The section title (including the `{sync=...}` tag) is always visible in the editor
- Sync-state hiding never applies while editing

Error messages (`.sdl-error`) inside the title element are hidden on the frontend but visible in edit mode for debugging.

---

### 17. Multi-Section Support

The plugin scans all `.list-section-title` elements on page load and instantiates a `SummaryListSections` instance for each qualifying section independently. Multiple synced sections on the same page are fully supported.

---

### 18. Cache Busting

Every fetch request appends a `date` parameter (current timestamp in milliseconds) to prevent stale JSON responses from being served from the browser cache:

```
/shop?format=json&date=1718032845123
```

---

## JavaScript Settings Reference

Settings are passed when instantiating `SummaryListSections`. Currently configured via the IIFE at the bottom of `plugin.js`:

```js
const settings = {
  section: section,      // The page section DOM element (required, set automatically)
  imageLink: false,      // Wrap image in anchor tag linking to collection item
  titleLink: true        // Wrap title text in anchor tag linking to collection item
};
```

To change defaults site-wide, edit the `settings` object in the IIFE block at the bottom of `plugin.js`.

---

## Public API

The plugin exposes a global reinitializer for use with dynamic page loads or AJAX navigation:

```js
window.sdlListSectionSync.init();
```

Call this if new sections are injected into the DOM after initial page load. The init function skips any section that already has a `data-list-section-sync` attribute set, so it is safe to call multiple times.

---

## CSS Classes Reference

| Class / Selector | Purpose |
|---|---|
| `.list-section-title` | Trigger element; contains the `{sync=...}` tag |
| `.sdl-error` | Error message inside title; edit-mode only |
| `.image-link` | Full-coverage anchor overlay on image container |
| `.eventlist-datetag` | Date tag injected for event items |
| `.eventlist-datetag-inner` | Inner wrapper for date tag content |
| `.eventlist-datetag-startdate--month` | Month label |
| `.eventlist-datetag-startdate--day` | Day number |
| `.eventlist-datetag-enddate` | End date display |
| `.price` | Applied to price `<span>` elements in store titles |

---

## Data Attribute Reference

| Attribute | Element | Values | Meaning |
|---|---|---|---|
| `data-list-section-sync` | `.page-section` | `loading`, `initialized`, `false` | Sync lifecycle state |
| `data-current-context` | `.user-items-list-item-container` | JSON string | Squarespace section context (read by plugin) |
| `isSyncedImage=true` | `img` URL param | — | Marks images mapped by plugin (for CSS targeting) |

---

## Error Handling

- If the collection URL returns a non-OK HTTP response, the error is logged to the console and the section remains in `loading` state (hidden on frontend).
- If the collection JSON contains no `items`, `upcoming`, or `past` array, an error is thrown and logged.
- Console warnings are emitted when the List Section has more items than the collection can fill.

---

## Known Constraints

- The number of items displayed is capped by the number of `<li>` elements manually added to the List Section in the editor. Add more list items in the editor to display more collection items.
- The plugin reads only the **first variant** for product pricing. Multi-variant price ranges are not currently supported.
- `addLoadEventListeners()` calls `mapCollectionDataToListItems()` again on `DOMContentLoaded` and `load` events. This means mapping runs up to three times per page load (init + two event listeners). This is safe due to template normalization but worth noting for performance on large sections.
