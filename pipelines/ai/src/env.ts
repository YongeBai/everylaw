import { config } from "dotenv";

// Anthropic credentials live in .env.pipelines so Next (which auto-loads the
// root .env) never sees them; shared vars like DATABASE_URL stay in .env.
// Imported for its side effect — must stay the first import wherever process
// env is read at module scope (e.g. the db client).
config({ path: [".env.pipelines", ".env"], quiet: true });
