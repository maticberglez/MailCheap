import { readLocalImage } from "@/lib/local-images";

export async function GET(_request, { params }) {
	const image = await readLocalImage((await params).name);
	if (!image) return new Response(null, { status: 404 });
	return new Response(image.bytes, {
		headers: { "Content-Type": image.contentType, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" },
	});
}
