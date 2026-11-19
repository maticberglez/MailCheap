import assert from "node:assert/strict";
import { test } from "node:test";
import { automationDraftKey, listAutomationDrafts, readAutomationDraft, saveAutomationEmail, saveAutomationList } from "../lib/automation-drafts.js";

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

test("the dedicated email editor updates only the selected email body", () => {
	const data = new Map();
	const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
	const scope = "welcome-flow:user:newsletter";
	const flow = { entryTag: "vip", nodes: [
		{ id: "email", type: "email", value: "Welcome", next: "sms" },
		{ id: "sms", type: "sms", value: "Hello" },
	] };
	storage.setItem(automationDraftKey(scope, "draft"), JSON.stringify(flow));
	assert.equal(saveAutomationEmail(storage, scope, "draft", "sms", "<p>Ignored</p>"), false);
	assert.equal(saveAutomationEmail(storage, scope, "draft", "email", "<p>Hello</p>", "2026-11-19T00:00:00.000Z"), true);
	assert.deepEqual(readAutomationDraft(storage, scope, "draft"), {
		...flow, nodes: [{ ...flow.nodes[0], html: "<p>Hello</p>" }, flow.nodes[1]], updatedAt: "2026-11-19T00:00:00.000Z",
	});
});
