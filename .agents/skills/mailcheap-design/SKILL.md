---
name: mailcheap-design
description: Apply MailCheap's visual and interaction conventions when creating, changing, or reviewing UI in the MailCheap repository, including the dashboard, campaign and automation editors, and email previews.
---

# MailCheap design

Use the closest existing MailCheap screen as the reference. Reuse its components, theme tokens, control sizes, spacing and Lucide icons. The shared primitives live in `components/ui/` and the theme tokens and email-editor mode styles are in `app/globals.css`.

## Dashboard

- Match the compact automation list for comparable campaign and overview rows. Keep the row icon, title, status and actions in the same order and use shared table, badge and skeleton components.
- Keep primary actions in the same header position across comparable flows. Campaigns and automation emails share patterns for metadata rows, editor mode switches and review actions. Use `RowCampaign`, `PanelEmailEditor` and the existing step navigation where they fit.
- Give icon-only controls an accessible label and use the existing hover, focus and selected states. Keep labels short and in sentence case.

## Email editor

- Keep blocks inside sections in the rich email editor. Put **Add section** directly after the last section with a small top margin. Stack section settings and trash in the right gutter, aligned with move and duplicate on the left. Keep editor-only controls outside the email content.
- Open section and block settings in a compact panel beside the selection, on the right when there is room. Keep all controls visible without an inner scrollbar. Apply changes as the user edits. Use alignment icons, styled switches with relevant icons, and `ControlEditorSize` for click, drag, scroll and keyboard sizing. Use the shade box and hex field for background colors.
- Keep the chosen light or dark mode across Edit and Review. Use the icon switch in `PanelEmailEditor`. While a section background picker is open, preview the mode for that background and restore the previous mode when it closes.
- Keep the editor and rendered email aligned on content spacing and block styling. Discount coupons use a fitted dashed border, scissors badge, independently editable code and label colors, separate horizontal and vertical padding, and a large rounded copy button beside the code, outside the dashed border. Use clipboard feedback on web surfaces and the copy page for email links.
- Countdown settings use the same live alignment, sizing and color controls. Use styled day and second switches, and hide time units with a zero value.
- Image and button link menus share `ButtonEditorLink` for the destination favicon and shortened URL.

## Check the result

For visual or interaction changes, check the affected UI in a local browser when available. Use sample content, test the narrow layout and both modes where relevant, and compare the editor with the actual rendering from `lib/render-email.js` for email-facing changes. Check that the controls remain usable and that changes persist through the editor's normal save flow.
