"use client";

import { useState } from "react";
import { DOMSerializer } from "@tiptap/pm/model";
import { LayoutTemplate, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { withEmailSections } from "@/lib/sections";
import { toPreviewHtml } from "@/lib/email-preview";
import { renderEmail } from "@/lib/render-email";
import PreviewEmail from "@/components/PreviewEmail";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { canUseEditorTemplate, readEditorTemplates, removeEditorTemplate, saveEditorTemplate } from "@/lib/editor-templates";

export default function MenuEditorTemplates({ editor, scope, withSections, withAudience, newsletter }) {
	const [open, setOpen] = useState(false);
	const [templates, setTemplates] = useState([]);
	const [selectedId, setSelectedId] = useState(null);
	const [confirmation, setConfirmation] = useState(null);
	const [kind, setKind] = useState("email");
	const [sectionHtml, setSectionHtml] = useState(null);
	const [error, setError] = useState("");

	const selected = templates.find(({ id }) => id === selectedId) ?? templates[0];
	const preview = open && selected && toPreviewHtml(renderEmail({
		format: "rich", html: withEmailSections(selected.html), newsletter,
	}).html);

	function load(selectId) {
		try {
			setTemplates(readEditorTemplates(localStorage, scope));
			if (selectId) setSelectedId(selectId);
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
		setKind("email");
		load();
		setOpen(true);
	}

	function save(event) {
		event.preventDefault();
		const fields = new FormData(event.currentTarget);
		const name = String(fields.get("name") ?? "").trim();
		const id = crypto.randomUUID();
		const html = kind === "section" ? sectionHtml : editor.getHTML();
		if (!name || !html) return;
		if (/\bsrc=["']blob:/i.test(html)) {
			setError("Wait for images to finish uploading.");
			return;
		}
		try {
			if (!saveEditorTemplate(localStorage, scope, { id, name, kind, html })) {
				setError("You can save up to 30 templates. Remove one to make room.");
				return;
			}
			event.currentTarget.reset();
			setKind("email");
			load(id);
		} catch {
			setError("Could not save the template in this browser.");
		}
	}

	function requestUse() {
		if (!canUseEditorTemplate(selected, { withSections, withAudience })) {
			setError("This editor does not support campaign sections.");
			return;
		}
		setError("");
		setConfirmation("replace");
	}

	function confirm() {
		setConfirmation(null);
		if (confirmation === "delete") {
			try {
				removeEditorTemplate(localStorage, scope, selected.id);
				load();
			} catch {
				setError("Could not delete the template.");
			}
			return;
		}
		try {
			if (editor.commands.setContent(selected.html, { errorOnInvalidContent: true })) {
				setOpen(false);
				return;
			}
		} catch {
			// An invalid template must leave the current draft intact.
		}
		setError("Could not apply this template.");
	}

	return (
		<div className="flex justify-end border-b border-border/60 px-4 py-1.5">
			<Button variant="ghost" size="sm" type="button" onClick={show}><LayoutTemplate /> Templates</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent
					className="top-0 left-0 flex h-dvh max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none"
					onCloseAutoFocus={(event) => { event.preventDefault(); editor.commands.focus(); }}
				>
					<header className="shrink-0 border-b px-5 py-4 pr-14">
						<DialogTitle>Templates</DialogTitle>
						<DialogDescription className="mt-1">Preview templates saved in this browser.</DialogDescription>
					</header>
					<div className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] md:grid-cols-[18rem_minmax(0,1fr)] md:grid-rows-1">
						<aside className="overflow-auto border-b p-4 md:border-r md:border-b-0">
							<form onSubmit={save} className="grid gap-2">
								<Input name="name" required maxLength={80} aria-label="Template name" placeholder="Template name" />
								<Select value={kind} onValueChange={setKind}>
									<SelectTrigger aria-label="Template type" className="w-full"><SelectValue /></SelectTrigger>
									<SelectContent position="popper">
										<SelectItem value="email">Email body</SelectItem>
										{withSections && sectionHtml && <SelectItem value="section">Selected section</SelectItem>}
									</SelectContent>
								</Select>
								<Button type="submit" variant="outline">Save template</Button>
							</form>
							<ul className="mt-4 space-y-1 border-t pt-4">
								{templates.map((template) => (
									<li key={template.id}>
										<Button type="button" variant={selected?.id === template.id ? "secondary" : "ghost"}
											aria-pressed={selected?.id === template.id}
											className="h-auto w-full flex-col items-start gap-0 px-3 py-2"
											onClick={() => { setSelectedId(template.id); setError(""); }}
										>
											<span className="max-w-full truncate">{template.name}</span>
											<span className="text-xs text-muted-foreground">{template.kind === "section" ? "Section" : "Email body"}</span>
										</Button>
									</li>
								))}
							</ul>
						</aside>
						<section aria-label="Template preview" className="flex min-h-0 flex-col gap-3 overflow-auto bg-muted/30 p-4">
							{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
							{selected ? (
								<>
									<div className="flex shrink-0 items-center gap-2">
										<h2 className="mr-auto min-w-0 truncate font-medium">{selected.name}</h2>
										<Button type="button" variant="outline" size="icon-sm" aria-label="Delete template" onClick={() => setConfirmation("delete")}><Trash2 /></Button>
										<Button type="button" size="sm" onClick={requestUse}>Use template</Button>
									</div>
									<PreviewEmail html={preview} desktopWidth={760} className="min-h-44 flex-1" />
								</>
							) : <p className="m-auto text-muted-foreground">No saved templates yet.</p>}
						</section>
					</div>
					<Dialog open={Boolean(confirmation)} onOpenChange={(next) => { if (!next) setConfirmation(null); }}>
						<DialogContent showCloseButton={false}>
							<DialogTitle>{confirmation === "delete" ? "Delete template?" : "Replace email body?"}</DialogTitle>
							<DialogDescription>
								{confirmation === "delete"
									? `Are you sure you want to delete “${selected?.name}”?`
									: `Are you sure you want to replace the entire email body with “${selected?.name}”?`}
							</DialogDescription>
							<DialogFooter className="flex-row justify-end">
								<Button variant="outline" type="button" onClick={() => setConfirmation(null)}>Cancel</Button>
								<Button variant={confirmation === "delete" ? "destructive" : "default"} type="button" onClick={confirm}>
									{confirmation === "delete" ? "Delete template" : "Replace email body"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</DialogContent>
			</Dialog>
		</div>
	);
}
