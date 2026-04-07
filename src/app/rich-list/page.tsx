import { redirect } from "next/navigation";

// Rich List is now a section on /tokens page
export default function RichListRedirect() {
  redirect("/tokens#rich-list");
}
