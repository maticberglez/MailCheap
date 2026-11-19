import { NodeSelection } from "@tiptap/pm/state";

export function duplicateBlock(state, pos) {
	const block = state.doc.nodeAt(pos);
	if (!block?.isBlock) return null;
	const $pos = state.doc.resolve(pos);
	const index = $pos.index();
	if (!$pos.parent.canReplaceWith(index + 1, index + 1, block.type, block.marks)) return null;
	const next = pos + block.nodeSize;
	const tr = state.tr.insert(next, block);
	return NodeSelection.isSelectable(block) ? tr.setSelection(NodeSelection.create(tr.doc, next)).scrollIntoView() : tr.scrollIntoView();
}
