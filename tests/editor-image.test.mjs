import assert from "node:assert/strict";
import { test } from "node:test";
import { getSchema, getRenderedAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ImageAligned } from "../lib/editor-image.js";
import { getAttributesFromExtensions } from "@tiptap/core";

test("image appearance keeps the node view's inline resize styles untouched", () => {
	const extensions = [StarterKit, ImageAligned];
	const schema = getSchema(extensions);
	const node = schema.nodes.image.create({ src: "https://example.com/image.png", width: 240, height: 120, radius: "6", spacing: "12" });
	const attrs = getRenderedAttributes(node, getAttributesFromExtensions(extensions));
	assert.equal(attrs.width, 240);
	assert.equal(attrs.height, 120);
	assert.equal(attrs["data-image-radius"], "6");
	assert.equal(attrs["data-image-spacing"], "12");
	assert.equal(attrs.style, undefined);
});

test("duplicating a nested image inserts a copy in the same column", async () => {
	const { EditorState } = await import("@tiptap/pm/state");
	const { duplicateBlock } = await import("../lib/editor-duplicate-block.js");
	const { Column, Columns } = await import("../lib/editor-columns.js");
	const schema = getSchema([StarterKit, ImageAligned, Columns, Column]);
	const image = schema.nodes.image.create({ src: "https://example.com/photo.png", width: 240, link: "https://example.com/item" });
	const column = schema.nodes.column.create(null, image);
	const doc = schema.nodes.doc.create(null, schema.nodes.columns.create(null, [column, column]));
	const tr = duplicateBlock(EditorState.create({ doc }), 2);
	assert.equal(tr.doc.firstChild.firstChild.childCount, 2);
	assert.ok(tr.doc.firstChild.firstChild.lastChild.eq(image));
	assert.equal(tr.doc.firstChild.lastChild.childCount, 1);
});

test("duplicating a section preserves its linked image and templates preserve the rendered link", async () => {
	const { Section } = await import("../components/BlockSection.jsx");
	const { EditorState } = await import("@tiptap/pm/state");
	const { duplicateBlock } = await import("../lib/editor-duplicate-block.js");
	const { Column, Columns } = await import("../lib/editor-columns.js");
	const { Callout } = await import("../lib/editor-callout.js");
	const { ButtonBlock } = await import("../lib/editor-button.js");
	const { HtmlBlock } = await import("../components/BlockHtml.jsx");
	const { readEditorTemplates, saveEditorTemplate } = await import("../lib/editor-templates.js");
	const { renderEmail } = await import("../lib/render-email.js");
	const { withEmailSections } = await import("../lib/sections.js");
	const schema = getSchema([StarterKit, ImageAligned, Section, Columns, Column, Callout, ButtonBlock, HtmlBlock]);
	const image = schema.nodes.image.create({ src: "https://example.com/photo.png", link: "https://example.com/item" });
	const section = schema.nodes.section.create(null, image);
	const state = EditorState.create({ doc: schema.nodes.doc.create(null, section) });
	assert.equal(duplicateBlock(state, 0).doc.lastChild.firstChild.attrs.link, "https://example.com/item");

	const values = new Map();
	const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
	const html = '<section data-section=""><img src="https://example.com/photo.png" data-image-link="https://example.com/item"></section>';
	assert.equal(saveEditorTemplate(storage, "user:newsletter", { id: "template", kind: "section", html }), true);
	assert.deepEqual(readEditorTemplates(storage, "other:newsletter"), []);
	const [saved] = readEditorTemplates(storage, "user:newsletter");
	assert.match(renderEmail({ format: "rich", html: withEmailSections(saved.html) }).html, /href="https:\/\/example\.com\/item"[^>]*>\s*<img/);
});
