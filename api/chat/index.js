const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

module.exports = async function (context, req) {
  const { message, players, rules, history } = req.body || {}

  if (!message) {
    context.res = { status: 400, body: { message: 'No message provided.' } }
    return
  }

  const systemPrompt = `You are an AI coach for "Pape Spor Squad", a soccer team management app for a regular weekly 7-a-side game.

You have access to the full player pool and rules. Your job is to:
- Update player stats/ratings based on game feedback
- Create or manage team constraints (same team / different teams)
- Answer questions about the squad
- Suggest team improvements

Current player pool:
${JSON.stringify(players || [], null, 2)}

Current rules:
${JSON.stringify(rules || [], null, 2)}

Respond ONLY with valid JSON in this exact format — no other text:
{
  "message": "Friendly explanation of what you're doing or your analysis",
  "actions": []
}

Available action types (include only what's needed, can be empty array):

Update a player's stats or ratings:
{ "type": "updatePlayer", "playerId": "<id>", "changes": { "pace": 8, "stars": 4 } }
Valid fields: pace, shooting, passing, dribbling, defending, physical (1-10), stars (1-5), age (number)
Quality fields: aggression, leadership, teamPlayer, workRate (values: "Low", "Med", "High")

Add a new rule:
{ "type": "addRule", "playerAId": "<id>", "playerBId": "<id>", "ruleType": "together", "label": "Eren + Kurt same team" }
ruleType is either "together" or "apart"

Toggle a rule on or off:
{ "type": "toggleRule", "ruleId": "<id>" }

Delete a rule:
{ "type": "deleteRule", "ruleId": "<id>" }

Guidelines:
- When adjusting stats from game feedback, be conservative: max ±2 points per session
- Always explain your reasoning in the message field in a friendly, coach-like tone
- If the user mentions players by name, match them to the player pool by name
- If you can't find a player by name, mention it in the message
- For game score feedback, reward standout performers and gently reduce ratings for poor performers`

  const messages = [
    ...(history || []),
    { role: 'user', content: message }
  ]

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    })

    const text = response.content[0].text
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { message: text, actions: [] }
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: parsed
    }
  } catch (e) {
    context.res = {
      status: 500,
      body: { message: `Error: ${e.message}`, actions: [] }
    }
  }
}
