export const EMPTY_AUTOMATION = { nodes: [], entryTag: "", exitTag: "" };

export function automationDraftKey(scope, id) {
	return id === "welcome" ? scope : `${scope}:draft:${id}`;
}

export function listAutomationDrafts(storage, scope) {
	const index = storage.getItem(`${scope}:index`);
	if (index !== null) return JSON.parse(index);
	return storage.getItem(scope) === null ? [] : [{ id: "welcome", name: "Welcome flow" }];
}

export function saveAutomationList(storage, scope, drafts) {
	storage.setItem(`${scope}:index`, JSON.stringify(drafts));
}

export function readAutomationDraft(storage, scope, id) {
	const key = automationDraftKey(scope, id);
	const saved = storage.getItem(key);
	return saved === null ? EMPTY_AUTOMATION : JSON.parse(saved);
}
