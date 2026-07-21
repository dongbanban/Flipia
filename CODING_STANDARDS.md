# Coding Standards

## Remove badge

When an element needs a remove / delete badge, use the shared `.remove-badge` class from `miniprogram/styles/badge.wxss` (imported globally via `app.wxss`).

**Shared visual style (`.remove-badge`):** white circular badge, primary-color icon and ring, subtle drop shadow. The icon character is `×` (U+00D7).

```css
/* miniprogram/styles/badge.wxss */
.remove-badge {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #fff;
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 2rpx var(--color-primary),
    0 1rpx 4rpx rgba(0, 0, 0, 0.1);
  line-height: 1;
}
```

**Positioning** is *not* part of the shared class — each usage decides its own position by adding a second class:

| Usage | Class | Position |
|---|---|---|
| Image upload remove | `.image-remove` | `absolute; top: -16rpx; right: -14rpx` (overlaps parent corner) |
| Tag remove | `.tag-delete` | `margin-left: 12rpx; flex-shrink: 0` (inline, inside parent flow) |

In WXML, compose with `class="remove-badge image-remove"` or `class="remove-badge tag-delete"`.

**References:** `miniprogram/styles/badge.wxss`, `miniprogram/pages/dish-pool/index.wxss`, `miniprogram/pages/category-manage/index.wxss`.

## Theme color

All UI components that accept a color (confirm buttons, highlights, accents, etc.) must use the system theme color:

- **CSS:** `var(--color-primary)` (defined as `#c8815e` in `miniprogram/styles/variables.wxss`)
- **JS (e.g. `wx.showModal` `confirmColor`):** `"#c8815e"`

Never hardcode red (`#ff4d4f`) for confirm/destructive actions unless the action is genuinely irreversible (e.g. permanent data deletion with no undo). Even then, prefer a secondary confirmation step over a red button.

## Page layout

All `.page` containers MUST use absolute positioning instead of `100vh`. See [ADR-0003](docs/adr/0003-page-layout-no-100vh.md).

| Page type | CSS |
|---|---|
| With `group-switcher` (tab pages) | `position: absolute; top: 88rpx; left: 0; right: 0; bottom: 0; overflow-y: auto;` |
| Without `group-switcher` | `position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto;` |

Never use `100vh`, `min-height: 100vh`, or `height: 100vh` in any `.wxss` file.
