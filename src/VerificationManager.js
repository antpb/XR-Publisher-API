export class VerificationManager {
    constructor(env, characterRegistry, userAuthDO) {
        this.env = env;
        this.characterRegistry = characterRegistry;
        this.userAuthDO = userAuthDO;
    }

    async verifyActionViaTelegram(userId, characterName, action, planId, actionIndex) {
        try {
            // Get user's settings
            const userSettings = await this.userAuthDO.getUserSettings(userId);
            if (!userSettings || !userSettings.telegram_chat_id) {
                throw new Error('User has not configured Telegram notifications');
            }

            // Check if auto-approve is enabled for low-risk actions
            if (userSettings.auto_approve_low_risk && this.isLowRiskAction(action)) {
                return {
                    status: 'approved',
                    auto_approved: true,
                    message: 'Action auto-approved based on user settings'
                };
            }

            const verificationToken = crypto.randomUUID();
            const verificationKey = `verification_${verificationToken}`;
            
            await this.env.CHARACTER_PLANS.put(verificationKey, JSON.stringify({
                planId,
                actionIndex,
                userId,
                action,
                status: 'awaiting_approval',
                createdAt: new Date().toISOString()
            }), { expirationTtl: 86400 });

            const message = this.formatVerificationMessage(action, characterName, verificationToken);
            
            await this.characterRegistry.handleTelegramMessage(new Request('http://internal/telegram-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: userSettings.telegram_chat_id,
                    message: message
                })
            }));

            return {
                status: 'awaiting_approval',
                verificationToken
            };
        } catch (error) {
            console.error('Verification request failed:', error);
            throw error;
        }
    }

    isLowRiskAction(action) {
        const lowRiskActions = ['like', 'visit_world'];
        return lowRiskActions.includes(action.type);
    }

    formatVerificationMessage(action, characterName, token) {
        const baseUrl = 'https://your-worker.dev/api/character/verify-action';
        const verificationUrl = `${baseUrl}?token=${token}`;
        
        return `🤖 Action Verification Needed\n\n` +
               `Character: ${characterName}\n` +
               `Action Type: ${action.type}\n` +
               `Details: ${this.formatActionDetails(action)}\n\n` +
               `✅ Approve: ${verificationUrl}\n` +
               `❌ Deny: ${verificationUrl}&deny=true`;
    }

    formatActionDetails(action) {
        switch (action.type) {
            case 'tweet':
                return `Tweet Content:\n${action.content}`;
            case 'tweet_with_media':
                return `Tweet with Media:\n${action.content}`;
            case 'discord_message':
                return `Discord Message:\n${action.content}`;
            case 'telegram_message':
                return `Telegram Message:\n${action.content}`;
            default:
                return `Action: ${action.type}`;
        }
    }

    async handleVerifyAction(token, isDenied = false) {
        try {
            const verificationKey = `verification_${token}`;
            const verificationData = await this.env.CHARACTER_PLANS.get(verificationKey, { type: "json" });
            
            if (!verificationData) {
                throw new Error('Verification token not found or expired');
            }

            // Get the plan
            const planKey = await this.getPlanKey(verificationData.characterId);
            const currentPlan = await this.env.CHARACTER_PLANS.get(planKey, { type: "json" });
            
            if (!currentPlan) {
                throw new Error('Plan not found');
            }

            const action = currentPlan.plan[verificationData.actionIndex];
            if (!action || action.verificationToken !== token) {
                throw new Error('Action not found or token mismatch');
            }

            // Update action status based on verification result
            action.status = isDenied ? 'denied' : 'approved';
            action.verifiedAt = new Date().toISOString();
            delete action.verificationToken;

            // Update the plan in KV
            await this.env.CHARACTER_PLANS.put(planKey, JSON.stringify(currentPlan));
            
            // Clean up verification data
            await this.env.CHARACTER_PLANS.delete(verificationKey);

            return {
                success: true,
                status: action.status,
                message: isDenied ? 'Action was denied' : 'Action was approved'
            };
        } catch (error) {
            console.error('Action verification failed:', error);
            throw error;
        }
    }

    async getPlanKey(characterId, date) {
        const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        return `plan_${characterId}_${dateStr}`;
    }
} 