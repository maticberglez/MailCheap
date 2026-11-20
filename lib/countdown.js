const MAX_DEADLINE = Date.UTC(2100, 0, 1);

export function readCountdownDeadline(value) {
	if (!/^\d{13}$/.test(value ?? "")) return null;
	const deadline = Number(value);
	return deadline < MAX_DEADLINE ? deadline : null;
}

export function countdownText(deadline, now = Date.now()) {
	const minutes = Math.ceil(Math.max(0, deadline - now) / 60_000);
	if (!minutes) return "Offer ended";
	const days = Math.floor(minutes / 1440);
	const hours = Math.floor(minutes / 60) % 24;
	return `${days}d  ${hours}h  ${minutes % 60}m`;
}

export function countdownDeadlineText(deadline) {
	return `Ends ${new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
	}).format(deadline)} UTC`;
}
