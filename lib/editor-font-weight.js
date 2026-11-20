import { Mark } from "@tiptap/core";
import { readFontWeight } from "./font-weight.js";

export const FontWeight = Mark.create({
	name: "fontWeight",

	addAttributes() {
		return {
			weight: { default: null, rendered: false, parseHTML: (element) => readFontWeight(element.getAttribute("data-font-weight")) },
		};
	},

	parseHTML() {
		return [{ tag: "span[data-font-weight]", getAttrs: (element) => readFontWeight(element.getAttribute("data-font-weight")) ? {} : false }];
	},

	renderHTML({ mark }) {
		const weight = readFontWeight(mark.attrs.weight);
		return ["span", weight ? { "data-font-weight": weight } : {}, 0];
	},
});
