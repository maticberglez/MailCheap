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
