import assert from "node:assert/strict";
import { test } from "node:test";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Section } from "../components/BlockSection.jsx";
import { HtmlBlock } from "../components/BlockHtml.jsx";
import { ButtonBlock } from "../lib/editor-button.js";
import { Callout } from "../lib/editor-callout.js";
import { Column, Columns, reshapeSection } from "../lib/editor-columns.js";
import { ImageAligned } from "../lib/editor-image.js";
import { forEmail } from "../lib/sections.js";
import { renderEmail } from "../lib/render-email.js";

test("reducing section columns keeps every block in order, including an image link", () => {
	const schema = getSchema([StarterKit, Section, HtmlBlock, ImageAligned, ButtonBlock, Callout, Columns, Column]);
	const paragraph = (value) => schema.nodes.paragraph.create(null, schema.text(value));
	const image = schema.nodes.image.create({ src: "https://example.com/photo.png", link: "https://example.com/product" });
	const blocks = [paragraph("First"), image, paragraph("Last")];
	const section = schema.nodes.section.createChecked(null, blocks);
	const [three] = reshapeSection(section, 3, "1");
	assert.equal(three.attrs.mobile, "1");
	assert.ok(three.child(1).firstChild.eq(image));

	const [two] = reshapeSection(schema.nodes.section.createChecked(null, three), 2, "1");
	assert.equal(two.lastChild.childCount, 2);
	assert.ok(two.lastChild.firstChild.eq(image));
	assert.ok(two.lastChild.lastChild.eq(blocks[2]));
	const single = reshapeSection(schema.nodes.section.createChecked(null, two), 1);
	assert.deepEqual(single.map((node) => node.toJSON()), blocks.map((node) => node.toJSON()));
});

test("rich emails render section backgrounds, opted-in mobile stacking, and bounded button styling", () => {
	const html = '<section data-section="" data-light-bg="#eff2ff" data-dark-bg="#102030">' +
		'<table data-mobile-columns="1" data-columns=""><tbody><tr><td data-column=""><p>One</p></td><td data-column=""><p>Two</p></td></tr></tbody></table>' +
		'<div data-button="" data-button-radius="0" data-button-width="220" data-button-height="52"><a href="https://example.com">Read more</a></div>' +
		'</section><section data-section="" data-show="tag:vip" data-where="email"><p>VIP only</p></section>';
	const rendered = renderEmail({ format: "rich", html: forEmail(html) }).html;
	assert.match(rendered, /class="section-bg-102030" style="background-color:#eff2ff;"/);
	assert.match(rendered, /email-stack-columns > tbody > tr > td/);
	assert.match(rendered, /class="email-stack-columns" role="presentation"/);
	assert.match(rendered, /width="220" style="width:220px;max-width:100%/);
	assert.match(rendered, /padding:16px 8px;border-radius:0px/);
	assert.doesNotMatch(rendered, /VIP only/);

	const invalid = renderEmail({ format: "rich", html: '<div data-button="" data-button-width="999" data-button-height="1"><a href="https://example.com">Read more</a></div>' }).html;
	assert.doesNotMatch(invalid, /width:999px|padding:-/);
	assert.match(invalid, /display:inline-block;padding:12px 24px/);
	assert.doesNotMatch(invalid, /email-stack-columns/);
});

test("section radius survives the editor, web sanitizer and email rendering", async () => {
	const { renderIssueBody } = await import("../lib/archive-content.js");
	const schema = getSchema([StarterKit, Section, HtmlBlock, ImageAligned, ButtonBlock, Callout, Columns, Column]);
	for (const radius of [0, 24, 101, "9; color:red"]) {
		const node = schema.nodes.section.createChecked({ radius, light: "#abcdef", dark: "#123456" }, schema.nodes.paragraph.create());
		const [, attributes] = schema.nodes.section.spec.toDOM(node);
		const valid = radius === 0 || radius === 24;
		assert.equal(attributes["data-section-radius"], valid ? radius : null);
		const source = `<section data-section="" data-light-bg="#abcdef" data-dark-bg="#123456" data-section-radius="${radius}"><p>Content</p></section>`;
		const web = renderIssueBody({ format: "rich", html: source }).html;
		const email = renderEmail({ format: "rich", html: forEmail(source) }).html;
		assert.equal(web.includes(` data-section-radius="${radius}"`), valid);
		assert.equal(email.includes(`background-color:#abcdef;border-radius:${radius}px;overflow:hidden;`), valid);
		assert.match(email, /class="section-bg-123456"/);
	}
});
