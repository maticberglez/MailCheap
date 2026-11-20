import { createElement } from "react";
import { ImageResponse } from "next/og";
import { countdownText, readCountdownDeadline } from "@/lib/countdown";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

export async function GET(request, { params }) {
	const deadline = readCountdownDeadline((await params).deadline);
	if (!deadline) return new Response(null, { status: 404 });
	if (await isRateLimited({ name: "countdown-image", limit: 120, window: "1 m", key: getClientIp(request.headers) })) {
		return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
	}

	return new ImageResponse(createElement("div", {
		style: {
			display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center",
			background: "#18181b", color: "#fff", fontSize: 40, fontWeight: 700,
		},
	}, countdownText(deadline)), {
		width: 480,
		height: 88,
		headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
	});
}
