import { Node } from "@tiptap/core";

export const Columns = Node.create({
	name: "columns",
	group: "block",
	content: "column{2,4}",
	isolating: true,
	parseHTML() {
		return [{ tag: "table[data-columns]", contentElement: "tr" }];
	},
	renderHTML() {
		return ["table", { "data-columns": "" }, ["tbody", ["tr", 0]]];
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
