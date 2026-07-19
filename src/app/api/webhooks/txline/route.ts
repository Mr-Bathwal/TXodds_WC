import { NextResponse } from "next/server";

// 100% FREE Pundit Templates (No OpenAI API needed!)
const GOAL_TEMPLATES = [
  "GOAL for {team}! Absolute screamer. Defending was non-existent, my nan could have stopped that. Market goes wild!",
  "Back of the net for {team}! What a strike! Odds just flipped completely.",
  "Goal! {team} takes it! That's why you don't park the bus. Market is scrambling right now.",
  "{team} scores! Unbelievable scenes. If you bet against them, you're crying right now."
];

const CARD_TEMPLATES = [
  "Red card for {team}! Shocking challenge. He had to go. The market is shifting massively against them now.",
  "{team} is down to 10 men! What was he thinking? Absolute madness. Odds are crashing."
];

const GENERAL_TEMPLATES = [
  "Huge momentum shift here. {team} is pressing hard. Expect an odds swing shortly.",
  "The market is moving! Heavy volume coming in on {team}."
];

function getRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Example TxLINE Webhook Payload:
    // { event: "goal", team: "France", minute: 90, odds_home: 1.1, odds_away: 8.5 }
    const { event, team, minute } = body;

    let message = "";
    if (event === "goal") {
      message = `⚽ **${minute}'** - ` + getRandom(GOAL_TEMPLATES).replace(/{team}/g, team || "them");
    } else if (event === "red_card") {
      message = `🟥 **${minute}'** - ` + getRandom(CARD_TEMPLATES).replace(/{team}/g, team || "them");
    } else {
      message = `⚡ **${minute || 'LIVE'}'** - ` + getRandom(GENERAL_TEMPLATES).replace(/{team}/g, team || "them");
    }

    // Add market context
    message += `\n\n📊 *TxLINE Odds Update:* Check the dashboard for real-time market shifts!`;

    // 100% FREE Telegram Bot API (No subscriptions needed)
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.log("Webhook received, but Telegram credentials are not configured.");
      console.log("Message generated:", message);
      return NextResponse.json({ success: true, message: "Webhook logged (Telegram not configured)" });
    }

    // Send the message to Telegram
    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Telegram API Error:", errorText);
      throw new Error(`Failed to send to Telegram: ${errorText}`);
    }

    return NextResponse.json({ success: true, message: "Pundit message sent!" });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
