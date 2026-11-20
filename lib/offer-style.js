import { isHexColor } from "./colors.js";

export const DISCOUNT_COPY_SYMBOL = "⧉";

export const OFFER_SIZES = { min: 12, max: 56 };

export const OFFER_PADDING = { min: 0, max: 64, default: 16 };
export const OFFER_STYLE_KEYS = ["align", "color", "size", "padding-x", "padding-y"];

function readPadding(value) {
	const number = /^\d{1,2}$/.test(value ?? "") ? Number(value) : null;
	return number !== null && number <= OFFER_PADDING.max ? number : null;
}

export function readOfferStyle({ align, color, size, "padding-x": horizontal, "padding-y": vertical }) {
	const number = /^\d{1,2}$/.test(size ?? "") ? Number(size) : null;
	return {
		align: align === "left" || align === "right" ? align : "center",
		color: isHexColor(color) ? color.toLowerCase() : null,
		size: number >= OFFER_SIZES.min && number <= OFFER_SIZES.max ? number : null,
		"padding-x": readPadding(horizontal),
		"padding-y": readPadding(vertical),
	};
}

export function offerStyleData(value) {
	const { align, color, size, "padding-x": horizontal, "padding-y": vertical } = readOfferStyle(value);
	return {
		...(align !== "center" && { "data-offer-align": align }),
		...(color && { "data-offer-color": color }),
		...(size && { "data-offer-size": String(size) }),
		...(horizontal !== null && { "data-offer-padding-x": String(horizontal) }),
		...(vertical !== null && { "data-offer-padding-y": String(vertical) }),
	};
}
