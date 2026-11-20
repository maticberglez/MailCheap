const MAX_DEADLINE = Date.UTC(2100, 0, 1);

export function readCountdownDeadline(value) {
	if (!/^\d{13}$/.test(value ?? "")) return null;
	const deadline = Number(value);
	return deadline < MAX_DEADLINE ? deadline : null;
}

export function countdownText(deadline, now = Date.now(), { showDays = true, showSeconds = false } = {}) {
	const remaining = Math.max(0, deadline - now);
	if (!remaining) return "Offer ended";
	const seconds = Math.ceil(remaining / 1000);
	const units = [
		[showDays ? Math.floor(seconds / 86_400) : 0, "d"],
		[showDays ? Math.floor(seconds / 3600) % 24 : Math.floor(seconds / 3600), "h"],
		[Math.floor(seconds / 60) % 60, "m"],
		[showSeconds ? seconds % 60 : 0, "s"],
	];
	return units.filter(([amount]) => amount > 0).map(([amount, unit]) => `${amount}${unit}`).join("  ") || "<1m";
}

export function countdownDeadlineText(deadline) {
	return `Ends ${new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
	}).format(deadline)} UTC`;
}
