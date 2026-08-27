import { permanentRedirect } from "next/navigation";

// The front page lives at / now; /r remains the namespace for subreddits,
// /r/random, and /r/history.
export default function RIndex() {
  permanentRedirect("/");
}
