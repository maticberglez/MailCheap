import assert from "node:assert/strict";
import { test } from "node:test";
import { automationDraftKey, listAutomationDrafts, readAutomationDraft, saveAutomationList } from "../lib/automation-drafts.js";

test("the original welcome draft appears beside new drafts and each has separate storage", () => {
	const data = new Map();
	const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
	const scope = "welcome-flow:user:newsletter";
	const original = { nodes: [{ id: "original" }] };
	const added = { nodes: [{ id: "added" }] };
	assert.deepEqual(listAutomationDrafts(storage, scope), []);
	storage.setItem(scope, JSON.stringify(original));

	const legacy = listAutomationDrafts(storage, scope);
	assert.deepEqual(legacy, [{ id: "welcome", name: "Welcome flow" }]);
	saveAutomationList(storage, scope, [{ id: "second", name: "Second flow" }, ...legacy]);
	storage.setItem(automationDraftKey(scope, "second"), JSON.stringify(added));
	assert.deepEqual(readAutomationDraft(storage, scope, "second"), added);
	assert.deepEqual(readAutomationDraft(storage, scope, "welcome"), original);
	assert.deepEqual(listAutomationDrafts(storage, scope).map(({ id }) => id), ["second", "welcome"]);
	assert.deepEqual(listAutomationDrafts(storage, "welcome-flow:user:other"), []);

	saveAutomationList(storage, scope, []);
	assert.deepEqual(listAutomationDrafts(storage, scope), [], "deleting the legacy entry does not resurrect it");
});
