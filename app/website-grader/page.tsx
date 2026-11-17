import { redirect } from "next/navigation";

// The Website Grader is now part of the Site Audit. Keep old links working.
export default function Page() {
  redirect("/site-audit");
}
