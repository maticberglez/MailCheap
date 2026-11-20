import { isHexColor } from "./colors.js";

export const OFFER_SIZES = { min: 12, max: 56 };

export function readOfferStyle({ align, color, size }) {
	const number = /^\d{1,2}$/.test(size ?? "") ? Number(size) : null;
	return {
		align: align === "left" || align === "right" ? align : "center",
		color: isHexColor(color) ? color.toLowerCase() : null,
		size: number >= OFFER_SIZES.min && number <= OFFER_SIZES.max ? number : null,
	};
}

export function offerStyleData(value) {
	const { align, color, size } = readOfferStyle(value);
	return {
		...(align !== "center" && { "data-offer-align": align }),
		...(color && { "data-offer-color": color }),
		...(size && { "data-offer-size": String(size) }),
	};
}
