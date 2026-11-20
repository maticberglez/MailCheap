import { Node } from "@tiptap/core";

export const Columns = Node.create({
	name: "columns",
	group: "block",
	content: "column{2,4}",
	isolating: true,
	addAttributes() {
		return {
			mobile: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-mobile-columns") === "1" ? "1" : null,
				renderHTML: ({ mobile }) => mobile === "1" ? { "data-mobile-columns": "1" } : {},
			},
		};
	},
	parseHTML() {
		return [{ tag: "table[data-columns]", contentElement: "tr" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["table", { "data-columns": "", ...HTMLAttributes }, ["tbody", ["tr", 0]]];
	},
});

export const Column = Node.create({
	name: "column",
	content: "block+",
	isolating: true,
	parseHTML() {
		return [{ tag: "td[data-column]" }];
	},
	renderHTML() {
		return ["td", { "data-column": "" }, 0];
	},
});

// Change the layout without dropping a block. When columns are removed, their contents join the last remaining column.
export function reshapeSection(node, count, mobile = null) {
	const { columns, column, paragraph } = node.type.schema.nodes;
	const groups = [];
	node.forEach((block) => {
		if (block.type === columns) block.forEach((cell) => {
			const content = [];
			cell.forEach((child) => content.push(child));
			groups.push(content);
		});
		else groups.push([block]);
	});
	if (count === 1) return groups.flat();
	const cells = Array.from({ length: count }, () => []);
	groups.forEach((group, index) => cells[Math.min(index, count - 1)].push(...group));
	return [columns.createChecked({ mobile }, cells.map((content) => column.createChecked(null, content.length ? content : [paragraph.create()])))];
}
