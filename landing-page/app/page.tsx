import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { detectMarketFromAcceptLanguage, MARKETS } from "@/lib/markets";

export default async function RootGateway() {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language");
  const marketId = detectMarketFromAcceptLanguage(acceptLanguage);
  redirect(`/${MARKETS[marketId].slug}`);
}
