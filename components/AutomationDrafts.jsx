"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ArrowLeft, Copy, GitBranch, MoreHorizontal, PenLine, Plus, Trash2 } from "lucide-react";
import { setAutomationLive } from "@/app/(app)/automations/actions";
import { DialogNewDraft } from "@/components/DialogNewCampaign";
import BadgeStatus from "@/components/BadgeStatus";
import TextEmpty from "@/components/TextEmpty";
import NavSteps from "@/components/NavSteps";
import PreviewAutomationEmail from "@/components/PreviewAutomationEmail";
import RowCampaign from "@/components/RowCampaign";
import PanelEmailEditor from "@/components/PanelEmailEditor";
import EditorRich from "@/components/EditorRich";
import FormWelcomeFlow from "@/components/FormWelcomeFlow";
import HeaderPage from "@/components/HeaderPage";
import StateEmpty from "@/components/StateEmpty";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { automationDraftKey, listAutomationDrafts, readAutomationDraft, saveAutomationEmail, saveAutomationList } from "@/lib/automation-drafts";

const noop = () => () => {};

export default function AutomationDrafts({ scope, draftId, emailNodeId, selectedNodeId, addresses, newsletterId, liveAutomation, isOverview = false }) {
	const ready = useSyncExternalStore(noop, () => true, () => false);
	if (!ready) return <p className="p-4 text-sm text-muted-foreground">Loading automations…</p>;
	return draftId ? <OpenDraft scope={scope} id={draftId} emailNodeId={emailNodeId} selectedNodeId={selectedNodeId} addresses={addresses} isLive={liveAutomation?.id === draftId} /> : <DraftList scope={scope} isOverview={isOverview} newsletterId={newsletterId} liveAutomation={liveAutomation} />;
}

function OpenDraft({ scope, id, emailNodeId, selectedNodeId, addresses, isLive }) {
	const [saved] = useState(() => {
		try {
			const entry = listAutomationDrafts(localStorage, scope).find((draft) => draft.id === id);
			return entry ? { ...entry, flow: readAutomationDraft(localStorage, scope, id) } : null;
		} catch {
			return null;
		}
	});
	if (emailNodeId) return <OpenAutomationEmail scope={scope} id={id} draft={saved} nodeId={emailNodeId} addresses={addresses} />;
	return (
		<div data-automation-editor="" className="min-w-0">
			<div className="flex h-[3.25rem] items-center gap-2 border-b bg-background px-3">
				<Button asChild variant="ghost" size="icon" aria-label="Back to automations"><Link href="/automations"><ArrowLeft /></Link></Button>
				<h1 className="truncate text-xl font-semibold">{saved?.name ?? "Automation unavailable"}</h1>
				{saved && <BadgeStatus status={isLive ? "live" : "draft"} />}
			</div>
			{saved ? <FormWelcomeFlow storageKey={automationDraftKey(scope, id)} initialFlow={saved.flow} editPath={`/automations/${id}/email`} selectedNodeId={selectedNodeId} addresses={addresses} /> : <p className="px-3 text-sm text-muted-foreground">This draft could not be opened in this browser.</p>}
		</div>
	);
}

const STEP_MOTION = "transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none";
const EMAIL_STEPS = [{ id: "edit", label: "Edit" }, { id: "review", label: "Review" }];

const EMAIL_FIELDS = [
	["value", "Subject", "Welcome to our newsletter", 200],
	["previewText", "Preview text", "A quick hello and what to expect", 300],
	["fromName", "Sender name", "Your newsletter name", 100],
];

function AddressField({ label, placeholder, options, value, onChange }) {
	return (
		<select aria-label={label} className={cn("h-11 w-full min-w-0 bg-transparent text-sm outline-none", !value && "text-muted-foreground")} value={value} onChange={(event) => onChange(event.target.value)}>
			<option value="">{placeholder}</option>
			{value && !options.includes(value) && <option value={value} disabled>{value} (unavailable)</option>}
			{options.map((email) => <option key={email} value={email}>{email}</option>)}
	</select>
	);
}

function OpenAutomationEmail({ scope, id, draft, nodeId, addresses }) {
	const router = useRouter();
	const returnHref = `/automations/${id}?node=${encodeURIComponent(nodeId)}`;
	const pendingFields = useRef({});
	const [node, setNode] = useState(() => draft?.flow.nodes.find((item) => item.id === nodeId && item.type === "email"));
	const [initialBody] = useState(node?.html ?? "");
	const [step, setStep] = useState("edit");
	const [reviewActions, setReviewActions] = useState(null);
	const [mode, setMode] = useState(null);
	const [message, setMessage] = useState("");

	function saveEmail(fields = {}) {
		pendingFields.current = { ...pendingFields.current, ...fields };
		setNode((current) => ({ ...current, ...fields }));
		try {
			if (saveAutomationEmail(localStorage, scope, id, nodeId, pendingFields.current)) {
				pendingFields.current = {};
				window.dispatchEvent(new StorageEvent("storage", { key: automationDraftKey(scope, id) }));
				setMessage("Saved");
				return true;
			} else {
				setMessage("This email node is no longer available.");
			}
		} catch {
			setMessage("Could not save the email to this browser.");
		}
	}

	function saveAndReturn() {
		if (saveEmail()) router.push(returnHref);
	}

	return (
		<div data-automation-editor="" className="min-w-0">
			<header className="grid min-h-[3.25rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b bg-background px-3 py-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] lg:gap-x-6">
				<div className="flex min-w-0 items-center gap-2">
					<Button asChild variant="ghost" size="icon" aria-label="Back to flow"><Link href={returnHref}><ArrowLeft /></Link></Button>
					{node ? (
						<input aria-label="Email title" value={node.title ?? ""} placeholder="Untitled email" maxLength={200}
							className="min-w-0 max-w-[min(24rem,50vw)] truncate [field-sizing:content] rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold outline-none hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/25"
							onChange={(event) => saveEmail({ title: event.target.value })}
							onKeyDown={(event) => {
								if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
								event.preventDefault();
								if (saveEmail()) event.currentTarget.blur();
							}} />
					) : <h1 className="min-w-0 truncate text-xl font-semibold">Automation email</h1>}
					<BadgeStatus status="draft" />
				</div>
				{node && <NavSteps steps={EMAIL_STEPS} step={step} onStep={setStep} className="col-span-2 row-start-2 justify-self-center lg:col-span-1 lg:col-start-2 lg:row-start-1" />}
				<div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-2 lg:col-start-3">
					<span role="status" className="min-w-0 truncate text-sm text-muted-foreground">{message}</span>
					{node && step === "edit" && <Button type="button" className="shrink-0 lg:min-w-32" onClick={saveAndReturn}>Save</Button>}
					<div ref={setReviewActions} hidden={step !== "review"} />
				</div>
			</header>
			{node ? <div className="mx-auto max-w-3xl space-y-4 p-4 md:py-8">
				<p className="truncate text-sm text-muted-foreground">{draft.name}</p>
				<section aria-label="Edit" hidden={step !== "edit"} className={STEP_MOTION}>
					<PanelEmailEditor className="shadow-border" mode={mode} onModeChange={setMode}>
						<div className="divide-y divide-border/60 border-b border-border/60 motion-safe:transition-colors motion-safe:duration-200 motion-safe:[&>*]:transition-colors motion-safe:[&>*]:duration-200">
							{EMAIL_FIELDS.map(([key, label, placeholder, maxLength]) => (
								<RowCampaign key={key} label={label}>
									<input className={cn("h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:font-normal placeholder:text-muted-foreground", key === "value" && "font-medium")}
										aria-label={label} maxLength={maxLength} value={node[key] ?? ""} placeholder={key === "fromName" ? addresses.senderName || placeholder : placeholder}
										onChange={(event) => saveEmail({ [key]: event.target.value })} />
								</RowCampaign>
							))}
							<RowCampaign label="Sender email">
								<AddressField label="Sender email" placeholder={addresses.sender || "Select a sender address"} options={addresses.fromEmails}
									value={node.fromEmail ?? ""} onChange={(fromEmail) => saveEmail({ fromEmail })} />
							</RowCampaign>
							<RowCampaign label="Reply to">
								<AddressField label="Reply to" placeholder={addresses.replyTo || "Use the sender address"} options={addresses.replyEmails}
									value={node.replyTo ?? ""} onChange={(replyTo) => saveEmail({ replyTo })} />
							</RowCampaign>
						</div>
						<EditorRich sectionLayouts templateScope={scope.slice("welcome-flow:".length)} content={initialBody} onChange={(html) => saveEmail({ html })} minHeight="min-h-[60vh]" />
					</PanelEmailEditor>
				</section>
				<section aria-label="Review" hidden={step !== "review"} className={STEP_MOTION}>
					<PreviewAutomationEmail node={node} addresses={addresses} mode={mode} onModeChange={setMode} onSave={saveAndReturn} actionsTarget={reviewActions} />
				</section>
			</div> : <p className="p-4 text-sm text-muted-foreground">This email node could not be opened in this browser.</p>}
		</div>
	);
}

function DraftList({ scope, isOverview, newsletterId, liveAutomation }) {
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
	const [publishing, setPublishing] = useState(null);
	const [isChangingStatus, startStatusChange] = useTransition();

	function changeStatus() {
		const { draft, isLive } = publishing;
		startStatusChange(async () => {
			setError("");
			try {
				const result = await setAutomationLive({
					newsletterId, automationId: draft.id,
					draft: isLive ? undefined : { name: draft.name, flow: readAutomationDraft(localStorage, scope, draft.id) },
				});
				if (result.error) setError(result.error);
				else {
					setPublishing(null);
					router.refresh();
				}
			} catch {
				setError("Could not change the automation status.");
			}
		});
	}

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

	const externalLive = liveAutomation?.id && !drafts.some(({ id }) => id === liveAutomation.id);
	const shownDrafts = isOverview
		? drafts.toSorted((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 5)
		: drafts;

	return (
		<>
			{!isOverview && (
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
			)}
			{externalLive && (
				<div className="flex items-center gap-2 rounded-xl px-4 py-2 shadow-border">
					<span className="min-w-0 flex-1 truncate text-sm font-medium">{liveAutomation.name}</span>
					<BadgeStatus status="live" />
					<Button variant="outline" size="sm" onClick={() => { setError(""); setPublishing({ draft: liveAutomation, isLive: true }); }}>Put back in draft</Button>
				</div>
			)}
			{shownDrafts.length ? (
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
							{shownDrafts.map((draft) => (
								<TableRow key={draft.id} className="relative">
									<TableCell className="w-full max-w-0 py-2 pl-4 sm:w-1/2">
										<div className="flex min-w-0 items-center gap-2">
											<GitBranch aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
											<Link className="min-w-0 truncate font-medium after:absolute after:inset-0" href={`/automations/${draft.id}`}>{draft.name}</Link>
										</div>
									</TableCell>
									<TableCell><BadgeStatus status={liveAutomation?.id === draft.id ? "live" : "draft"} /></TableCell>
									{["Recipients", "Opens", "Clicks"].map((column) => <TableCell key={column} className="hidden text-right md:table-cell"><TextEmpty label="No data" /></TableCell>)}
									<TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{draft.updatedAt ? formatRelative(draft.updatedAt) : <TextEmpty />}</TableCell>
									<TableCell className="pr-2 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${draft.name}`} className="relative z-10 text-muted-foreground hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground"><MoreHorizontal /></Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="min-w-52">
												<DropdownMenuItem onSelect={() => { setError(""); setPublishing({ draft, isLive: liveAutomation?.id === draft.id }); }}>
													{liveAutomation?.id === draft.id ? "Put back in draft" : "Make live"}
												</DropdownMenuItem>
												{liveAutomation?.id === draft.id && <DropdownMenuItem onSelect={() => { setError(""); setPublishing({ draft, isLive: false }); }}>Publish changes</DropdownMenuItem>}
												<DropdownMenuSeparator />
												<DropdownMenuItem onSelect={() => createDraft(draft, false)}><Copy /> Duplicate</DropdownMenuItem>
												<DropdownMenuItem onSelect={() => setEditing(draft)}><PenLine /> Rename</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem variant="destructive" disabled={liveAutomation?.id === draft.id} onSelect={() => setDeleting(draft)}><Trash2 /> Delete</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			) : !initial.error && !externalLive && (isOverview
				? <p className="rounded-xl px-4 py-6 text-center text-sm text-muted-foreground shadow-border">No automations yet</p>
				: <StateEmpty icon={GitBranch} title="No automations yet" />)}
			{error && !publishing && <p role="alert" className="text-sm text-destructive">{error}</p>}
			<Dialog open={Boolean(publishing)} onOpenChange={(open) => { if (!open && !isChangingStatus) { setPublishing(null); setError(""); } }}>
				<DialogContent>
					<DialogTitle>{publishing?.isLive ? "Put automation back in draft?" : "Make automation live?"}</DialogTitle>
					<DialogDescription>
						{publishing?.isLive
							? "New subscribers will stop receiving this automation’s email."
							: "New subscribers will receive the published email. Changes to this draft take effect when you publish again."}
					</DialogDescription>
					{error && publishing && <p role="alert" className="text-sm text-destructive">{error}</p>}
					<DialogFooter>
						<Button variant="outline" disabled={isChangingStatus} onClick={() => { setPublishing(null); setError(""); }}>Cancel</Button>
						<Button disabled={isChangingStatus} onClick={changeStatus}>{publishing?.isLive ? "Put back in draft" : "Make live"}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
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
