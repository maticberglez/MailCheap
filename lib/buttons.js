import { readFontWeight } from "./font-weight.js";
import { isActionLink } from "./action-links.js";

// Buttons in issues: a link drawn as a button in the newsletter's button colors and corners (lib/themes.js), on the left,
// in the center or on the right of the column. An issue keeps each one as <div data-button=""><a href="…">Text</a></div>,
// with data-align="left" or "right" unless it's centered, so what only reads links, like click tracking, the click
// report and the plain-text email, gets a link. Emails (lib/render-email.js) and the website (app/globals.css) draw it,
// and what a button can be set to later goes on its <div> the same way.
export const BUTTON_ALIGNMENTS = ["left", "center", "right"];
export const BUTTON_DEFAULT_RADIUS = 999;
export const BUTTON_MARKER = ' data-button=""';
export const BUTTON_PROBLEM = "Add text and a link to each button";
// A button's <div> as the issue's cleaner writes it (lib/clean-html.js), its tag name in group 1 and its place in group 2.
export const BUTTON_START_PATTERN = /<(div) data-button=""(?: data-align="(left|center|right)")?(?: data-button-radius="(\d+)")?(?: data-button-width="(\d+)")?(?: data-button-height="(\d+)")?(?: data-button-weight="(\d+)")?>/gi;

const BUTTON_LINK_PATTERN = /^\s*<a\b([^>]*)>([\s\S]*)<\/a>\s*$/i;
const BUTTON_HREF_PATTERN = /\shref="([^"]*)"/i;
const BUTTON_LINK_SCHEME = /^(?:https?:|mailto:)/i;
// Outlook on Windows leaves a link's padding out: it pads the cell under the link instead, in the button's color.
const PADDING = "12px 24px";
// The cell an email's button is drawn in, which mail apps in dark mode repaint in the theme's dark colors.
export const EMAIL_BUTTON_CLASS = "email-button";

export function readButtonAlign(value) {
	return value === "left" || value === "right" ? value : "center";
}

// What a button can open: a web address, an email address as a mailto: link, or the link MailCheap fills in for each
// reader of the confirmation and last-chance emails (lib/action-links.js).
export function isButtonLink(href) {
	return BUTTON_LINK_SCHEME.test(String(href ?? "")) || isActionLink(href);
}

// A button's <div> attributes as the cleaner keeps them: the marker, and its place unless it's centered.
export const BUTTON_DIMENSIONS = {
	radius: { label: "Corner radius", min: 0, max: 100 },
	width: { label: "Width", min: 48, max: 600 },
	height: { label: "Height", min: 24, max: 120 },
};

export function readButtonDimension(key, value) {
	if (!/^\d{1,3}$/.test(value ?? "")) return null;
	const number = Number(value);
	const { min, max } = BUTTON_DIMENSIONS[key];
	return number >= min && number <= max ? number : null;
}

export function getButtonAttributes(align, sizes = {}) {
	const place = readButtonAlign(align);
	const attributes = place === "center" ? BUTTON_MARKER : `${BUTTON_MARKER} data-align="${place}"`;
	const weight = readFontWeight(sizes.weight);
	return attributes + Object.keys(BUTTON_DIMENSIONS).map((key) => {
		const value = readButtonDimension(key, sizes[key]);
		return value === null ? "" : ` data-button-${key}="${value}"`;
	}).join("") + (weight ? ` data-button-weight="${weight}"` : "");
}

// What's in a button's <div>, when it's one link: its address, a web or email one or none, and its text as HTML. null
// for anything else.
export function readButton(content) {
	const match = BUTTON_LINK_PATTERN.exec(content);
	if (!match || /<\/?a\b/i.test(match[2])) return null;
	const href = BUTTON_HREF_PATTERN.exec(match[1])?.[1];
	return { href: isButtonLink(href) ? href : null, label: match[2] };
}

// A button in an email: tables, which every app lays out, the outer one placing it in the column. Its colors and corners
// are the email theme's (getEmailTheme), its letters the body's font.
export function getEmailButtonHtml({ href, label, align, ...sizes }, theme) {
	const radius = `border-radius:${readButtonDimension("radius", sizes.radius) ?? BUTTON_DEFAULT_RADIUS}px;`;
	const width = readButtonDimension("width", sizes.width);
	const height = readButtonDimension("height", sizes.height);
	const padding = height === null && width === null ? PADDING : `${height === null ? 12 : (height - 20) / 2}px ${width === null ? 24 : 8}px`;
	const tableWidth = width === null ? "" : ` width="${width}" style="width:${width}px;max-width:100%;"`;
	const linkWidth = width === null ? "" : "width:100%;box-sizing:border-box;";
	const link = href ? ` href="${href}"` : "";
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td align="${align}"><table role="presentation" align="${align}" cellpadding="0" cellspacing="0" border="0"${tableWidth}><tr><td class="${EMAIL_BUTTON_CLASS}" align="center" bgcolor="${theme.button}" style="${radius}background:${theme.button};mso-padding-alt:${padding};"><a${link} style="display:inline-block;${linkWidth}padding:${padding};${radius}background:${theme.button};color:${theme.buttonText};font-family:${theme.fonts.body};font-size:16px;font-weight:${readFontWeight(sizes.weight) ?? 600};line-height:20px;text-decoration:none;">${label}</a></td></tr></table></td></tr></table>`;
}
