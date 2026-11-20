"use client";

import { useState } from "react";
import { DOMSerializer } from "@tiptap/pm/model";
import { LayoutTemplate, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { listSections } from "@/lib/sections";
import { Input } from "@/components/ui/input";
import { readEditorTemplates, removeEditorTemplate, saveEditorTemplate } from "@/lib/editor-templates";

export default function MenuEditorTemplates({ editor, scope, withSections, withAudience }) {
	const [open, setOpen] = useState(false);
	const [templates, setTemplates] = useState([]);
	const [sectionHtml, setSectionHtml] = useState(null);
	const [error, setError] = useState("");

	function load() {
		try {
			setTemplates(readEditorTemplates(localStorage, scope));
			setError("");
		} catch {
			setError("Could not open templates from this browser.");
		}
	}

	function show() {
		const { selection, schema } = editor.state;
		const { $from } = selection;
		const section = selection.node?.type.name === "section" ? selection.node : $from.depth && $from.node(1).type.name === "section" ? $from.node(1) : null;
		setSectionHtml(section ? DOMSerializer.fromSchema(schema).serializeNode(section).outerHTML : null);
		load();
		setOpen(true);
	}

	function save(event) {
		event.preventDefault();
		const fields = new FormData(event.currentTarget);
		const name = String(fields.get("name") ?? "").trim();
		const kind = fields.get("kind");
		const html = kind === "section" ? sectionHtml : editor.getHTML();
		if (!name || !html) return;
		if (/\bsrc=["']blob:/i.test(html)) {
			setError("Wait for images to finish uploading.");
			return;
		}
		try {
			if (!saveEditorTemplate(localStorage, scope, { id: crypto.randomUUID(), name, kind, html })) {
				setError("You can save up to 30 templates. Remove one to make room.");
				return;
			}
			event.currentTarget.reset();
			load();
		} catch {
			setError("Could not save the template in this browser.");
		}
	}

	function insert(template) {
		const sections = listSections(template.html);
		if (sections.length && (!withSections || (!withAudience && sections.some((rule) => !rule || rule.group || rule.place === "web")))) {
			setError("This editor does not support campaign sections.");
			return;
		}
		const { selection } = editor.state;
		const at = selection.$from.depth ? selection.$from.after(1) : selection.to;
		if (editor.commands.insertContentAt(at, template.html)) setOpen(false);
		else setError("Could not insert this template.");
	}

	return (
		<div className="flex justify-end border-b border-border/60 px-4 py-1.5">
			<Button variant="ghost" size="sm" type="button" onClick={show}><LayoutTemplate /> Templates</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); editor.commands.focus(); }}>
					<DialogTitle>Templates</DialogTitle>
					<DialogDescription>Reuse email content or a section saved in this browser.</DialogDescription>
					<form onSubmit={save} className="flex flex-wrap gap-2">
						<Input name="name" required maxLength={80} aria-label="Template name" placeholder="Template name" className="min-w-28 flex-1" />
						<select name="kind" aria-label="Template type" className="rounded-md border bg-background px-2 text-sm">
							<option value="email">Email body</option>
							{withSections && sectionHtml && <option value="section">Selected section</option>}
						</select>
						<Button type="submit">Save template</Button>
					</form>
					{templates.length > 0 && (
						<ul className="max-h-64 divide-y overflow-y-auto">
							{templates.map((template) => (
								<li key={template.id} className="flex items-center gap-2 py-2">
									<span className="min-w-0 flex-1 truncate text-sm">{template.name}</span>
									<span className="text-xs text-muted-foreground">{template.kind === "section" ? "Section" : "Email body"}</span>
									<Button variant="outline" size="sm" onClick={() => insert(template)}>Insert</Button>
									<Button variant="ghost" size="icon-sm" aria-label={`Remove ${template.name} template`} onClick={() => {
										try { removeEditorTemplate(localStorage, scope, template.id); load(); }
										catch { setError("Could not remove the template."); }
									}}><Trash2 /></Button>
								</li>
							))}
						</ul>
					)}
					{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
				</DialogContent>
			</Dialog>
		</div>
	);
}
