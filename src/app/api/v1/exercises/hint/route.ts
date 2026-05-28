import { NextResponse } from "next/server";
import { requireActorContext } from "@/lib/services/auth-context";
import { syncActorToUserDocument } from "@/lib/services/user-service";

export async function POST(req: Request) {
  try {
    const actor = await requireActorContext(req);
    const user = await syncActorToUserDocument(actor);
    
    if (!user.plan || user.plan === "free") {
      return NextResponse.json(
        { error: "AI features require a Pro or Teams subscription." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { code, task, instructions, failingRules } = body;

    // This is a mocked AI response endpoint for now.
    // In a real application, you would connect to OpenAI, Anthropic, etc.
    // e.g., const response = await openai.chat.completions.create({...})
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Basic logic to generate a contextual hint based on failing rules
    let hint = "I noticed you're having trouble. Let's break it down.";
    
    if (failingRules && failingRules.length > 0) {
      const firstFailing = failingRules[0];
      if (firstFailing.type === "hasTag") {
        hint = `It looks like you're missing a \`<${firstFailing.tag}>\` element. Try adding that to your HTML structure!`;
      } else if (firstFailing.type === "hasAttribute") {
        hint = `Check the attributes on your tags. You might need to add a \`${firstFailing.attribute}\` attribute.`;
      } else {
        hint = `Make sure your code satisfies this requirement: "${firstFailing.message}"`;
      }
    } else {
      hint = "Re-read the instructions carefully. Are you sure you completed all the steps?";
    }

    return NextResponse.json({ hint });
  } catch (error: unknown) {
    console.error("Error generating hint:", error);
    return NextResponse.json({ error: "Failed to generate hint" }, { status: 500 });
  }
}
