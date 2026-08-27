import { AdminReview } from "@/components/admin-review";
export const metadata = { title: "AI content review", robots: "noindex,nofollow" };
export default function ReviewPage() { return <main className="shell py-16"><p className="eyebrow">Internal quality control</p><h1 className="serif text-5xl font-black mt-3">Review AI drafts</h1><p className="mt-4 text-[#59645e]">Nothing appears publicly until it is published here.</p><div className="mt-9"><AdminReview /></div></main>; }
