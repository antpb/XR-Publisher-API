export class PlanGenerator {
    constructor(env, characterRegistry) {
        this.env = env;
        this.characterRegistry = characterRegistry;
        this.planStore = new Map();  // In-memory cache of plans
        this.availableActions = [
            {
                type: 'tweet',
                description: 'Post a tweet',
                requires: ['generate-prompt', 'twitter-post']
            },
            {
                type: 'tweet_with_media',
                description: 'Post a tweet with an image or media attachment',
                requires: ['twitter-post-with-media']
            },
            {
                type: 'like',
                description: 'Like a tweet from someone you follow',
                requires: ['twitter-like']
            },
            {
                type: 'reply',
                description: 'Reply to a tweet from someone you follow',
                requires: ['twitter-reply']
            },
            {
                type: 'retweet',
                description: 'Retweet something interesting',
                requires: ['twitter-retweet']
            },
            {
                type: 'telegram_message',
                description: 'Send a message on Telegram',
                requires: ['telegram-message']
            },
            {
                type: 'telegram_reply',
                description: 'Reply to a message on Telegram',
                requires: ['telegram-reply']
            },
            {
                type: 'telegram_edit',
                description: 'Edit a previously sent Telegram message',
                requires: ['telegram-edit']
            },
            {
                type: 'telegram_pin',
                description: 'Pin a message in a Telegram chat',
                requires: ['telegram-pin']
            },
            {
                type: 'discord_message',
                description: 'Send a message on Discord',
                requires: ['discord-message']
            },
            {
                type: 'discord_reply',
                description: 'Reply to a message on Discord',
                requires: ['discord-reply']
            },
            {
                type: 'discord_react',
                description: 'React to a message on Discord',
                requires: ['discord-react']
            },
            {
                type: 'discord_pin',
                description: 'Pin a message in a Discord channel',
                requires: ['discord-pin']
            },
            {
                type: 'discord_thread',
                description: 'Create or participate in a Discord thread',
                requires: ['discord-thread']
            },
            {
                type: 'visit_world',
                description: 'Visit and explore a virtual world',
                requires: ['world-visit']
            }
        ];
    }

    async getPlanKey(characterId, date) {
        const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        return `plan_${characterId}_${dateStr}`;
    }

    async sendTweetVerificationMessage(userId, characterName, tweetContent) {
        try {
            const character = await this.characterRegistry.getCharacter(userId, characterName);
            if (!character) {
                throw new Error('Character not found');
            }

            const secrets = await this.characterRegistry.getCharacterSecrets(character.id);
            if (!secrets || !secrets.modelKeys.telegram_token) {
                throw new Error('Telegram credentials not found');
            }

            const message = `🤖 Tweet Verification Needed\n\n` +
                        `Character: ${character.name}\n` +
                        `Proposed Tweet:\n${tweetContent}\n\n` +
                        `Please verify this tweet is appropriate for the character.`;

            return await this.characterRegistry.handleTelegramMessage(new Request('http://internal/telegram-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterId: character.id,
                    message: message,
                    chatId: userId
                })
            }));
        } catch (error) {
            console.error('Failed to send tweet verification message:', error);
            throw error;
        }
    }

    async executeAction(userId, characterName, action) {
        switch (action.action) {
            case 'tweet': {
                const promptResponse = await this.characterRegistry.handleGeneratePrompt(new Request('http://internal/generate-prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));

                if (!promptResponse.ok) {
                    throw new Error('Failed to generate prompt');
                }

                const { topic } = await promptResponse.json();
                await this.sendTweetVerificationMessage(userId, characterName, topic);

                return new Response(JSON.stringify({
                    status: 'pending_verification',
                    message: 'Tweet sent for verification',
                    content: topic
                }));
            }
            case 'tweet_with_media': {
                return await this.characterRegistry.handleTwitterPostWithMedia(new Request('http://internal/handle-twitter-post-with-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'like': {
                return await this.characterRegistry.handleTwitterLike(new Request('http://internal/handle-twitter-like', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'reply': {
                return await this.characterRegistry.handleTwitterReply(new Request('http://internal/handle-twitter-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'retweet': {
                return await this.characterRegistry.handleTwitterRetweet(new Request('http://internal/handle-twitter-retweet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'telegram_message': {
                return await this.characterRegistry.handleTelegramMessage(new Request('http://internal/telegram-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'telegram_reply': {
                return await this.characterRegistry.handleTelegramReply(new Request('http://internal/telegram-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'telegram_edit': {
                return await this.characterRegistry.handleTelegramEdit(new Request('http://internal/telegram-edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'telegram_pin': {
                return await this.characterRegistry.handleTelegramPin(new Request('http://internal/telegram-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'discord_message': {
                return await this.characterRegistry.handleDiscordMessage(new Request('http://internal/discord-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'discord_reply': {
                return await this.characterRegistry.handleDiscordReply(new Request('http://internal/discord-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'discord_react': {
                return await this.characterRegistry.handleDiscordReact(new Request('http://internal/discord-react', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'discord_pin': {
                return await this.characterRegistry.handleDiscordPin(new Request('http://internal/discord-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'discord_thread': {
                return await this.characterRegistry.handleDiscordThread(new Request('http://internal/discord-thread', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            case 'visit_world': {
                return await this.characterRegistry.handleWorldVisit(new Request('http://internal/world-visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, characterName })
                }));
            }
            default:
                throw new Error(`Unknown action type: ${action.action}`);
        }
    }

    async checkAndExecutePlans() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const plansList = await this.env.CHARACTER_PLANS.list({ prefix: `plan_${today}` });
            
            for (const plan of plansList.keys) {
                const planData = await this.env.CHARACTER_PLANS.get(plan.name);
                if (!planData) continue;

                const parsedPlan = JSON.parse(planData);
                const now = new Date();

                for (const action of parsedPlan.plan) {
                    const actionTime = new Date(action.time);
                    
                    if (action.status === 'pending' && actionTime <= now) {
                        try {
                            await this.executeAction(parsedPlan.userId, parsedPlan.characterName, action);
                            action.status = 'pending_verification';
                            action.executedAt = now.toISOString();
                        } catch (error) {
                            console.error('Action execution failed:', error);
                            action.status = 'failed';
                            action.error = error.message;
                        }
                    }
                }

                parsedPlan.lastChecked = now.toISOString();
                await this.env.CHARACTER_PLANS.put(plan.name, JSON.stringify(parsedPlan));
            }
        } catch (error) {
            console.error('Plan execution error:', error);
        }
    }

    async generatePlan(request) {
        try {
            const { userId, characterName } = await request.json();
            
            const character = await this.characterRegistry.getCharacter(userId, characterName);
            if (!character) {
                throw new Error('Character not found');
            }

            const secrets = await this.characterRegistry.getCharacterSecrets(character.id);
            if (!secrets) {
                throw new Error('Character secrets not found');
            }

            const systemMessage = `You are ${character.name}. ${character.bio}

Key Character Traits:
${character.adjectives.map(adj => `- ${adj}`).join('\n')}

Style Guidelines:
${character.style?.all.map(style => `- ${style}`).join('\n')}
${character.style?.post.map(style => `- ${style}`).join('\n')}

Available Actions:
${this.availableActions.map(action => `- ${action.type}: ${action.description}`).join('\n')}

Task: Generate a plan for today's activities. Consider your character's personality, interests, and typical behavior patterns.
Create a schedule of 3-5 activities from the available actions above.
Each activity should have a specific UTC time to perform it.

IMPORTANT: Use ONLY these exact action types in your response:
- "tweet"
- "tweet_with_media"
- "like"
- "reply"
- "retweet"
- "telegram_message"
- "telegram_reply"
- "telegram_edit"
- "telegram_pin"
- "discord_message"
- "discord_reply"
- "discord_react"
- "discord_pin"
- "discord_thread"
- "visit_world"

Respond with a JSON object in this format:
{
    "plan": [
        {
            "time": "UTC timestamp in ISO format",
            "action": "one of the exact action types listed above",
            "reason": "why this action at this time makes sense for the character",
            "status": "pending"
        }
    ]
}

Make sure the times are spread throughout the day and make sense for the character's timezone and habits.`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 25000);

            try {
                const response = await fetch(
                    `https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.CF_GATEWAY_ID}/openai/chat/completions`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [
                                { role: "system", content: systemMessage },
                                { role: "user", content: "Generate a plan for today's activities." }
                            ],
                            max_tokens: 500,
                            temperature: 0.7,
                            presence_penalty: 0.6
                        }),
                        signal: controller.signal
                    }
                );

                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`API call failed: ${response.status}`);
                }

                const result = await response.json();
                let plan = JSON.parse(result.choices[0].message.content);

                // Validate and fix the plan
                plan.plan = plan.plan.map(action => {
                    if (!this.availableActions.some(a => a.type === action.action)) {
                        // Map conversational actions to correct types
                        switch (action.action.toLowerCase()) {
                            case 'post a tweet': return { ...action, action: 'tweet' };
                            case 'post a tweet with media': 
                            case 'post a tweet with an image': 
                            case 'share an image': 
                                return { ...action, action: 'tweet_with_media' };
                            case 'like a tweet': 
                            case 'like a tweet from someone i follow': 
                                return { ...action, action: 'like' };
                            case 'reply to a tweet': 
                            case 'reply to someone': 
                            case 'reply to a tweet from someone i follow': 
                                return { ...action, action: 'reply' };
                            case 'retweet': 
                            case 'retweet something': 
                            case 'retweet something interesting': 
                                return { ...action, action: 'retweet' };
                            case 'send a telegram message':
                            case 'send message':
                            case 'send a message':
                                return { ...action, action: 'telegram_message' };
                            case 'reply on telegram':
                            case 'reply to telegram':
                                return { ...action, action: 'telegram_reply' };
                            case 'edit telegram message':
                            case 'edit message':
                                return { ...action, action: 'telegram_edit' };
                            case 'pin message':
                            case 'pin telegram message':
                                return { ...action, action: 'telegram_pin' };
                            case 'send discord message':
                            case 'message on discord':
                                return { ...action, action: 'discord_message' };
                            case 'reply on discord':
                            case 'discord reply':
                                return { ...action, action: 'discord_reply' };
                            case 'react':
                            case 'add reaction':
                            case 'react to message':
                                return { ...action, action: 'discord_react' };
                            case 'pin discord message':
                                return { ...action, action: 'discord_pin' };
                            case 'create thread':
                            case 'start thread':
                            case 'join thread':
                                return { ...action, action: 'discord_thread' };
                            case 'visit a world':
                            case 'explore world':
                            case 'enter world':
                            case 'explore virtual world':
                                return { ...action, action: 'visit_world' };
                            default: throw new Error(`Invalid action type: ${action.action}`);
                        }
                    }
                    return action;
                });

                const planWithMeta = {
                    ...plan,
                    characterId: character.id,
                    characterName: character.name,
                    userId: userId,
                    generatedAt: new Date().toISOString(),
                    lastChecked: new Date().toISOString()
                };

                const planKey = await this.getPlanKey(character.id);
                await this.env.CHARACTER_PLANS.put(planKey, JSON.stringify(planWithMeta));
                this.planStore.set(planKey, planWithMeta);

                return new Response(JSON.stringify(planWithMeta), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    }
                });

            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('API request timed out after 25 seconds');
                }
                throw error;
            } finally {
                clearTimeout(timeout);
            }
        } catch (error) {
            console.error('Generate plan error:', error);
            return new Response(JSON.stringify({
                error: 'Failed to generate plan',
                details: error.message
            }), {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            });
        }
    }
} 