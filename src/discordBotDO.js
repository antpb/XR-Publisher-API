import { verifyKey } from 'discord-interactions';
import { DurableObject } from "cloudflare:workers";

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Discord-Application-Id, cf-discord-token',
    };
}

export class DiscordBotDO extends DurableObject {
    constructor(state, env) {
        super(state, env);
        this.state = state;     // Store the state object
        this.env = env;
        this.clients = new Map();
        this.publicKey = null;
        this.token = null;
        this.applicationId = null;
    }
    async initializeState() {
        // Add debug logging

        const keys = await this.state.storage.list();

        if (!this.publicKey) {
            this.publicKey = await this.state.storage.get('publicKey');
        }
        if (!this.token) {
            this.token = await this.state.storage.get('token');
        }
        if (!this.applicationId) {
            this.applicationId = await this.state.storage.get('applicationId');
        }
    }

    async fetch(request) {
        await this.initializeState();  // This should be enough to get publicKey

        const url = new URL(request.url);
        const path = url.pathname;


        // Handle WebSocket connections
        const upgradeHeader = request.headers.get("Upgrade");
        if (upgradeHeader === "websocket") {
            return await this.handleWebSocket(request.clone());
        }

        try {
            if (path === '/check') {
                return await this.handleCheck();
            }

            if (path === '/init') {
                return await this.handleInit(request.clone());
            }

            if (path === '/interactions') {
                return await this.handleInteractions(request.clone());
            }

            return this.handleHttpRequest(request.clone());
        } catch (err) {
            console.error('DO fetch error:', err);
            return new Response(err.message, { status: 500 });
        }
    }

    async handleCheck() {
        // Make sure we're initialized
        await this.initializeState();

        try {
            if (!this.token) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'No Discord token configured'
                }), {
                    status: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        'Content-Type': 'application/json'
                    }
                });
            }

            const response = await fetch('https://discord.com/api/v10/applications/@me', {
                headers: {
                    'Authorization': `Bot ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            return new Response(JSON.stringify({
                success: response.ok,
                message: response.ok ? 'Discord configuration valid' : 'Discord configuration invalid'
            }), {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Content-Type': 'application/json'
                }
            });
        } catch (err) {
            console.error('Discord check error:', err);
            return new Response(JSON.stringify({
                success: false,
                message: 'Failed to validate Discord configuration',
                error: err.message
            }), {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    async handleInit(request) {
        try {
            const data = await request.json();

            // Store in Durable Object storage
            await Promise.all([
                this.state.storage.put('publicKey', data.publicKey),
                this.state.storage.put('token', data.token),
                this.state.storage.put('applicationId', data.applicationId)
            ]);

            // Update instance variables
            this.publicKey = data.publicKey;
            this.token = data.token;
            this.applicationId = data.applicationId;

            // Register slash command
            await this.createCommand(data.token, data.applicationId);

            return new Response(JSON.stringify({
                success: true,
                message: `Please set your Interactions Endpoint URL to: https://discord-handler.sxp.digital/interactions`
            }), {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Init error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    async createCommand(token, applicationId) {
        try {
            const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: 'hey',
                    description: 'Chat with the AI character',
                    options: [{
                        name: 'message',
                        description: 'Your message to the character',
                        type: 3, // STRING type
                        required: true
                    }]
                }),
            });

            if (!response.ok) {
                throw new Error(`Error creating command: ${response.statusText}`);
            }
            return response.json();
        } catch (err) {
            console.error('Failed to register slash command:', err);
        }
    }

    // Then, modify the handleApplicationCommand method to handle the hey command
    async handleApplicationCommand(body) {
        if (body.data.name === 'hey') {
            try {
                const message = body.data.options[0].value;
                const channelId = body.channel_id;
                const userId = body.member.user.id;
                const userName = body.member.user.username;

                // Get the character registry DO
                const id = this.env.CHARACTER_REGISTRY.idFromName("global");
                const registry = this.env.CHARACTER_REGISTRY.get(id);

                // Create a unique room ID for this Discord channel
                const roomId = `discord-${channelId}`;

                // Initialize or get existing session
                let session;
                try {
                    // Try to find existing session for this channel
                    const sessionResponse = await registry.fetch(new Request('http://internal/initialize-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            author: 'antpb',
                            slug: 'pixel',
                            roomId: roomId
                        })
                    }));

                    if (!sessionResponse.ok) {
                        throw new Error('Failed to initialize session');
                    }

                    session = await sessionResponse.json();
                } catch (error) {
                    console.error('Session initialization error:', error);
                    return new Response(JSON.stringify({
                        type: 4,
                        data: {
                            content: "I'm sorry, I couldn't initialize the chat session. Please try again later."
                        }
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Send message to character
                const messageResponse = await registry.fetch(new Request('http://internal/send-chat-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: session.sessionId,
                        message: message,
                        nonce: session.nonce,
                        userId: userId,
                        userName: userName,
                        roomId: roomId
                    })
                }));

                if (!messageResponse.ok) {
                    throw new Error('Failed to process message');
                }

                const response = await messageResponse.json();

                // Reply with character's response
                return new Response(JSON.stringify({
                    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
                    data: {
                        content: response.text
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });

            } catch (error) {
                console.error('Error handling hey command:', error);
                return new Response(JSON.stringify({
                    type: 4,
                    data: {
                        content: "I apologize, but I encountered an error processing your message."
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Default response for other commands
        return new Response(JSON.stringify({
            type: 4,
            data: {
                content: `Received command: ${body.data.name}`
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Add this helper method to maintain session state
    async getOrCreateSession(channelId, registry) {
        const roomId = `discord-${channelId}`;
        const sessionKey = `session:${roomId}`;

        // Try to get existing session from storage
        let session = await this.state.storage.get(sessionKey);

        if (!session) {
            // Initialize new session
            const response = await registry.fetch(new Request('http://internal/initialize-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    author: 'antpb', // Default author
                    slug: 'eliza', // Default character
                    roomId: roomId
                })
            }));

            if (!response.ok) {
                throw new Error('Failed to initialize session');
            }

            session = await response.json();

            // Store session data
            await this.state.storage.put(sessionKey, session);
        }

        return session;
    }

    async handleInteractions(request) {
        const signature = request.headers.get('x-signature-ed25519');
        const timestamp = request.headers.get('x-signature-timestamp');
        const bodyText = await request.text();
        
        if (!signature || !timestamp || !this.publicKey) {
            console.error('Missing verification parameters:', { signature, timestamp, hasPublicKey: !!this.publicKey });
            return new Response('Invalid request signature', { status: 401 });
        }
    
        try {
    
            // Add await here
            const isValidRequest = await verifyKey(
                bodyText,
                signature,
                timestamp,
                this.publicKey
            );
    
    
            if (!isValidRequest) {
                console.error('Invalid signature verification');
                return new Response('Invalid request signature', { status: 401 });
            }
    
            const body = JSON.parse(bodyText);
            
            if (body.type === 1) { // PING
                return new Response(JSON.stringify({ type: 1 }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else if (body.type === 2) { // APPLICATION_COMMAND
                return await this.handleApplicationCommand(body);
            } else if (body.type === 3) { // MESSAGE_COMPONENT
                return await this.handleMessageComponent(body);
            } else if (body.type === 4) { // APPLICATION_COMMAND_AUTOCOMPLETE
                return await this.handleAutocomplete(body);
            } else if (body.type === 5) { // MODAL_SUBMIT
                return await this.handleModalSubmit(body);
            }
    
            // If we don't recognize the type, return an error
            return new Response(JSON.stringify({
                type: 4,
                data: {
                    content: "Sorry, I don't know how to handle that type of interaction."
                }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
    
        } catch (error) {
            console.error('Interaction handling error:', error);
            return new Response(JSON.stringify({
                type: 4,
                data: {
                    content: "Sorry, something went wrong while processing your request."
                }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleWebSocket(request) {
        try {
            const protocol = request.headers.get('Sec-WebSocket-Protocol');
            if (!protocol || !protocol.startsWith('cf-discord-token.')) {
                throw new Error('Invalid WebSocket protocol');
            }

            const token = protocol.split('.')[1];
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            const clientId = crypto.randomUUID();

            const clientInfo = {
                ws: server,
                token: token,
                clientId: clientId,
                pollInterval: null
            };

            server.addEventListener("message", async (msg) => {
                try {
                    const data = JSON.parse(msg.data);
                    if (data.type === "init") {
                        clientInfo.channelId = data.channelId;
                        this.setupMessagePolling(clientInfo);
                        server.send(JSON.stringify({
                            type: "connected",
                            clientId: clientId
                        }));
                    }
                } catch (err) {
                    console.error('Message processing error:', err);
                }
            });

            await this.state.acceptWebSocket(server);

            return new Response(null, {
                status: 101,
                webSocket: client,
                headers: {
                    'Upgrade': 'websocket',
                    'Connection': 'Upgrade',
                    'Sec-WebSocket-Protocol': protocol
                }
            });
        } catch (err) {
            console.error('WebSocket setup error:', err);
            return new Response(err.stack, { status: 500 });
        }
    }

    setupMessagePolling(clientInfo) {
        clientInfo.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(
                    `https://discord.com/api/v10/channels/${clientInfo.channelId}/messages`,
                    {
                        headers: {
                            'Authorization': `Bot ${clientInfo.token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (!response.ok) {
                    console.error('Discord API error:', await response.text());
                    return;
                }

                const messages = await response.json();
                const relevantMessages = messages.filter(msg =>
                    !msg.author.bot && (
                        msg.mentions?.some(mention => mention.id === this.applicationId) ||
                        msg.content.includes(`<@${this.applicationId}>`)
                    )
                );

                if (relevantMessages.length > 0) {
                    clientInfo.ws.send(JSON.stringify({
                        type: "messages",
                        messages: relevantMessages
                    }));
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 2000);
    }

    async handleHttpRequest(request) {
        const response = await fetch(`https://discord.com/api/v10${new URL(request.url).pathname}`, {
            method: request.method,
            headers: {
                ...request.headers,
                "Content-Type": "application/json"
            },
            body: request.method !== "GET" ? await request.text() : undefined
        });

        return new Response(await response.text(), {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
                ...corsHeaders()
            }
        });
    }

    // Helper methods for different interaction types
    // handleApplicationCommand(body) {
    //     return new Response(JSON.stringify({
    //         type: 4,
    //         data: {
    //             content: `Received command: ${body.data.name}`
    //         }
    //     }), {
    //         headers: { 'Content-Type': 'application/json' }
    //     });
    // }

    handleMessageComponent(body) {
        return new Response(JSON.stringify({
            type: 4,
            data: {
                content: `Component interaction received: ${body.data.custom_id}`
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    handleAutocomplete(body) {
        return new Response(JSON.stringify({
            type: 8,
            data: {
                choices: []
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    handleModalSubmit(body) {
        return new Response(JSON.stringify({
            type: 4,
            data: {
                content: `Modal submission received: ${body.data.custom_id}`
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async sendDiscordMessage(clientInfo, data) {
        const response = await fetch(
            `https://discord.com/api/v10/channels/${clientInfo.channelId}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bot ${clientInfo.token}`,
                    "Content-Type": "application/json",
                    "X-Discord-Intents": "4096"
                },
                body: JSON.stringify({
                    content: data.content,
                    embeds: data.embed ? [data.embed] : []
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Discord API error: ${response.status}`);
        }

        const messageData = await response.json();
        clientInfo.ws.send(JSON.stringify({
            type: "message_sent",
            message: messageData
        }));
    }
}

