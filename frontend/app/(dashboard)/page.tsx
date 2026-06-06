import { redirect } from "next/navigation";

/**
 * The root authenticated route now redirects to My Journey.
 * Progress metrics and nudges live inside /tracker — no duplicate home dashboard.
 */
export default function HomePage() {
  redirect("/tracker");
}
