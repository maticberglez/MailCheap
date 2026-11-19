"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, GitBranch, Pencil, Plus, Trash2 } from "lucide-react";
import FormWelcomeFlow from "@/components/FormWelcomeFlow";
import HeaderPage from "@/components/HeaderPage";
import StateEmpty from "@/components/StateEmpty";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { automationDraftKey, listAutomationDrafts, readAutomationDraft, saveAutomationList } from "@/lib/automation-drafts";

const noop = () => () => {};

export default function AutomationDrafts({ scope, draftId }) {
	const ready = useSyncExternalStore(noop, () => true, () => false);
	if (!ready) return <p className="p-4 text-sm text-muted-foreground">Loading automations…</p>;
	return draftId ? <OpenDraft scope={scope} id={draftId} /> : <DraftList scope={scope} />;
}

function OpenDraft({ scope, id }) {
	const [saved] = useState(() => {
		try {
			const entry = listAutomationDrafts(localStorage, scope).find((draft) => draft.id === id);
			return entry ? { ...entry, flow: readAutomationDraft(localStorage, scope, id) } : null;
		} catch {
			return null;
		}
	});
	return (
		<div className="min-w-0 space-y-2 py-2">
			<div className="flex items-center gap-2 px-3">
				<Button asChild variant="ghost" size="icon" aria-label="Back to automations"><Link href="/automations"><ArrowLeft /></Link></Button>
				<h1 className="truncate text-xl font-semibold">{saved?.name ?? "Automation unavailable"}</h1>
			</div>
			{saved ? <FormWelcomeFlow storageKey={automationDraftKey(scope, id)} initialFlow={saved.flow} /> : <p className="px-3 text-sm text-muted-foreground">This draft could not be opened in this browser.</p>}
		</div>
	);
}

function DraftList({ scope }) {
	const router = useRouter();
	const [initial] = useState(() => {
		try {
			return { drafts: listAutomationDrafts(localStorage, scope) };
		} catch {
			return { drafts: [], error: "Could not open your automation drafts." };
		}
	});
	const [drafts, setDrafts] = useState(initial.drafts);
	const [error, setError] = useState(initial.error ?? "");
	const [editing, setEditing] = useState(null);
	const [deleting, setDeleting] = useState(null);

	function save(next) {
		try {
			saveAutomationList(localStorage, scope, next);
			setDrafts(next);
			setError("");
			return true;
		} catch {
			setError("Could not save your automation list.");
			return false;
		}
	}

	function saveName(event) {
		event.preventDefault();
		const name = String(new FormData(event.currentTarget).get("name")).trim();
		if (!name || initial.error) return;
		const id = editing.id ?? crypto.randomUUID();
		const next = editing.id ? drafts.map((draft) => draft.id === id ? { ...draft, name } : draft) : [{ id, name }, ...drafts];
		if (!save(next)) return;
		setEditing(null);
		if (!editing.id) router.push(`/automations/${id}`);
	}

	return (
		<>
			<HeaderPage title="Automations">
				<Button disabled={Boolean(initial.error)} onClick={() => setEditing({ name: "" })}><Plus /> New automation</Button>
			</HeaderPage>
			<p className="mb-4 text-sm text-muted-foreground">Drafts are saved in this browser. Simulation sends no email.</p>
			{drafts.length ? (
				<div className="overflow-x-auto rounded-xl border bg-card">
					<table className="w-full text-sm">
						<thead className="border-b text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Status</th><th className="sr-only">Actions</th></tr></thead>
						<tbody>
							{drafts.map((draft) => (
								<tr key={draft.id} className="border-b last:border-0 hover:bg-muted/40">
									<td><Link className="flex items-center gap-2 px-4 py-3 font-medium" href={`/automations/${draft.id}`}><GitBranch aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />{draft.name}</Link></td>
									<td className="px-4 text-muted-foreground">Draft</td>
									<td className="px-2"><div className="flex justify-end">
										<Button variant="ghost" size="icon" aria-label={`Rename ${draft.name}`} onClick={() => setEditing(draft)}><Pencil /></Button>
										<Button variant="ghost" size="icon" aria-label={`Delete ${draft.name}`} onClick={() => setDeleting(draft)}><Trash2 /></Button>
									</div></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : !initial.error && <StateEmpty icon={GitBranch} title="No automations yet" />}
			{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
			<Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
				<DialogContent>
					<DialogTitle>{editing?.id ? "Rename automation" : "New automation"}</DialogTitle>
					<DialogDescription>Choose a name for this draft.</DialogDescription>
					<form className="space-y-4" onSubmit={saveName}>
						<Input key={editing?.id ?? "new"} aria-label="Automation name" name="name" defaultValue={editing?.name} placeholder="Welcome series" required maxLength={100} />
						<DialogFooter><Button type="submit">{editing?.id ? "Save name" : "Create automation"}</Button></DialogFooter>
					</form>
					{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
				</DialogContent>
			</Dialog>
			<Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
				<DialogContent>
					<DialogTitle>Delete automation?</DialogTitle>
					<DialogDescription>This removes {deleting?.name} from this browser.</DialogDescription>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
						<Button variant="destructive" onClick={() => {
							if (!save(drafts.filter(({ id }) => id !== deleting.id))) return;
							try { localStorage.removeItem(automationDraftKey(scope, deleting.id)); } catch { setError("The draft was removed from the list, but browser storage could not be cleared."); }
							setDeleting(null);
						}}>Delete automation</Button>
					</DialogFooter>
					{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
				</DialogContent>
			</Dialog>
		</>
	);
}
