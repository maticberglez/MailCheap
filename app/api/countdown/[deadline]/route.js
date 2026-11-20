import { createElement } from "react";
import { ImageResponse } from "next/og";
import { countdownText, readCountdownDeadline } from "@/lib/countdown";
import { readOfferStyle } from "@/lib/offer-style";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

export async function GET(request, { params }) {
	const deadline = readCountdownDeadline((await params).deadline);
	if (!deadline) return new Response(null, { status: 404 });
	if (await isRateLimited({ name: "countdown-image", limit: 120, window: "1 m", key: getClientIp(request.headers) })) {
		return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
	}

	const options = new URL(request.url).searchParams;
	const { size, align, color, weight } = readOfferStyle({
		size: options.get("size"), align: options.get("align"), color: options.get("color"), weight: options.get("weight"),
	});
	return new ImageResponse(createElement("div", {
		style: {
			display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: { left: "flex-start", center: "center", right: "flex-end" }[align], padding: "0 16px",
			background: "#18181b", color: color ?? "#fff", fontSize: size ?? 40, fontWeight: weight ?? 700,
		},
	}, countdownText(deadline, Date.now(), { showDays: options.get("days") !== "0", showSeconds: options.get("seconds") === "1" })), {
		width: 480,
		height: 88,
		headers: { "Cache-Control": options.get("seconds") === "1" ? "no-store" : "public, max-age=0, s-maxage=30" },
	});
}
