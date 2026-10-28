import { SITE } from "@/config";
import { renderOgCard } from "./post";

export default async () => renderOgCard(SITE.title, SITE.desc, "From Celesto");
