import FormShopifyConnection from "@/components/FormShopifyConnection";
import HeaderPage from "@/components/HeaderPage";
import LayoutNarrow from "@/components/LayoutNarrow";
import { requireRole } from "@/lib/selected-newsletter";
import { scoped } from "@/lib/account-scope";
import Newsletter from "@/models/Newsletter";

export const metadata = { title: "Shopify integration" };

export default async function ShopifySettingsPage() {
	const { account, selected } = await requireRole("owner");
	const newsletter = selected
		? await Newsletter.findOne(scoped(account, { _id: selected._id })).select("shopify.domain").lean()
		: null;

	return (
		<LayoutNarrow>
			<HeaderPage title="Shopify integration" />
			{newsletter ? <FormShopifyConnection key={String(newsletter._id)} newsletterId={String(newsletter._id)} domain={newsletter.shopify?.domain} />
				: <p>Select a newsletter to connect a Shopify store.</p>}
		</LayoutNarrow>
	);
}
