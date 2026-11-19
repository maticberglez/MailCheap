import Image from "@tiptap/extension-image";

// A picture placed left, center or right of the column (lib/clean-html.js IMAGE_ALIGNMENTS). Centered ones carry no
// attribute, so issues written before alignment keep their markup.
export const ImageAligned = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			link: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-image-link"),
				renderHTML: ({ link }) => (link ? { "data-image-link": link } : {}),
			},
			radius: imagePixels("radius"),
			spacing: imagePixels("spacing"),
			align: {
				default: "center",
				parseHTML: (element) => readAlign(element.getAttribute("data-align")),
				renderHTML: ({ align }) => (align === "center" ? {} : { "data-align": align }),
			},
		};
	},
});

function readAlign(value) {
	return value === "left" || value === "right" ? value : "center";
}

// Tiptap keeps resize dimensions in inline styles, so these attributes must leave style alone.
function imagePixels(name) {
	const attribute = `data-image-${name}`;
	return {
		default: null,
		parseHTML: (element) => element.getAttribute(attribute),
		renderHTML: (attrs) => /^[0-9]{1,3}$/.test(attrs[name] ?? "")
			? { [attribute]: attrs[name] }
			: {},
	};
}
