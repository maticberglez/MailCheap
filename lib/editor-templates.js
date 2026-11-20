import { listSections } from "./sections.js";

const MAX_TEMPLATES = 30;

export function readEditorTemplates(storage, scope) {
	const saved = JSON.parse(storage.getItem(`mailcheap:templates:${scope}`) || "[]");
	return Array.isArray(saved) ? saved : [];
}

export function saveEditorTemplate(storage, scope, template) {
	const templates = readEditorTemplates(storage, scope);
	if (templates.length >= MAX_TEMPLATES) return false;
	storage.setItem(`mailcheap:templates:${scope}`, JSON.stringify([...templates, template]));
	return true;
}

export function removeEditorTemplate(storage, scope, id) {
	const templates = readEditorTemplates(storage, scope).filter((template) => template.id !== id);
	storage.setItem(`mailcheap:templates:${scope}`, JSON.stringify(templates));
}

export function canUseEditorTemplate(template, { withSections, withAudience }) {
	const sections = listSections(template.html);
	return sections.length === 0 || (withSections && (withAudience || sections.every((rule) => rule && !rule.group && rule.place !== "web")));
}
