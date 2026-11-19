"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, Copy, GitBranch, MoreHorizontal, PenLine, Plus, Trash2 } from "lucide-react";
import { DialogNewDraft } from "@/components/DialogNewCampaign";
import BadgeStatus from "@/components/BadgeStatus";
import TextEmpty from "@/components/TextEmpty";
import EditorRich from "@/components/EditorRich";
import FormWelcomeFlow from "@/components/FormWelcomeFlow";
import HeaderPage from "@/components/HeaderPage";
import StateEmpty from "@/components/StateEmpty";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/format";
import { automationDraftKey, listAutomationDrafts, readAutomationDraft, saveAutomationEmail, saveAutomationList } from "@/lib/automation-drafts";

const noop = () => () => {};

export default function AutomationDrafts({ scope, draftId, emailNodeId, selectedNodeId, addresses }) {
	const ready = useSyncExternalStore(noop, () => true, () => false);
	if (!ready) return <p className="p-4 text-sm text-muted-foreground">Loading automations…</p>;
	return draftId ? <OpenDraft scope={scope} id={draftId} emailNodeId={emailNodeId} selectedNodeId={selectedNodeId} addresses={addresses} /> : <DraftList scope={scope} />;
}

function OpenDraft({ scope, id, emailNodeId, selectedNodeId, addresses }) {
	const [saved] = useState(() => {
		try {
			const entry = listAutomationDrafts(localStorage, scope).find((draft) => draft.id === id);
			return entry ? { ...entry, flow: readAutomationDraft(localStorage, scope, id) } : null;
		} catch {
			return null;
		}
	});
	if (emailNodeId) return <OpenAutomationEmail scope={scope} id={id} draft={saved} nodeId={emailNodeId} />;
	return (
		<div data-automation-editor="" className="min-w-0">
			<div className="flex h-[3.25rem] items-center gap-2 border-b bg-background px-3">
				<Button asChild variant="ghost" size="icon" aria-label="Back to automations"><Link href="/automations"><ArrowLeft /></Link></Button>
				<h1 className="truncate text-xl font-semibold">{saved?.name ?? "Automation unavailable"}</h1>
				{saved && <BadgeStatus status="draft" />}
			</div>
			{saved ? <FormWelcomeFlow storageKey={automationDraftKey(scope, id)} initialFlow={saved.flow} editPath={`/automations/${id}/email`} selectedNodeId={selectedNodeId} addresses={addresses} /> : <p className="px-3 text-sm text-muted-foreground">This draft could not be opened in this browser.</p>}
		</div>
	);
}

function OpenAutomationEmail({ scope, id, draft, nodeId }) {
	const node = draft?.flow.nodes.find((item) => item.id === nodeId && item.type === "email");
	const [message, setMessage] = useState("");

	function saveBody(html) {
		try {
			setMessage(saveAutomationEmail(localStorage, scope, id, nodeId, html) ? "Saved" : "This email node is no longer available.");
		} catch {
			setMessage("Could not save the email to this browser.");
		}
	}

	return (
		<div data-automation-editor="" className="min-w-0">
			<header className="flex h-[3.25rem] items-center gap-2 border-b bg-background px-3">
				<Button asChild variant="ghost" size="icon" aria-label="Back to flow"><Link href={`/automations/${id}?node=${encodeURIComponent(nodeId)}`}><ArrowLeft /></Link></Button>
				<h1 className="min-w-0 truncate text-xl font-semibold">{node?.value || "Automation email"}</h1>
				<BadgeStatus status="draft" />
				<span role="status" className="ml-auto text-sm text-muted-foreground">{message}</span>
			</header>
			{node ? <div className="mx-auto max-w-3xl space-y-4 p-4 md:py-8">
				<p className="truncate text-sm text-muted-foreground">{draft.name}</p>
				<div className="overflow-hidden rounded-xl border bg-card">
					<EditorRich content={node.html ?? ""} onChange={saveBody} minHeight="min-h-[60vh]" />
				</div>
			</div> : <p className="p-4 text-sm text-muted-foreground">This email node could not be opened in this browser.</p>}
		</div>
	);
}

function DraftList({ scope }) {
	const router = useRouter();
	const [initial] = useState(() => {
		try {
			return { drafts: listAutomationDrafts(localStorage, scope).map((draft) => {
				try {
					const updatedAt = readAutomationDraft(localStorage, scope, draft.id).updatedAt;
					return { ...draft, updatedAt: updatedAt ?? draft.updatedAt };
				} catch {
					return draft;
				}
			}) };
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
		if (save(drafts.map((draft) => draft.id === editing.id ? { ...draft, name } : draft))) setEditing(null);
	}

	function createDraft(source, open) {
		const id = crypto.randomUUID();
		const name = source ? `${source.name.slice(0, 93)} (copy)` : "Untitled automation";
		const updatedAt = new Date().toISOString();
		try {
			if (source) {
				const flow = readAutomationDraft(localStorage, scope, source.id);
				localStorage.setItem(automationDraftKey(scope, id), JSON.stringify({ ...flow, updatedAt }));
			}
			if (!save([{ id, name, updatedAt }, ...drafts])) {
				if (source) localStorage.removeItem(automationDraftKey(scope, id));
				return { error: "Could not save your automation list." };
			}
		} catch {
			const error = source ? "Could not duplicate this automation." : "Could not create this automation.";
			setError(error);
			return { error };
		}
		if (open) router.push(`/automations/${id}`);
	}

	return (
		<>
			<HeaderPage title="Automations">
				<DialogNewDraft title="New automation" copyTitle="Copy an automation"
					drafts={drafts.map((draft) => ({ id: draft.id, subject: draft.name, status: "draft", at: draft.updatedAt,
						thumbnail: <GitBranch aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> }))}
					onBlank={() => createDraft(null, true)}
					onCopy={(id) => {
						const source = drafts.find((draft) => draft.id === id);
						return source ? createDraft(source, true) : { error: "Automation draft unavailable." };
					}}>
					<Button disabled={Boolean(initial.error)}><Plus data-icon="inline-start" /> New</Button>
				</DialogNewDraft>
			</HeaderPage>
			{drafts.length ? (
				<div className="animate-enter overflow-hidden rounded-xl shadow-border">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="pl-4">Name</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="hidden text-right md:table-cell">Recipients</TableHead>
								<TableHead className="hidden text-right md:table-cell">Opens</TableHead>
								<TableHead className="hidden text-right md:table-cell">Clicks</TableHead>
								<TableHead className="hidden text-right sm:table-cell">Date</TableHead>
								<TableHead className="w-12 pr-2"><span className="sr-only">Actions</span></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{drafts.map((draft) => (
								<TableRow key={draft.id} className="relative">
									<TableCell className="w-full max-w-0 py-2 pl-4 sm:w-1/2">
										<div className="flex min-w-0 items-center gap-2">
											<GitBranch aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
											<Link className="min-w-0 truncate font-medium after:absolute after:inset-0" href={`/automations/${draft.id}`}>{draft.name}</Link>
										</div>
									</TableCell>
									<TableCell><BadgeStatus status="draft" /></TableCell>
									{["Recipients", "Opens", "Clicks"].map((column) => <TableCell key={column} className="hidden text-right md:table-cell"><TextEmpty label="No data" /></TableCell>)}
									<TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{draft.updatedAt ? formatRelative(draft.updatedAt) : <TextEmpty />}</TableCell>
									<TableCell className="pr-2 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${draft.name}`} className="relative z-10 text-muted-foreground hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground"><MoreHorizontal /></Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="min-w-52">
												<DropdownMenuItem onSelect={() => createDraft(draft, false)}><Copy /> Duplicate</DropdownMenuItem>
												<DropdownMenuItem onSelect={() => setEditing(draft)}><PenLine /> Rename</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem variant="destructive" onSelect={() => setDeleting(draft)}><Trash2 /> Delete</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			) : !initial.error && <StateEmpty icon={GitBranch} title="No automations yet" />}
			{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
			<Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
				<DialogContent>
					<DialogTitle>Rename automation</DialogTitle>
					<DialogDescription>Choose a name for this draft.</DialogDescription>
					<form className="space-y-4" onSubmit={saveName}>
						<Input key={editing?.id} aria-label="Automation name" name="name" defaultValue={editing?.name} placeholder="Welcome series" required maxLength={100} />
						<DialogFooter><Button type="submit">Save name</Button></DialogFooter>
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
