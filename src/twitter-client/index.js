import { Scraper } from 'agent-twitter-client';

export class TwitterClient {
    constructor(runtime) {
        this.runtime = runtime;
        this.scraper = new Scraper({
            useV2: false,
            transform: {
                request: async (input, init) => {
                    const { credentials, ...safeInit } = init || {};
                    return [input, safeInit];
                }
            }
        });
        this.isInitialized = false;
        this.bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
        this.guestToken = null;
        this.cookieJar = null;
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            if (this.runtime.settings.TWITTER_COOKIES) {
                let cookieData;
                try {
                    // Handle potential double-stringified JSON
                    cookieData = JSON.parse(this.runtime.settings.TWITTER_COOKIES);

                    if (typeof cookieData === 'string') {
                        cookieData = JSON.parse(cookieData);
                    }

                    if (!Array.isArray(cookieData)) {
                        throw new Error('Cookie data is not in the expected format');
                    }

                    // Create Cookie objects directly from the parsed data
                    this.cookies = cookieData.map(cookie => ({
                        key: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain || '.twitter.com'
                    }));

                    // Extract important tokens
                    const csrfCookie = cookieData.find(c => c.name === 'ct0');
                    const authCookie = cookieData.find(c => c.name === 'auth_token');
                    const guestCookie = cookieData.find(c => c.name === 'guest_id');

                    if (!csrfCookie || !authCookie) {
                        throw new Error('Missing required cookies');
                    }

                    this.csrfToken = csrfCookie.value;
                    this.authToken = authCookie.value;
                    if (guestCookie) {
                        this.guestToken = guestCookie.value.replace('v1%3A', '');
                    }

                    this.isInitialized = true;
                    return;

                } catch (parseError) {
                    console.error("Debug - Parse error details:", {
                        error: parseError,
                        rawCookies: this.runtime.settings.TWITTER_COOKIES,
                        cookieType: typeof this.runtime.settings.TWITTER_COOKIES
                    });
                    throw new Error(`Failed to parse cookie data: ${parseError.message}`);
                }
            }

            throw new Error('No cookies provided');
        } catch (error) {
            console.error('Twitter initialization error:', {
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            });
            throw error;
        }
    }

    async sendTweet(text, replyToId = null) {
        await this.initialize();

        try {
            // Construct cookie string directly from stored cookies
            const cookieString = this.cookies
                .map(cookie => `${cookie.key}=${cookie.value}`)
                .join('; ');


            const headers = new Headers({
                'authorization': `Bearer ${this.bearerToken}`,
                'cookie': cookieString,
                'content-type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36',
                'x-guest-token': this.guestToken,
                'x-twitter-auth-type': 'OAuth2Client',
                'x-twitter-active-user': 'yes',
                'x-twitter-client-language': 'en',
                'x-csrf-token': this.csrfToken
            });

            const variables = {
                tweet_text: text,
                dark_request: false,
                media: {
                    media_entities: [],
                    possibly_sensitive: false
                },
                semantic_annotation_ids: []
            };

            if (replyToId) {
                variables.reply = { in_reply_to_tweet_id: replyToId };
            }

            const requestBody = {
                variables,
                features: {
                    interactive_text_enabled: true,
                    longform_notetweets_inline_media_enabled: false,
                    responsive_web_text_conversations_enabled: false,
                    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
                    vibe_api_enabled: false,
                    rweb_lists_timeline_redesign_enabled: true,
                    responsive_web_graphql_exclude_directive_enabled: true,
                    verified_phone_label_enabled: false,
                    creator_subscriptions_tweet_preview_api_enabled: true,
                    responsive_web_graphql_timeline_navigation_enabled: true,
                    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
                    tweetypie_unmention_optimization_enabled: true,
                    responsive_web_edit_tweet_api_enabled: true,
                    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
                    view_counts_everywhere_api_enabled: true,
                    longform_notetweets_consumption_enabled: true,
                    tweet_awards_web_tipping_enabled: false,
                    freedom_of_speech_not_reach_fetch_enabled: true,
                    standardized_nudges_misinfo: true,
                    longform_notetweets_rich_text_read_enabled: true,
                    responsive_web_enhance_cards_enabled: false,
                    subscriptions_verification_info_enabled: true,
                    subscriptions_verification_info_reason_enabled: true,
                    subscriptions_verification_info_verified_since_enabled: true,
                    super_follow_badge_privacy_enabled: false,
                    super_follow_exclusive_tweet_notifications_enabled: false,
                    super_follow_tweet_api_enabled: false,
                    super_follow_user_api_enabled: false,
                    android_graphql_skip_api_media_color_palette: false,
                    creator_subscriptions_subscription_count_enabled: false,
                    blue_business_profile_image_shape_enabled: false,
                    unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
                    rweb_video_timestamps_enabled: false,
                    c9s_tweet_anatomy_moderator_badge_enabled: false,
                    responsive_web_twitter_article_tweet_consumption_enabled: false
                },
                fieldToggles: {}
            };

            const response = await fetch(
                'https://twitter.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet',
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody)
                }
            );

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Tweet failed: ${responseText}`);
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error("Debug - JSON Parse Error:", parseError);
                throw new Error(`Failed to parse response: ${responseText}`);
            }

            return result;

        } catch (error) {
            console.error('Error sending tweet:', {
                message: error.message,
                stack: error.stack,
                runtime: {
                    hasSettings: !!this.runtime.settings,
                    hasCookies: !!this.runtime.settings?.TWITTER_COOKIES,
                    isInitialized: this.isInitialized,
                    hasCSRF: !!this.csrfToken,
                    hasGuestToken: !!this.guestToken,
                    hasCookieJar: !!this.cookieJar
                }
            });
            throw error;
        }
    }

    // Add to TwitterClient class in your worker

    async getNotifications(limit = 20) {
        await this.initialize();
    
        try {
            const cookieString = this.cookies
                .map(cookie => `${cookie.key}=${cookie.value}`)
                .join('; ');
    
            const headers = new Headers({
                'authorization': `Bearer ${this.bearerToken}`,
                'cookie': cookieString,
                'content-type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36',
                'x-guest-token': this.guestToken,
                'x-twitter-auth-type': 'OAuth2Client',
                'x-twitter-active-user': 'yes',
                'x-twitter-client-language': 'en',
                'x-csrf-token': this.csrfToken
            });
    
            const response = await fetch(
                'https://twitter.com/i/api/2/notifications/all.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1', {
                    method: 'GET',
                    headers
                }
            );
    
            const responseText = await response.text();
    
            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.status} ${responseText}`);
            }
    
            const data = JSON.parse(responseText);
            const notifications = data.globalObjects?.tweets || [];
    
            return Object.values(notifications).map(tweet => ({
                id: tweet.id_str,
                text: tweet.text || tweet.full_text,
                user: {
                    id: tweet.user_id_str,
                    name: data.globalObjects.users[tweet.user_id_str]?.name,
                    username: data.globalObjects.users[tweet.user_id_str]?.screen_name,
                    profileImage: data.globalObjects.users[tweet.user_id_str]?.profile_image_url_https
                },
                createdAt: tweet.created_at,
                inReplyToStatusId: tweet.in_reply_to_status_id_str,
                isRetweet: !!tweet.retweeted_status,
                isReply: !!tweet.in_reply_to_status_id_str,
                metrics: {
                    retweets: tweet.retweet_count,
                    likes: tweet.favorite_count,
                    replies: tweet.reply_count || 0
                }
            }));
    
        } catch (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }
    }
    
    // async getNotifications(maxResults = 20) {
    //     await this.initialize();
    //     try {
    //         const endpoint = `https://api.twitter.com/2/tweets/search/recent`;
    //         const params = new URLSearchParams({
    //             query: `@${this.runtime.settings.TWITTER_USERNAME}`,
    //             max_results: maxResults.toString(),
    //             'tweet.fields': 'created_at,author_id,conversation_id,in_reply_to_user_id,referenced_tweets',
    //             expansions: 'author_id,referenced_tweets.id',
    //             'user.fields': 'name,username,profile_image_url'
    //         });

    //         const response = await fetch(`${endpoint}?${params}`, {
    //             headers: {
    //                 'Authorization': `Bearer ${this.runtime.settings.TWITTER_BEARER_TOKEN}`,
    //                 'x-guest-token': this.runtime.settings.TWITTER_GUEST_TOKEN,
    //                 'Cookie': this.runtime.settings.TWITTER_COOKIES
    //             }
    //         });

    //         if (!response.ok) {
    //             throw new Error(`Failed to fetch notifications: ${response.statusText}`);
    //         }

    //         const data = await response.json();
    //         return data.data?.map(tweet => ({
    //             id: tweet.id,
    //             text: tweet.text,
    //             user: {
    //                 id: tweet.author_id,
    //                 username: data.includes.users.find(u => u.id === tweet.author_id)?.username,
    //                 name: data.includes.users.find(u => u.id === tweet.author_id)?.name,
    //                 profileImage: data.includes.users.find(u => u.id === tweet.author_id)?.profile_image_url
    //             },
    //             createdAt: tweet.created_at,
    //             inReplyToId: tweet.referenced_tweets?.find(ref => ref.type === 'replied_to')?.id,
    //             conversationId: tweet.conversation_id,
    //             isRetweet: tweet.referenced_tweets?.some(ref => ref.type === 'retweeted'),
    //             isReply: Boolean(tweet.in_reply_to_user_id)
    //         })) || [];
    //     } catch (error) {
    //         console.error('Error fetching notifications:', error);
    //         throw error;
    //     }
    // }

    //     async likeTweet(tweetId) {
    //         await this.initialize();
    //         try {
    //             if (this.runtime.settings.TWITTER_DRY_RUN === 'true') {
    //                 console.log('DRY RUN: Would have liked tweet:', tweetId);
    //                 return { success: true, isDryRun: true };
    //             }

    //             const endpoint = `https://api.twitter.com/2/users/${this.runtime.settings.TWITTER_USER_ID}/likes`;
    //             const response = await fetch(endpoint, {
    //                 method: 'POST',
    //                 headers: {
    //                     'Authorization': `Bearer ${this.runtime.settings.TWITTER_BEARER_TOKEN}`,
    //                     'x-guest-token': this.runtime.settings.TWITTER_GUEST_TOKEN,
    //                     'Cookie': this.runtime.settings.TWITTER_COOKIES,
    //                     'Content-Type': 'application/json'
    //                 },
    //                 body: JSON.stringify({ tweet_id: tweetId })
    //             });

    //             if (!response.ok) {
    //                 throw new Error(`Failed to like tweet: ${response.statusText}`);
    //             }

    //             return { success: true };
    //         } catch (error) {
    //             console.error('Error liking tweet:', error);
    //             throw error;
    //         }
    //     }

    //     async retweet(tweetId, quoteText = null) {
    //         await this.initialize();
    //         try {
    //             if (this.runtime.settings.TWITTER_DRY_RUN === 'true') {
    //                 console.log('DRY RUN: Would have retweeted:', tweetId, 'with text:', quoteText);
    //                 return { success: true, isDryRun: true };
    //             }

    //             const endpoint = 'https://api.twitter.com/2/tweets';
    //             const payload = quoteText ? {
    //                 text: quoteText,
    //                 quote_tweet_id: tweetId
    //             } : {
    //                 tweet_id: tweetId
    //             };

    //             const response = await fetch(endpoint, {
    //                 method: 'POST',
    //                 headers: {
    //                     'Authorization': `Bearer ${this.runtime.settings.TWITTER_BEARER_TOKEN}`,
    //                     'x-guest-token': this.runtime.settings.TWITTER_GUEST_TOKEN,
    //                     'Cookie': this.runtime.settings.TWITTER_COOKIES,
    //                     'Content-Type': 'application/json'
    //                 },
    //                 body: JSON.stringify(payload)
    //             });

    //             if (!response.ok) {
    //                 throw new Error(`Failed to retweet: ${response.statusText}`);
    //             }

    //             return { success: true };
    //         } catch (error) {
    //             console.error('Error retweeting:', error);
    //             throw error;
    //         }
    //     }
}

export const TwitterClientInterface = {
    async start(runtime) {
        const client = new TwitterClient(runtime);
        await client.initialize();
        return client;
    }
};

export default TwitterClientInterface;