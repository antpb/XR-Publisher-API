import { Scraper } from 'agent-twitter-client';
import { Cookie } from 'tough-cookie';

export class TwitterClient {
    constructor(runtime) {
        this.runtime = runtime;
        this.scraper = new Scraper({
            transform: {
                request: async (input, init) => {
                    const { credentials, ...safeInit } = init || {};
                    return [input, safeInit];
                }
            }
        });
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            console.log("runtime settings", JSON.stringify(this.runtime.settings));
            if (this.runtime.settings.TWITTER_COOKIES) {
                const cookieData = JSON.parse(this.runtime.settings.TWITTER_COOKIES);
                const cookies = cookieData.map(cookie => {
                    return new Cookie({
                        key: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: '/',
                        secure: true,
                        httpOnly: true
                    });
                });
    
                await this.scraper.setCookies(cookies);
                this.isInitialized = true;
                return;  // Return early, don't try to login if we have cookies
            }
            
            // Only try to login if we don't have cookies
            await this.scraper.login(
                this.runtime.settings.TWITTER_USERNAME,
                this.runtime.settings.TWITTER_PASSWORD,
                this.runtime.settings.TWITTER_EMAIL
            );
    
            this.isInitialized = true;
        } catch (error) {
            console.error('Twitter initialization error:', error);
            throw error;
        }
    }
    
    async sendTweet(text, replyToId = null) {
        await this.initialize();
        try {
            if (this.runtime.settings.TWITTER_DRY_RUN === 'true') {
                console.log('DRY RUN: Would have posted tweet:', text);
                return {
                    success: true,
                    text,
                    id: 'dry-run-' + Date.now(),
                    isDryRun: true
                };
            }

            // Use the scraper's method
            const result = await this.scraper.sendTweetV2(text, replyToId);
            return {
                success: true,
                text,
                id: result.id,
                url: `https://twitter.com/${this.runtime.settings.TWITTER_USERNAME}/status/${result.id}`
            };
        } catch (error) {
            console.error('Error sending tweet:', error);
            throw error;
        }
    }



    async getNotifications(maxResults = 20) {
        await this.initialize();
        try {
            const endpoint = `https://api.twitter.com/2/tweets/search/recent`;
            const params = new URLSearchParams({
                query: `@${this.runtime.settings.TWITTER_USERNAME}`,
                max_results: maxResults.toString(),
                'tweet.fields': 'created_at,author_id,conversation_id,in_reply_to_user_id,referenced_tweets',
                expansions: 'author_id,referenced_tweets.id',
                'user.fields': 'name,username,profile_image_url'
            });

            const response = await fetch(`${endpoint}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.runtime.settings.TWITTER_BEARER_TOKEN}`,
                    'x-guest-token': this.runtime.settings.TWITTER_GUEST_TOKEN,
                    'Cookie': this.runtime.settings.TWITTER_COOKIES
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data?.map(tweet => ({
                id: tweet.id,
                text: tweet.text,
                user: {
                    id: tweet.author_id,
                    username: data.includes.users.find(u => u.id === tweet.author_id)?.username,
                    name: data.includes.users.find(u => u.id === tweet.author_id)?.name,
                    profileImage: data.includes.users.find(u => u.id === tweet.author_id)?.profile_image_url
                },
                createdAt: tweet.created_at,
                inReplyToId: tweet.referenced_tweets?.find(ref => ref.type === 'replied_to')?.id,
                conversationId: tweet.conversation_id,
                isRetweet: tweet.referenced_tweets?.some(ref => ref.type === 'retweeted'),
                isReply: Boolean(tweet.in_reply_to_user_id)
            })) || [];
        } catch (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }
    }

    async likeTweet(tweetId) {
        await this.initialize();
        try {
            if (this.runtime.settings.TWITTER_DRY_RUN === 'true') {
                console.log('DRY RUN: Would have liked tweet:', tweetId);
                return { success: true, isDryRun: true };
            }

            const endpoint = `https://api.twitter.com/2/users/${this.runtime.settings.TWITTER_USER_ID}/likes`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.runtime.settings.TWITTER_BEARER_TOKEN}`,
                    'x-guest-token': this.runtime.settings.TWITTER_GUEST_TOKEN,
                    'Cookie': this.runtime.settings.TWITTER_COOKIES,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tweet_id: tweetId })
            });

            if (!response.ok) {
                throw new Error(`Failed to like tweet: ${response.statusText}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error liking tweet:', error);
            throw error;
        }
    }

    async retweet(tweetId, quoteText = null) {
        await this.initialize();
        try {
            if (this.runtime.settings.TWITTER_DRY_RUN === 'true') {
                console.log('DRY RUN: Would have retweeted:', tweetId, 'with text:', quoteText);
                return { success: true, isDryRun: true };
            }

            const endpoint = 'https://api.twitter.com/2/tweets';
            const payload = quoteText ? {
                text: quoteText,
                quote_tweet_id: tweetId
            } : {
                tweet_id: tweetId
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.runtime.settings.TWITTER_BEARER_TOKEN}`,
                    'x-guest-token': this.runtime.settings.TWITTER_GUEST_TOKEN,
                    'Cookie': this.runtime.settings.TWITTER_COOKIES,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Failed to retweet: ${response.statusText}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error retweeting:', error);
            throw error;
        }
    }
}

export const TwitterClientInterface = {
    async start(runtime) {
        const client = new TwitterClient(runtime);
        await client.initialize();
        return client;
    }
};

export default TwitterClientInterface;