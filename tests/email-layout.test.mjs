import assert from "node:assert/strict";
import { test } from "node:test";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Section } from "../components/BlockSection.jsx";
import { CountdownBlock, DiscountBlock } from "../components/BlockOffer.jsx";
import { HtmlBlock } from "../components/BlockHtml.jsx";
import { ButtonBlock } from "../lib/editor-button.js";
import { Callout } from "../lib/editor-callout.js";
import { Column, Columns, reshapeSection } from "../lib/editor-columns.js";
import { ImageAligned } from "../lib/editor-image.js";
import { forEmail } from "../lib/sections.js";
import { renderEmail } from "../lib/render-email.js";

test("reducing section columns keeps every block in order, including an image link", () => {
	const schema = getSchema([StarterKit, Section, HtmlBlock, ImageAligned, ButtonBlock, Callout, Columns, Column, CountdownBlock, DiscountBlock]);
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
	const schema = getSchema([StarterKit, Section, HtmlBlock, ImageAligned, ButtonBlock, Callout, Columns, Column, CountdownBlock, DiscountBlock]);
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

test("rich email documents wrap older loose blocks and keep existing section rules", async () => {
	const { DOMParser } = await import("@tiptap/pm/model");
	const { EmailDocument, EmailSection, insertEmailSection } = await import("../components/BlockSection.jsx");
	const { EditorState, TextSelection } = await import("@tiptap/pm/state");
	const schema = getSchema([
		StarterKit.configure({ document: false }), EmailDocument, EmailSection, HtmlBlock, ButtonBlock,
		Callout, ImageAligned, Columns, Column, CountdownBlock, DiscountBlock,
	]);

	function element(name, attributes, ...children) {
		const node = {
			nodeType: 1, nodeName: name.toUpperCase(), firstChild: children[0], childNodes: children,
			getAttribute: (attribute) => attributes[attribute] ?? null,
			matches(selector) {
				const [tag, attribute] = selector.split("[");
				return tag === name && (!attribute || Object.hasOwn(attributes, attribute.slice(0, -1)));
			},
		};
		children.forEach((child, index) => {
			child.parentNode = node;
			child.nextSibling = children[index + 1];
		});
		return node;
	}
	const paragraph = (text) => element("p", {}, { nodeType: 3, nodeValue: text });
	const doc = DOMParser.fromSchema(schema).parse(element("div", {},
		paragraph("First"), paragraph("Second"),
		element("section", { "data-section": "", "data-show": "tag:vip", "data-where": "email" }, paragraph("VIP")),
		paragraph("Last"),
	));
	assert.deepEqual(doc.content.content.map((section) => section.textContent), ["FirstSecond", "VIP", "Last"]);
	assert.ok(doc.content.content.every((section) => section.type.name === "section"));
	assert.equal(doc.child(1).attrs.show, "tag:vip");
	assert.equal(doc.child(1).attrs.where, "email");
	assert.equal(schema.topNodeType.createAndFill().toString(), "doc(section(paragraph))");

	const state = EditorState.create({ doc, selection: TextSelection.create(doc, 2) });
	const tr = state.tr;
	insertEmailSection({ command: (apply) => apply({ state, tr }) });
	assert.deepEqual(tr.doc.content.content.map((section) => section.textContent), ["FirstSecond", "", "VIP", "Last"]);
	assert.equal(tr.selection.$from.parent.type.name, "paragraph");
	tr.doc.check();
});

test("a section renders its layout settings trigger", async () => {
	const { createElement } = await import("react");
	const { renderToStaticMarkup } = await import("react-dom/server");
	const { default: BlockSection } = await import("../components/BlockSection.jsx");
	const html = renderToStaticMarkup(createElement(BlockSection, { node: { attrs: {} } }));
	assert.match(html, /data-section-header/);
	assert.match(html, /Section/);
});

test("countdown and static discount blocks render from section content", async () => {
	const { countdownText, readCountdownDeadline } = await import("../lib/countdown.js");
	const deadline = Date.UTC(2030, 0, 1);
	assert.equal(countdownText(deadline, deadline - (25 * 60 + 3) * 60_000), "1d  1h  3m");
	assert.equal(countdownText(deadline, deadline), "Offer ended");
	assert.equal(countdownText(deadline, deadline - 86_405_000, { showDays: false, showSeconds: true }), "24h  5s");
	assert.equal(countdownText(deadline, deadline - 60_000, { showSeconds: true }), "1m");
	assert.equal(countdownText(deadline, deadline - 5000), "<1m");
	assert.equal(readCountdownDeadline(`${deadline}<svg>`), null);
	const html = forEmail(`<section data-section=""><div data-countdown="${deadline}" data-countdown-days="0" data-countdown-seconds="1" data-offer-size="32"><span>Deadline</span></div><div data-discount="" data-offer-align="right" data-offer-color="#AC12FF" data-offer-size="40"><strong>SAVE&amp;20</strong><br><span>Summer sale</span></div></section>`);
	const sent = renderEmail({ format: "rich", html, fontBaseUrl: "https://example.com" });
	assert.match(sent.html, new RegExp(`src="https://example.com/api/countdown/${deadline}\\?days=0&amp;seconds=1&amp;size=32"`));
	assert.match(sent.html, /Ends Jan 1, 2030/);
	assert.match(sent.text, /SAVE&20/);
	assert.match(sent.html, /text-align:right;[^"]*border:1px dashed/);
	assert.match(sent.html, /color:#ac12ff;font-size:40px;/);
	assert.match(sent.html, /href="https:\/\/example.com\/copy-discount#SAVE%2620"/);
	assert.match(sent.text, /Summer sale/);
	assert.doesNotMatch(sent.html, /data-discount|data-countdown/);
});

test("offer styling rejects invalid alignment, size and color before drawing email", () => {
	const html = '<div data-discount="" data-offer-align="justify" data-offer-size="99" data-offer-color="red"><strong>CODE</strong><br><span></span></div>';
	const sent = renderEmail({ format: "rich", html });
	assert.match(sent.html, /text-align:center;[^"]*border:1px dashed/);
	assert.match(sent.html, /<strong style="">CODE<\/strong>/);
	assert.doesNotMatch(sent.html, /data-offer-|font-size:99px|color:red/);
});
