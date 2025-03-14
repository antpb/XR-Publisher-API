// Import necessary dependencies
import { Buffer } from 'buffer';
import generateWorldHTML from './worldTemplate';
import generateAuthorHTML from './authorTemplate';
import generateSearchHTML from './searchTemplate';
import generateHomeHTML from './homeTemplate';
import generateRegisterHTML from './registrationTemplate';
import generateRequestKeyRollHTML from './rollKeyTemplate';
import generateCharacterHTML from './characterTemplate';

// import generateCharacterDirectoryHTML from './characterDirectoryTemplate';

import { UserAuthDO } from './userAuthDO';
import { WorldRegistryDO } from './WorldRegistryDO';
import { CharacterRegistryDO } from './CharacterRegistryDO';
import { DiscordBotDO } from './discordBotDO';

import { removeAuthor, removeWorld } from './management';

export { UserAuthDO, WorldRegistryDO, CharacterRegistryDO, DiscordBotDO };

// Define CORS
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Max-Age': '86400'
};

function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Discord-Application-Id, cf-discord-token',
	};
}

const getDiscordBot = (env, preferredId = 'default') => {
	const id = env.DISCORD_BOTS.idFromName(preferredId);
	return env.DISCORD_BOTS.get(id);
};


// Main worker class
export default {
	async verifyApiKey(apiKey, env) {
		try {
			const id = env.USER_AUTH.idFromName("global");
			const auth = env.USER_AUTH.get(id);

			const response = await auth.fetch(new Request('http://internal/verify-key', {
				method: 'POST',
				body: JSON.stringify({ apiKey })
			}));

			const result = await response.json();
			const responseData = {
				username: result.username,
				id: result.id,
				success: result.valid
			}
			return responseData;
		} catch (error) {
			console.error('API key verification error:', error);
			return { success: false, username: null };
		}
	},

	async verifyApiKeyAndUsername(apiKey, username, env) {
		try {
			// First check if it's the admin API_SECRET (admins can publish anywhere)
			if (apiKey === env.API_SECRET) {
				return true;
			}

			// For other users, verify their key and check username match
			const id = env.USER_AUTH.idFromName("global");
			const auth = env.USER_AUTH.get(id);

			// API keys are in format username.keyId
			const [keyUsername] = apiKey.split('.');
			if (keyUsername !== username) {
				console.error(`Username mismatch: key=${keyUsername}, requested=${username}`);
				return false;
			}

			const response = await auth.fetch(new Request('http://internal/verify-key', {
				method: 'POST',
				body: JSON.stringify({ apiKey })
			}));

			const result = await response.json();
			return result.valid;
		} catch (error) {
			console.error('API key and username verification error:', error);
			return false;
		}
	},

	handleOptions(request) {
		return new Response(null, {
			status: 204,
			headers: CORS_HEADERS
		});
	},

	async authenticateRequest(request, env) {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader) {
			return { success: false, username: null };
		}
		const [authType, authToken] = authHeader.split(' ');
		if (authType !== 'Bearer') {
			return { success: false, username: null };
		}

		// Check if it's the admin API_SECRET
		if (authToken === env.API_SECRET) {
			return { success: true, username: 'admin' };
		}

		// Extract username from API key format username.keyId
		const [username] = authToken.split('.');
		// If not admin key, verify against user API keys
		const { success, username: verifiedUsername, id } = await this.verifyApiKey(authToken, env);
		return { success, username: verifiedUsername, id };
	},

	// Handle Create User
	async handleCreateUser(request, env) {
		try {
			const id = env.USER_AUTH.idFromName("global");
			const auth = env.USER_AUTH.get(id);

			// Forward the request to the Durable Object
			const response = await auth.fetch(request);

			// Get the response data
			const data = await response.json();

			// Create new response with proper CORS headers
			return new Response(JSON.stringify(data), {
				status: response.status,
				headers: {
					...CORS_HEADERS,
					'Content-Type': 'application/json'
				}
			});
		} catch (error) {
			console.error('Create user error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to create user',
				details: error.message
			}), {
				status: 500,
				headers: {
					...CORS_HEADERS,
					'Content-Type': 'application/json'
				}
			});
		}
	},

	// Handle Rotate API Key
	async handleRotateApiKey(request, env) {
		const id = env.USER_AUTH.idFromName("global");
		const auth = env.USER_AUTH.get(id);
		return await auth.fetch(request);
	},

	async scheduled(controller, env, ctx) {
		try {
			console.log('Cron triggered:', {
				pattern: controller.cron,
				scheduledTime: new Date().toISOString(),
				hasCharacterRegistry: !!env.CHARACTER_REGISTRY,
				hasBackupBucket: !!env.CHARACTER_BACKUPS
			});

			// Forward the cron event to CharacterRegistryDO
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);
			const response = await registry.fetch(new Request('http://internal/scheduled', {
				method: 'POST',
				body: JSON.stringify({ cron: controller.cron })
			}));
			
			if (!response.ok) {
				throw new Error(`CharacterRegistryDO scheduled task failed: ${await response.text()}`);
			}
			console.log('CharacterRegistryDO scheduled task completed');

			// Handle backups if needed
			if (controller.cron === "25 23 * * *") {
				console.log('Starting daily character backup at 23:25 UTC');
				if (!env.CHARACTER_REGISTRY || !env.CHARACTER_BACKUPS) {
					console.error('Missing required bindings for character backup:', {
						hasRegistry: !!env.CHARACTER_REGISTRY,
						hasBackupBucket: !!env.CHARACTER_BACKUPS
					});
					return;
				}

				await this.handleDailyCharacterBackups(env);
				console.log('Completed daily character backup');
			} else {
				// Updated log message to be more generic
				console.log(`Skipping backup - cron pattern "${controller.cron}" is not for backup task`);
			}
		} catch (error) {
			console.error('Scheduled task error:', {
				message: error.message,
				stack: error.stack,
				time: new Date().toISOString()
			});
		}
	},

	async processVisitQueues(env) {
		let visits = new Map();
		let cursor = undefined;

		do {
			const result = await env.VISIT_COUNTS.list({
				cursor,
				prefix: 'queue:'
			});

			if (!result) break;
			cursor = result.cursor;

			for (const key of result.keys || []) {
				if (!key?.name) continue;

				const parts = key.name.split(':');
				if (parts.length < 4) continue;

				const author = parts[2];
				const slug = parts[3];
				const worldKey = `${author}:${slug}`;

				visits.set(
					worldKey,
					(visits.get(worldKey) || 0) + 1
				);

				await env.VISIT_COUNTS.delete(key.name)
					.catch(err => console.error(`Error deleting key ${key.name}:`, err));
			}
		} while (cursor);

		if (visits.size > 0) {
			const id = env.WORLD_REGISTRY.idFromName("global");
			const registry = env.WORLD_REGISTRY.get(id);

			await registry.fetch(new Request('http://internal/update-visit-counts', {
				method: 'POST',
				body: JSON.stringify({
					visits: Array.from(visits)
				})
			}));
		}
	},

	async handleDailyCharacterBackups(env) {
		try {
			console.log('Starting handleDailyCharacterBackups');

			// Get registry instance
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// List all authors
			console.log('Listing authors from WORLD_BUCKET');
			const authorsList = await env.WORLD_BUCKET.list();
			const authors = new Set();
			for (const item of authorsList.objects) {
				const parts = item.key.split('/');
				if (parts.length > 1) {
					authors.add(parts[0]);
				}
			}
			console.log(`Found ${authors.size} authors to process`);

			const currentDate = new Date().toISOString().split('T')[0];
			const oneWeekAgo = new Date();
			oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
			const cutoffDate = oneWeekAgo.toISOString().split('T')[0];

			// Process each author
			for (const author of authors) {
				console.log(`Processing author: ${author}`);

				// Get all characters for this author
				const response = await registry.fetch(new Request('http://internal/get-author-characters', {
					method: 'POST',
					body: JSON.stringify({ author })
				}));

				if (!response.ok) {
					console.error(`Failed to get characters for author ${author}:`, await response.text());
					continue;
				}

				const characters = await response.json();
				console.log(`Found ${characters.length} characters for author ${author}`);

				// Export and backup each character
				for (const character of characters) {
					try {
						console.log(`Processing character: ${character.slug}`);

						// Export character data
						const exportResponse = await registry.fetch(new Request('http://internal/export-character', {
							method: 'POST',
							body: JSON.stringify({
								userId: author,
								characterName: character.slug
							})
						}));

						if (!exportResponse.ok) {
							console.error(`Failed to export character ${character.slug}:`, await exportResponse.text());
							continue;
						}

						const exportData = await exportResponse.json();
						console.log(`Successfully exported character ${character.slug}`);

						// Store in backup bucket with date and encrypted filename
						const backupKey = `${author}/${character.slug}/automatic/${currentDate}-${crypto.randomUUID()}.json`;
						await env.CHARACTER_BACKUPS.put(backupKey, JSON.stringify(exportData), {
							httpMetadata: {
								contentType: 'application/json',
								cacheControl: 'private, no-cache'
							}
						});
						console.log(`Created backup at key: ${backupKey}`);

						// Clean up old backups for this character
						const oldBackups = await env.CHARACTER_BACKUPS.list({
							prefix: `${author}/${character.slug}/automatic/`
						});

						let deletedCount = 0;
						for (const backup of oldBackups.objects) {
							const backupDate = backup.key.split('/')[2].split('-')[0]; // Extract date from key
							if (backupDate < cutoffDate) {
								await env.CHARACTER_BACKUPS.delete(backup.key);
								deletedCount++;
							}
						}
						console.log(`Cleaned up ${deletedCount} old backups for ${character.slug}`);
					} catch (error) {
						console.error(`Error backing up character ${character.slug}:`, {
							message: error.message,
							stack: error.stack
						});
						continue;
					}
				}
			}
			console.log('Completed all character backups successfully');
		} catch (error) {
			console.error('Character backup error:', {
				message: error.message,
				stack: error.stack,
				time: new Date().toISOString()
			});
			throw error; // Re-throw to be caught by the scheduled handler
		}
	},

	// Handle GET /author-data
	async handleGetAuthorData(request, env) {
		try {
			const url = new URL(request.url);
			const author = url.searchParams.get('author');

			if (!author) {
				return new Response(JSON.stringify({ error: 'Missing author parameter' }), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			// Check cache first
			const cacheKey = `author-data:${author}`;
			const cache = caches.default;
			let response = await cache.match(request);

			if (!response) {
				const authorData = await this.fetchAuthorData(author, env);

				if (!authorData) {
					return new Response(JSON.stringify({ error: 'Author not found' }), {
						status: 404,
						headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
					});
				}

				const worlds = await this.fetchAuthorWorlds(author, env);

				const responseData = {
					...authorData,
					worlds,
				};

				response = new Response(JSON.stringify(responseData), {
					status: 200,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});

				// Cache the response
				response.headers.set('Cache-Control', 'public, max-age=3600');
				await cache.put(request, response.clone());
			}

			return response;
		} catch (error) {
			console.error('Get author data error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	// Handle GET /authors-list
	async handleGetAuthorsList(env) {
		try {
			// Check cache first
			const cacheKey = 'authors-list';
			const cache = caches.default;
			let response = await cache.match(cacheKey);

			if (!response) {
				const list = await env.WORLD_BUCKET.list();
				const authors = [];

				for (const item of list.objects) {
					const parts = item.key.split('/');
					if (parts.length > 1 && parts[1] === 'author_info.json') {
						const authorInfoKey = item.key;
						const authorInfoObject = await env.WORLD_BUCKET.get(authorInfoKey);

						if (authorInfoObject) {
							const authorData = JSON.parse(await authorInfoObject.text());
							authorData.authorId = parts[0];

							const authorPrefix = `${parts[0]}/`;
							const worldsList = await env.WORLD_BUCKET.list({ prefix: authorPrefix });
							const worldCount = worldsList.objects.filter(obj => obj.key.endsWith('.json') && !obj.key.endsWith('author_info.json')).length;

							authors.push({
								...authorData,
								world_count: worldCount
							});
						}
					}
				}

				response = new Response(JSON.stringify(authors), {
					status: 200,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});

				// Cache the response
				response.headers.set('Cache-Control', 'public, max-age=3600');
				await cache.put(cacheKey, response.clone());
			}

			return response;
		} catch (error) {
			console.error('Get authors list error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	// Handle POST /update-author-info
	async handleUpdateAuthorInfo(request, env) {
		try {
			const { userId, worldName, authorData } = await request.json();

			if (!userId || !worldName || !authorData) {
				return new Response(JSON.stringify({ error: `Missing userId, worldName, or authorData received ${userId}, ${worldName}, ${authorData}` }), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			// Convert authorData from serialized JSON to object if necessary
			let parsedAuthorData = authorData;
			if (typeof authorData === 'string') {
				parsedAuthorData = JSON.parse(authorData);
			}

			const authorInfoKey = `${userId}/author_info.json`;

			await env.WORLD_BUCKET.put(authorInfoKey, JSON.stringify(parsedAuthorData, null, 2), {
				httpMetadata: {
					contentType: 'application/json',
				},
			});

			const cache = caches.default;

			// Bust author directory cache
			await cache.delete(`https://${request.headers.get('host')}/author/${userId}`);

			// Bust author data cache
			await cache.delete(`https://${request.headers.get('host')}/author-data?author=${userId}`);

			// Bust authors list cache
			await cache.delete(`https://${request.headers.get('host')}/authors-list`);

			return new Response(JSON.stringify({ success: true, message: 'Author info uploaded successfully' }), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('Author info upload error:', error);
			return new Response(JSON.stringify({ success: false, error: 'Internal server error', details: error.message }), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	// Handle POST /upload-asset
	async handleUploadAsset(request, env) {
		try {
			const { userId, worldName, fileName, fileData, assetType } = await request.json();

			// Get API key from Authorization header
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const sanitizedWorldName = worldName.replace(/\s/g, '-');
			const folderName = `${userId}`;
			const assetKey = `${folderName}/${sanitizedWorldName}/${fileName}`;

			const assetBuffer = Buffer.from(fileData, 'base64');
			await env.WORLD_BUCKET.put(assetKey, assetBuffer, {
				httpMetadata: {
					contentType: 'image/jpeg', // Consider making this dynamic based on file type
				},
			});

			return new Response(JSON.stringify({
				success: true,
				message: `${assetType} uploaded successfully`,
				assetUrl: assetKey
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Asset upload error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},

	// Helper function to fetch author data
	async fetchAuthorData(author, env) {
		const authorInfoKey = `${author}/author_info.json`;
		try {
			const authorInfoObject = await env.WORLD_BUCKET.get(authorInfoKey);
			if (!authorInfoObject) {
				console.error(`Author info not found for ${author}`);
				return null;
			}
			const authorInfoText = await authorInfoObject.text();
			return JSON.parse(authorInfoText);
		} catch (error) {
			console.error(`Error fetching author data for ${author}:`, error);
			return null;
		}
	},

	// Helper function to fetch author worlds.
	async fetchAuthorWorlds(author, env) {
		const prefix = `${author}/`;
		const list = await env.WORLD_BUCKET.list({ prefix });
		const worlds = []; // Changed from plugins array

		for (const item of list.objects) {
			const parts = item.key.split('/');
			if (parts.length === 3 && parts[2] === 'metadata.json') { // Changed from ${parts[1]}.json
				const jsonData = await env.WORLD_BUCKET.get(item.key);
				const worldData = JSON.parse(await jsonData.text());

				worlds.push({
					slug: worldData.slug,
					name: worldData.name,
					short_description: worldData.short_description,
					preview_image: worldData.preview_image, // Changed from icons
					tags: worldData.tags,
					version: worldData.version,
					visit_count: worldData.visit_count || 0, // Changed from rating
					active_users: worldData.active_users || 0 // Changed from active_installs
				});
			}
		}

		return worlds;
	},

	async handleGetWorldDirectory(request, env) {
		const url = new URL(request.url);
		const pathParts = url.pathname.split('/').filter(part => part !== '');

		if (pathParts.length !== 3 || pathParts[0] !== 'directory') {
			return new Response('Invalid URL format', { status: 400 });
		}

		const author = pathParts[1];
		const world = pathParts[2];

		// Check cache first
		const cacheKey = `world:${author}:${world}`;
		const cache = caches.default;
		let response = await cache.match(request);

		if (!response) {
			try {
				const worldData = await this.fetchWorldData(author, world, env);
				const authorData = await this.fetchAuthorData(author, env);

				if (!worldData) {
					return new Response('World not found', { status: 404 });
				}
				// world_url is antpb/Scene/Scene.html, we need to use the asset directory of http://xrpassets.sxp.digital/antpb/Scene/Scene.html
				worldData.asset_directory = `http://xrpassets.sxp.digital/${author}/${world}/`;
				// pull html content and include it as a stringified object in the worldData named `world_html`
				const htmlKey = `${author}/${world}/${world}.html`;
				const htmlObject = await env.WORLD_BUCKET.get(htmlKey);
				worldData.html_content = await htmlObject.text();

				worldData.authorData = authorData;
				response = await generateWorldHTML(worldData, env);

				// Cache the response
				response.headers.set('Cache-Control', 'public, max-age=3600');
				await cache.put(request, response.clone());
			} catch (error) {
				console.error('Error generating world page:', error);
				return new Response('Internal Server Error', { status: 500 });
			}
		}

		return response;
	},

	async handleGetAuthorDirectory(request, env) {
		const url = new URL(request.url);
		const pathParts = url.pathname.split('/').filter(part => part !== '');

		if (pathParts.length !== 2 || pathParts[0] !== 'author') {
			return new Response('Invalid URL format', { status: 400 });
		}

		const author = pathParts[1];

		// Check cache first
		const cacheKey = `author:${author}`;
		const cache = caches.default;
		let response = await cache.match(request);

		if (!response) {
			try {
				const authorData = await this.fetchAuthorPageData(author, env);
				if (!authorData) {
					return new Response('Author not found', { status: 404 });
				}
				response = await generateAuthorHTML(authorData, env, request);

				// Cache the response
				response.headers.set('Cache-Control', 'public, max-age=3600');
				await cache.put(request, response.clone());
			} catch (error) {
				console.error('Error generating author page:', error);
				return new Response('Internal Server Error', { status: 500 });
			}
		}

		return response;
	},

	async fetchWorldData(author, slug, env) {
		// remove .html from slug
		slug = slug.replace('.html', '');
		const jsonKey = `${author}/${slug}/metadata.json`;
		const jsonObject = await env.WORLD_BUCKET.get(jsonKey);

		if (!jsonObject) {
			console.error(`World data not found for ${jsonKey}`);
			return null;
		}

		try {
			const text = await jsonObject.text();
			const parsed = JSON.parse(text);
			return Array.isArray(parsed) ? parsed[0] : parsed;
		} catch (error) {
			console.error(`Error parsing JSON for ${jsonKey}:`, error);
			return null;
		}
	},


	async fetchAuthorPageData(author, env) {
		const authorInfoKey = `${author}/author_info.json`;
		const authorInfoObject = await env.WORLD_BUCKET.get(authorInfoKey);
		// stringify and log the authorInfoObject
		if (!authorInfoObject) {
			console.error(`Author info not found for ${author}`);
			return null;
		}

		try {
			const authorInfoText = await authorInfoObject.text();

			const authorData = JSON.parse(authorInfoText);

			// Fetch and combine world data
			const worldPrefix = `${author}/`;
			const worldList = await env.WORLD_BUCKET.list({ prefix: worldPrefix });

			const worlds = [];

			for (const item of worldList.objects) {
				// log 
				const parts = item.key.split('/');
				if (parts.length === 3 && parts[2] === `metadata.json`) {
					const jsonData = await env.WORLD_BUCKET.get(item.key);
					const worldData = JSON.parse(await jsonData.text());
					// Preserve the original structure of the world data
					worlds.push({
						...worldData[0],
					});
				}
			}

			// Replace the worlds array in authorData
			authorData.worlds = worlds;

			return authorData;
		} catch (error) {
			console.error(`Error processing data for ${authorInfoKey}:`, error);
			return null;
		}
	},

	async handleVersionCheck(request, env) {
		try {
			const url = new URL(request.url);
			const author = url.searchParams.get('author');
			const worldName = url.searchParams.get('worldName');
			const newVersion = url.searchParams.get('newVersion');

			if (!author || !worldName || !newVersion) {
				return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			const sanitizedWorldName = worldName.replace(/\s/g, '-');
			const jsonKey = `${author}/${sanitizedWorldName}/metadata.json`;
			const jsonObject = await env.WORLD_BUCKET.get(jsonKey);

			if (!jsonObject) {
				return new Response(JSON.stringify({ isNew: true, canUpload: true }), {
					status: 200,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			const jsonData = JSON.parse(await jsonObject.text());
			const currentVersion = jsonData[0].version;

			const isHigherVersion = this.compareVersions(newVersion, currentVersion);

			return new Response(JSON.stringify({
				isNew: false,
				canUpload: isHigherVersion,
				currentVersion: currentVersion
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('Version check error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	// Helper function to compare version strings
	compareVersions(v1, v2) {
		const parts1 = v1.split('.').map(Number);
		const parts2 = v2.split('.').map(Number);

		for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
			const part1 = parts1[i] || 0;
			const part2 = parts2[i] || 0;

			if (part1 > part2) return true;
			if (part1 < part2) return false;
		}

		return false; // versions are equal
	},

	async handleBackupWorld(request, env) {
		try {
			if (!this.authenticateRequest(request, env)) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			const { author, slug, version } = await request.json();

			if (!author || !slug || !version) {
				return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			const worldFolder = `${author}/${slug}`;
			const backupFolder = `${worldFolder}/${version}`;

			// Check if backup already exists
			const existingBackup = await env.WORLD_BUCKET.list({ prefix: backupFolder });
			if (existingBackup.objects.length > 0) {
				return new Response(JSON.stringify({
					success: false,
					message: `Backup for version ${version} already exists`,
				}), {
					status: 200,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			// Files to backup
			const filesToBackup = [
				`${slug}.html`,           // Changed from .zip
				`metadata.json`,          // Changed from metadata.json
				'preview.jpg',            // Changed from banner/icon
			];

			for (const file of filesToBackup) {
				const sourceKey = `${worldFolder}/${file}`;
				const sourceObject = await env.WORLD_BUCKET.get(sourceKey);

				if (sourceObject) {
					const destinationKey = `${backupFolder}/${file}`;
					await env.WORLD_BUCKET.put(destinationKey, sourceObject.body, sourceObject.httpMetadata);
				}
			}

			// Update the main world metadata to reflect the current version
			const metadataKey = `${worldFolder}/metadata.json`;
			const metadataObject = await env.WORLD_BUCKET.get(metadataKey);
			if (metadataObject) {
				const metadata = JSON.parse(await metadataObject.text());
				metadata[0].version = version;
				await env.WORLD_BUCKET.put(metadataKey, JSON.stringify(metadata), {
					httpMetadata: { contentType: 'application/json' },
				});
			}

			return new Response(JSON.stringify({
				success: true,
				message: `Backup created for ${author}/${slug} version ${version}`,
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});

		} catch (error) {
			console.error('Backup creation error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	async handleSearchResultsPage(request, env) {
		const url = new URL(request.url);
		const query = url.searchParams.get('q') || '';
		const tags = url.searchParams.getAll('tag');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		// Get DO instance
		const id = env.WORLD_REGISTRY.idFromName("global");
		const registry = env.WORLD_REGISTRY.get(id);

		// Create internal search request
		const searchRequest = new Request('http://internal/search', {
			method: 'POST',
			body: JSON.stringify({
				query,
				tags,
				limit,
				offset
			})
		});

		try {
			// Fetch results from Durable Object
			const searchResponse = await registry.fetch(searchRequest);
			if (!searchResponse.ok) {
				throw new Error(`Search request failed: ${searchResponse.status}`);
			}

			const results = await searchResponse.json();

			// Generate the HTML page with the results
			return generateSearchHTML(results, query, tags, offset, limit, env);
		} catch (error) {
			console.error('Search error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},
	async getVisitCount(request, env) {
		try {
			const url = new URL(request.url);
			const author = url.searchParams.get('author');
			const slug = url.searchParams.get('slug');

			if (!author || !slug) {
				return new Response(JSON.stringify({ error: 'Missing author or slug parameter' }), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			const visitsKey = `visits:${author}:${slug}`;
			const count = parseInt(await env.VISIT_COUNTS.get(visitsKey)) || 0;

			return new Response(JSON.stringify({ visits: count }), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('Get visit count error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	async handleHomepage(request, env) {
		try {
			// Check cache first
			const cache = caches.default;
			let response = await cache.match(request);

			if (!response) {
				// Get DO instance
				const id = env.WORLD_REGISTRY.idFromName("global");
				const registry = env.WORLD_REGISTRY.get(id);

				// Fetch authors from database
				const authorsRequest = new Request('http://internal/list-authors', {
					method: 'POST'
				});

				const authorsResponse = await registry.fetch(authorsRequest);
				if (!authorsResponse.ok) {
					throw new Error('Failed to fetch authors');
				}

				const authors = await authorsResponse.json();
				response = await generateHomeHTML(authors, env, request);

				// Cache the response
				response.headers.set('Cache-Control', 'public, max-age=3600');
				await cache.put(request, response.clone());
			}

			return response;
		} catch (error) {
			console.error('Homepage error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},

	// This is gross, refactor later...
	async handleClearCache(request, env) {
		try {
			if (!this.authenticateRequest(request, env)) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}

			const cache = caches.default;
			const url = new URL(request.url);

			// List of all domains to clear cache for
			const domains = [
				request.headers.get('host'),
				'pluginpublisher.com',
				'xr-publisher.sxpdigital.workers.dev'
			];

			// List of URL patterns to clear
			const urlPatterns = [
				`/`,
				`/directory/*`,
				`/world-data*`,
				`/author/*`,
				`/author-data*`,
				`/authors-list`,
				`/directory/search*`,
				`/characters/*`,
				`/character-data*`,
				`/author-characters*`
			];

			const clearedKeys = [];

			// Get list of all authors to ensure we clear their specific caches
			const authorsList = await env.WORLD_BUCKET.list();
			const authors = new Set();
			for (const item of authorsList.objects) {
				const parts = item.key.split('/');
				if (parts.length > 1) {
					authors.add(parts[0]);
				}
			}

			// Clear cache for each domain and pattern combination
			for (const domain of domains) {
				for (const pattern of urlPatterns) {
					if (pattern.includes('*')) {
						// For wildcard patterns, we need to specifically clear author-related caches
						for (const author of authors) {
							const specificUrl = pattern
								.replace('*', `${author}`)
								.replace('//', '/');

							// Clear both HTTP and HTTPS versions
							const httpsKey = `https://${domain}${specificUrl}`;
							const httpKey = `http://${domain}${specificUrl}`;

							await cache.delete(httpsKey);
							await cache.delete(httpKey);
							clearedKeys.push(httpsKey, httpKey);

							// If it's a directory pattern, also clear plugin-specific caches
							if (pattern.startsWith('/directory/')) {
								const worldsList = await env.WORLD_BUCKET.list({ prefix: `${author}/` });
								for (const world of worldsList.objects) {
									const worldParts = world.key.split('/');
									if (worldParts.length === 3 && worldParts[2].endsWith('.json')) {
										const worldFinalName = worldParts[1];
										const httpsWorldUrl = `https://${domain}/directory/${author}/${worldFinalName}`;
										const httpWorldUrl = `http://${domain}/directory/${author}/${worldFinalName}`;

										await cache.delete(httpsWorldUrl);
										await cache.delete(httpWorldUrl);
										clearedKeys.push(httpsWorldUrl, httpWorldUrl);
									}
								}
							}
						}
					} else {
						// For non-wildcard patterns, clear both HTTP and HTTPS versions
						const httpsKey = `https://${domain}${pattern}`;
						const httpKey = `http://${domain}${pattern}`;

						await cache.delete(httpsKey);
						await cache.delete(httpKey);
						clearedKeys.push(httpsKey, httpKey);
					}
				}
			}

			return new Response(JSON.stringify({
				success: true,
				message: 'Cache cleared successfully',
				clearedKeys
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('Cache clear error:', error);
			return new Response(JSON.stringify({
				success: false,
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	// Separate get handler that can be controled on public facing cache clears. @todo remove this later. Needed until I have a better way to control cache clears.
	async handleClearCacheGet(request, env) {
		try {
			const cache = caches.default;
			const url = new URL(request.url);

			// List of all domains to clear cache for
			const domains = [
				request.headers.get('host'),
				'pluginpublisher.com',
				'xr-publisher.sxpdigital.workers.dev'
			];

			// List of URL patterns to clear
			const urlPatterns = [
				`/`,
				`/directory/*`,
				`/world-data*`,
				`/author/*`,
				`/author-data*`,
				`/authors-list`,
				`/directory/search*`,
				`author-characters`,
				`author-characters*`,
				`author-characters/*`,
				`/author-charactersauthor=antpb`
			];

			const clearedKeys = [];

			// Get list of all authors to ensure we clear their specific caches
			const authorsList = await env.WORLD_BUCKET.list();
			const authors = new Set();
			for (const item of authorsList.objects) {
				const parts = item.key.split('/');
				if (parts.length > 1) {
					authors.add(parts[0]);
				}
			}

			// Clear cache for each domain and pattern combination
			for (const domain of domains) {
				for (const pattern of urlPatterns) {
					if (pattern.includes('*')) {
						// For wildcard patterns, we need to specifically clear author-related caches
						for (const author of authors) {
							const specificUrl = pattern.replace('*', `${author}`).replace('//', '/');

							// Clear both HTTP and HTTPS versions
							const httpsKey = `https://${domain}${specificUrl}`;
							const httpKey = `http://${domain}${specificUrl}`;

							await cache.delete(httpsKey);
							await cache.delete(httpKey);
							clearedKeys.push(httpsKey, httpKey);

							// If it's a directory pattern, also clear world-specific caches
							if (pattern.startsWith('/directory/')) {
								const worldsList = await env.WORLD_BUCKET.list({ prefix: `${author}/` });
								for (const world of worldsList.objects) {
									const worldParts = world.key.split('/');
									if (worldParts.length === 3 && worldParts[2].endsWith('.json')) {
										const worldFinalName = worldParts[1];
										const httpsWorldUrl = `https://${domain}/directory/${author}/${worldFinalName}`;
										const httpWorldUrl = `http://${domain}/directory/${author}/${worldFinalName}`;

										await cache.delete(httpsWorldUrl);
										await cache.delete(httpWorldUrl);
										clearedKeys.push(httpsWorldUrl, httpWorldUrl);
									}
								}
							}
						}
					} else {
						// For non-wildcard patterns, clear both HTTP and HTTPS versions
						const httpsKey = `https://${domain}${pattern}`;
						const httpKey = `http://${domain}${pattern}`;
						await cache.delete(httpsKey);
						await cache.delete(httpKey);
						clearedKeys.push(httpsKey, httpKey);
					}
				}
			}

			return new Response(JSON.stringify({
				success: true,
				message: 'Cache cleared successfully',
				clearedKeys
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('Cache clear error:', error);
			return new Response(JSON.stringify({
				success: false,
				error: 'Internal server error'
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		}
	},

	async handleDeleteUser(request, env) {
		try {
			// This endpoint requires admin API_SECRET
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const data = await request.json();
			const { username } = data;

			if (!username) {
				return new Response(JSON.stringify({ error: 'Missing username' }), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			// Delete user data in parallel for better performance
			const [authResult, registryResult, bucketResult] = await Promise.allSettled([
				// 1. Delete from UserAuthDO
				(async () => {
					const authId = env.USER_AUTH.idFromName("global");
					const auth = env.USER_AUTH.get(authId);
					const response = await auth.fetch(new Request('http://internal/delete-user', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ username })
					}));

					if (!response.ok) {
						const error = await response.text();
						throw new Error(`Auth deletion failed: ${error}`);
					}
					return await response.json();
				})(),

				// 2. Delete from PluginRegistryDO
				(async () => {
					const registryId = env.WORLD_REGISTRY.idFromName("global");
					const registry = env.WORLD_REGISTRY.get(registryId);
					const response = await registry.fetch(new Request('http://internal/delete-author', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ authorName: username })
					}));

					if (!response.ok) {
						const error = await response.text();
						throw new Error(`Registry deletion failed: ${error}`);
					}
					return await response.json();
				})(),

				// 3. Delete files from bucket
				(async () => {
					const prefix = `${username}/`;
					const files = await env.WORLD_BUCKET.list({ prefix });
					const deletionResults = await Promise.all(
						files.objects.map(file => env.WORLD_BUCKET.delete(file.key))
					);
					return { deletedFiles: files.objects.length };
				})()
			]);

			// Process results and build response
			const response = {
				success: true,
				details: {
					auth: authResult.status === 'fulfilled' ? authResult.value : { error: authResult.reason?.message },
					registry: registryResult.status === 'fulfilled' ? registryResult.value : { error: registryResult.reason?.message },
					storage: bucketResult.status === 'fulfilled' ? bucketResult.value : { error: bucketResult.reason?.message }
				}
			};

			// If any operation failed, mark overall success as false but continue with others
			if (authResult.status === 'rejected' || registryResult.status === 'rejected' || bucketResult.status === 'rejected') {
				response.success = false;
				response.message = 'Some deletion operations failed. Check details for more information.';
				return new Response(JSON.stringify(response), {
					status: 207, // 207 Multi-Status
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			response.message = `User ${username} and all associated data have been deleted`;
			return new Response(JSON.stringify(response), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});

		} catch (error) {
			console.error('Error deleting user:', error);
			return new Response(JSON.stringify({
				success: false,
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},

	async handleWorldUpload(request, env) {
		try {
			const { userId, worldName, htmlData, preview } = await request.json();

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const sanitizedWorldName = worldName.replace(/\s/g, '-');
			const folderName = `${userId}`;
			const htmlKey = `${folderName}/${sanitizedWorldName}/${sanitizedWorldName}.html`;

			// Store HTML content
			await env.WORLD_BUCKET.put(htmlKey, htmlData, {
				httpMetadata: {
					contentType: 'text/html',
				},
			});

			// Store preview image if provided
			if (preview) {
				const previewKey = `${folderName}/${sanitizedWorldName}/preview.jpg`;
				const previewBuffer = Buffer.from(preview.split(',')[1], 'base64');
				await env.WORLD_BUCKET.put(previewKey, previewBuffer, {
					httpMetadata: {
						contentType: 'image/jpeg',
					},
				});
			}

			return new Response(JSON.stringify({
				success: true,
				message: 'World uploaded successfully',
				htmlUrl: htmlKey,
				previewUrl: preview ? `${folderName}/${sanitizedWorldName}/preview.jpg` : null
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('World upload error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},

	async handleWorldMetadata(request, env) {
		try {
			const { userId, worldName, metadata } = await request.json();

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const sanitizedWorldName = worldName.replace(/\s/g, '-');
			const folderName = `${userId}`;
			const metadataKey = `${folderName}/${sanitizedWorldName}/metadata.json`;

			// Process metadata with correct path formatting
			let processedMetadata = {
				name: worldName,
				slug: sanitizedWorldName,
				author: userId,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				version: metadata.version || '1.0.0',
				entry_point: metadata.entry_point || '0,0,0',
				visibility: metadata.visibility || 'public',
				capacity: metadata.capacity || 100,
				html_url: `${folderName}/${sanitizedWorldName}/${sanitizedWorldName}.html`,
				preview_image: `${folderName}/${sanitizedWorldName}/preview.jpg`,
				content_rating: metadata.content_rating || 'everyone',
				short_description: metadata.short_description || '',
				long_description: metadata.long_description || '',
				tags: Array.isArray(metadata.tags) ? metadata.tags : [],
				properties: metadata.properties || null
			};

			// Store metadata in R2
			await env.WORLD_BUCKET.put(metadataKey, JSON.stringify([processedMetadata]), {
				httpMetadata: {
					contentType: 'application/json',
				},
			});

			// Update SQLite database via WorldRegistryDO
			const id = env.WORLD_REGISTRY.idFromName("global");
			const registry = env.WORLD_REGISTRY.get(id);

			const updateRequest = new Request('http://internal/create-world', {
				method: 'POST',
				body: JSON.stringify(processedMetadata)
			});

			const updateResponse = await registry.fetch(updateRequest);
			if (!updateResponse.ok) {
				const errorText = await updateResponse.text();
				console.error('Failed to update SQLite database:', errorText);
				throw new Error(`Database update failed: ${errorText}`);
			}

			return new Response(JSON.stringify({
				success: true,
				message: 'World metadata updated successfully',
				metadata: processedMetadata
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('Metadata update error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},


	async handleGetWorldData(request, env) {  // Updated version of handleGetPluginData
		try {
			const url = new URL(request.url);
			const author = url.searchParams.get('author');
			const slug = url.searchParams.get('slug');

			if (!author || !slug) {
				return new Response(JSON.stringify({ error: 'Missing parameters' }), {
					status: 400,
					headers: { ...CORS_HEADERS }
				});
			}

			const metadataKey = `${author}/${slug}/metadata.json`;
			const worldData = await env.WORLD_BUCKET.get(metadataKey);

			if (!worldData) {
				return new Response(JSON.stringify({ error: 'World not found' }), {
					status: 404,
					headers: { ...CORS_HEADERS }
				});
			}

			return new Response(await worldData.text(), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Get world data error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error' }), {
				status: 500,
				headers: {
					...CORS_HEADERS,
					'Cache-Control': 'no-store, no-cache, must-revalidate',
					'Pragma': 'no-cache',
					'Expires': '0'
				}
			});
		}
	},

	async handleGetWorld(request, env) {
		try {
			const url = new URL(request.url);
			const author = url.searchParams.get('author');
			const slug = url.searchParams.get('slug');

			if (!author || !slug) {
				return new Response(JSON.stringify({
					error: 'Missing author or slug parameter'
				}), {
					status: 400,
					headers: {
						...CORS_HEADERS,
						'Content-Type': 'application/json',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
						'Pragma': 'no-cache',
						'Expires': '0'
					}
				});
			}

			// Record visit if not disabled
			const trackVisit = url.searchParams.get('track') !== 'false';
			if (trackVisit) {
				// Get DO instance
				const id = env.WORLD_REGISTRY.idFromName("global");
				const registry = env.WORLD_REGISTRY.get(id);

				await registry.fetch(new Request('http://internal/record-visit', {
					method: 'POST',
					body: JSON.stringify({ author, slug })
				}));
			}

			// Get and return the HTML file
			const htmlKey = `${author}/${slug}/${slug}.html`;
			const htmlObject = await env.WORLD_BUCKET.get(htmlKey);

			if (!htmlObject) {
				return new Response(JSON.stringify({ error: 'World not found' }), {
					status: 404,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			// Add security headers for iframes, etc.
			const securityHeaders = {
				...CORS_HEADERS,
				'Content-Type': 'text/html',
				'Content-Security-Policy': [
					"default-src 'self'",
					"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
					"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
					"img-src 'self' data: blob: https:",
					"connect-src 'self' wss: https:",
					"frame-src 'self' https:",
					"worker-src 'self' blob:",
					"font-src 'self' https://cdn.jsdelivr.net"
				].join('; '),
				'X-Frame-Options': 'SAMEORIGIN',
				'X-Content-Type-Options': 'nosniff'
			};

			return new Response(htmlObject.body, {
				status: 200,
				headers: securityHeaders
			});
		} catch (error) {
			console.error('World fetch error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},

	async handleUpdateActiveUsers(request, env) {
		try {
			const { author, slug, count } = await request.json();

			if (!author || !slug || typeof count !== 'number') {
				return new Response(JSON.stringify({
					error: 'Missing required parameters'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			// Update active users count in registry
			const id = env.WORLD_REGISTRY.idFromName("global");
			const registry = env.WORLD_REGISTRY.get(id);

			await registry.fetch(new Request('http://internal/update-active-users', {
				method: 'POST',
				body: JSON.stringify({ author, slug, count })
			}));

			return new Response(JSON.stringify({
				success: true,
				message: 'Active users count updated'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Active users update error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},

	async handleGetCharacterDirectory(request, env) {
		const url = new URL(request.url);
		const pathParts = url.pathname.split('/').filter(part => part !== '');

		if (pathParts.length !== 3 || pathParts[0] !== 'characters') {
			return new Response('Invalid URL format', { status: 400 });
		}

		const author = pathParts[1];
		const characterName = pathParts[2];

		// Check cache first
		const cacheKey = `character:${author}:${characterName}`;
		const cache = caches.default;
		let response = await cache.match(request);

		if (!response) {
			try {
				// Get character data from the registry
				const id = env.CHARACTER_REGISTRY.idFromName("global");
				const registry = env.CHARACTER_REGISTRY.get(id);
				const characterResponse = await registry.fetch(new Request('http://internal/get-character', {
					method: 'POST',
					body: JSON.stringify({ author, slug: characterName })
				}));

				if (!characterResponse.ok) {
					return new Response('Character not found', { status: 404 });
				}

				const characterData = await characterResponse.json();

				// Get author data to include with character
				const authorData = await this.fetchAuthorData(author, env);
				characterData.authorData = authorData;

				response = await generateCharacterHTML(characterData, env);

				// Cache the response
				response.headers.set('Cache-Control', 'public, max-age=3600');
				await cache.put(request, response.clone());
			} catch (error) {
				console.error('Error generating character page:', error);
				return new Response('Internal Server Error', { status: 500 });
			}
		}

		return response;
	},
	async handleGetAuthorCharacters(request, env) {
		try {
			const url = new URL(request.url);
			const author = url.searchParams.get('author');

			if (!author) {
				return new Response(JSON.stringify({ error: 'Missing author parameter' }), {
					status: 400,
					headers: {
						...CORS_HEADERS,
						'Cache-Control': 'no-store, no-cache, must-revalidate',
						'Pragma': 'no-cache',
						'Expires': '0'
					}
				});
			}

			// const cacheKey = `author-characters:${author}`;
			// const cache = caches.default;
			// let response = await cache.match(request);

			// let response = await request.json();

			// if (!response) {
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			const characterResponse = await registry.fetch(new Request('http://internal/get-author-characters', {
				method: 'POST',
				body: JSON.stringify({ author })
			}));

			if (!characterResponse.ok) {
				throw new Error(`Failed to fetch characters: ${await characterResponse.text()}`);
			}

			const characters = await characterResponse.json();

			const response = new Response(JSON.stringify(characters), {
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});

			// Cache the response
			// response.headers.set('Cache-Control', 'public, max-age=3600');
			// await cache.put(request, response.clone());
			// }

			return response;
		} catch (error) {
			console.error('Get author characters error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error' }), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},

	async handleGetCharacterData(request, env) {
		try {
			const url = new URL(request.url);
			const author = url.searchParams.get('author');
			const name = url.searchParams.get('slug');

			if (!author || !name) {
				return new Response(JSON.stringify({ error: 'Missing parameters' }), {
					status: 400,
					headers: { ...CORS_HEADERS }
				});
			}

			// Get character data from the registry
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			const response = await registry.fetch(new Request('http://internal/get-character', {
				method: 'POST',
				body: JSON.stringify({ author, slug: name })
			}));

			if (!response.ok) {
				return new Response(JSON.stringify({ error: 'Character not found' }), {
					status: 404,
					headers: { ...CORS_HEADERS }
				});
			}

			return new Response(await response.text(), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Get character data error:', error);
			return new Response(JSON.stringify({ error: 'Internal server error' }), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},
	async handleCharacterSession(request, env) {
		try {
			const { author, name, roomId } = await request.json();

			if (!author || !name) {
				return new Response(JSON.stringify({
					error: 'Missing required fields'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			// Get DO instance - same pattern as handleGetCharacterData
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// Initialize session using the same pattern as get-character
			const response = await registry.fetch(new Request('http://internal/initialize-session', {
				method: 'POST',
				body: JSON.stringify({ author, slug: name, roomId })
			}));

			if (!response.ok) {
				const error = await response.text();
				return new Response(JSON.stringify({
					error: 'Failed to initialize session',
					details: error
				}), {
					status: 500,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			return new Response(await response.text(), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Session initialization error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},
	async handleCharacterUpload(request, env) {
		try {
			const { userId, character } = await request.json();

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			// Get DO instance
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// Create/update character
			const response = await registry.fetch(new Request('http://internal/create-character', {
				method: 'POST',
				body: JSON.stringify({
					author: userId,
					character
				})
			}));

			const responseText = await response.text();

			if (!response.ok) {
				throw new Error(`Failed to create character: ${responseText}`);
			}

			// Clear cache for this character
			const cache = caches.default;
			const cacheKey = `https://${request.headers.get('host')}/characters/${userId}/${character.slug}`;
			await cache.delete(cacheKey);

			return new Response(JSON.stringify({
				success: true,
				message: 'Character uploaded successfully'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Character upload error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},

	async handleCharacterMetadata(request, env) {
		try {
			const { userId, character } = await request.json();

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			// Get DO instance
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// Update character
			const response = await registry.fetch(new Request('http://internal/update-character-metadata', {
				method: 'POST',
				body: JSON.stringify({
					author: userId,
					character: {
						...character,
						updated_at: new Date().toISOString()
					}
				})
			}));

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to update character: ${errorText}`);
			}

			// Clear cache for this character
			const cache = caches.default;
			await cache.delete(`https://${request.headers.get('host')}/characters/${userId}/${character.slug}`);
			await cache.delete(`https://${request.headers.get('host')}/character-data?author=${userId}&name=${character.slug}`);
			await cache.delete(`https://${request.headers.get('host')}/author-characters?author=${userId}`);

			return new Response(JSON.stringify({
				success: true,
				message: 'Character updated successfully'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Character update error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},
	async handleCharacterUpdate(request, env) {
		try {
			const { userId, character } = await request.json();

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			// Get DO instance
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// Update character
			const response = await registry.fetch(new Request('http://internal/update-character', {
				method: 'POST',
				body: JSON.stringify({
					author: userId,
					character: {
						...character,
						updated_at: new Date().toISOString()
					}
				})
			}));

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to update character: ${errorText}`);
			}

			// Clear cache for this character
			const cache = caches.default;
			await cache.delete(`https://${request.headers.get('host')}/characters/${userId}/${character.slug}`);
			await cache.delete(`https://${request.headers.get('host')}/character-data?author=${userId}&name=${character.slug}`);
			await cache.delete(`https://${request.headers.get('host')}/author-characters?author=${userId}`);

			return new Response(JSON.stringify({
				success: true,
				message: 'Character updated successfully'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Character update error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},

	async handleCharacterImageUpload(request, env) {
		try {
			const { userId, characterName, fileName, fileData, assetType } = await request.json();

			// Verify authorization
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const timestamp = Date.now();
			const sanitizedCharacterName = characterName.replace(/\s/g, '-');
			const assetKey = `characters/${userId}/${sanitizedCharacterName}/${fileName}`;
			// Upload to R2 bucket with cache control headers
			await env.WORLD_BUCKET.put(assetKey, Buffer.from(fileData, 'base64'), {
				httpMetadata: {
					contentType: 'image/jpeg',
					cacheControl: 'public, max-age=0, must-revalidate'
				}
			});
			// Get the existing character data first
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			const getCharRequest = new Request('http://internal/get-character', {
				method: 'POST',
				body: JSON.stringify({ author: userId, slug: characterName })
			});

			const charResponse = await registry.fetch(getCharRequest);
			if (!charResponse.ok) {
				throw new Error('Failed to get current character data');
			}

			const currentChar = await charResponse.json();

			// Store the URL with a cache-busting query parameter
			const imageUrl = `https://uploads.sxp.digital/${assetKey}?v=${timestamp}`;

			const updateRequest = new Request('http://internal/update-character', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': authHeader
				},
				body: JSON.stringify({
					author: userId,
					character: {
						...currentChar,
						[assetType === 'profile' ? 'profileImg' : 'bannerImg']: imageUrl
					}
				})
			});

			const registryResponse = await registry.fetch(updateRequest);
			if (!registryResponse.ok) {
				const error = await registryResponse.text();
				throw new Error(`Failed to update character record: ${error}`);
			}

			return new Response(JSON.stringify({
				success: true,
				message: `${assetType} image uploaded successfully`,
				assetUrl: imageUrl
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Character image upload error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},

	async handleUpdateCharacterKeys(request, env) {
		try {
			// Get data from request
			const { userId, characterName, keyType, value } = await request.json();

			// Verify authorization
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			// Get character registry
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id,
				{ CHARACTER_SALT: env.CHARACTER_SALT });

			// Create internal request to update character keys
			const updateRequest = new Request('http://internal/update-character-secrets', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': authHeader
				},
				body: JSON.stringify({
					author: userId,
					character: {
						slug: characterName,
						settings: {
							secrets: {
								[keyType]: value
							}
						}
					}
				})
			});

			// Send update request to character registry
			await registry.fetch(updateRequest);

			return new Response(JSON.stringify({
				success: true,
				message: 'Character keys updated successfully'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});

		} catch (error) {
			console.error('Character keys update error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},

	async handleDeleteCharacter(request, env) {
		try {
			const { userId, characterName } = await request.json();

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			// Get DO instance
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// Delete character
			const response = await registry.fetch(new Request('http://internal/delete-character', {
				method: 'POST',
				body: JSON.stringify({
					author: userId,
					name: characterName
				})
			}));

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to delete character: ${errorText}`);
			}

			// Clear caches
			const cache = caches.default;
			await cache.delete(`https://${request.headers.get('host')}/characters/${userId}/${characterName}`);
			await cache.delete(`https://${request.headers.get('host')}/character-data?author=${userId}&name=${characterName}`);
			await cache.delete(`https://${request.headers.get('host')}/author-characters?author=${userId}`);

			return new Response(JSON.stringify({
				success: true,
				message: 'Character deleted successfully'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Character delete error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},


	async generateCharacter(prompt, env) {
		if (!prompt) {
			throw new Error('Missing prompt');
		}

		// Call OpenAI API through Cloudflare AI Gateway
		const response = await fetch(`https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}/openai/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${env.OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content: 'You are a creative character designer that creates detailed character profiles.'
					},
					{
						role: 'user',
						content: prompt
					}
				],
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "character_profile",
						strict: true,
						schema: {
							type: "object",
							properties: {
								name: { type: "string" },
								modelProvider: {
									type: "string",
									enum: ["ANTHROPIC", "OPENAI"]
								},
								clients: {
									type: "array",
									items: {
										type: "string",
										enum: ["DISCORD", "DIRECT"]
									}
								},
								bio: { type: "string" },
								lore: {
									type: "array",
									items: { type: "string" }
								},
								messageExamples: {
									type: "array",
									items: {
										type: "array",
										items: {
											type: "object",
											properties: {
												user: { type: "string" },
												content: {
													type: "object",
													properties: {
														text: { type: "string" }
													},
													required: ["text"],
													additionalProperties: false
												}
											},
											required: ["user", "content"],
											additionalProperties: false
										}
									}
								},
								postExamples: {
									type: "array",
									items: { type: "string" }
								},
								topics: {
									type: "array",
									items: { type: "string" }
								},
								style: {
									type: "object",
									properties: {
										all: { type: "array", items: { type: "string" } },
										chat: { type: "array", items: { type: "string" } },
										post: { type: "array", items: { type: "string" } }
									},
									required: ["all", "chat", "post"],
									additionalProperties: false
								},
								adjectives: {
									type: "array",
									items: { type: "string" }
								},
								settings: {
									type: "object",
									properties: {
										model: { type: "string" },
										voice: {
											type: "object",
											properties: {
												model: { type: "string" }
											},
											required: ["model"],
											additionalProperties: false
										}
									},
									required: ["model", "voice"],
									additionalProperties: false
								}
							},
							required: [
								"name", "modelProvider", "clients", "bio", "lore",
								"messageExamples", "postExamples", "topics", "style",
								"adjectives", "settings"
							],
							additionalProperties: false
						}
					}
				}
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
		}

		const result = await response.json();

		// Handle potential refusal
		if (result.choices[0].message.refusal) {
			throw new Error(`Character generation refused: ${result.choices[0].message.refusal}`);
		}
		// Parse the string into an object
		return JSON.parse(result.choices[0].message.content);
	},


	async handleCharacterSchemaMigration(request, env) {
		try {
			// Get DO instance
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// Trigger migration
			const response = await registry.fetch(new Request('http://internal/migrate-schema', {
				method: 'POST'
			}));

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Migration failed: ${errorText}`);
			}

			return new Response(JSON.stringify({
				success: true,
				message: 'Character schema migration completed successfully'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Character schema migration error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},
	async handleDeleteMemory(request, env) {
		try {
			// get api key from header
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// get the user from the api key
			const authResult = await this.verifyApiKey(apiKey, env);
			console.log('[handleDeleteMemory] Auth result:', authResult);
			if (!authResult.success) {
				return new Response(JSON.stringify({
					error: 'Invalid API key'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const { sessionId, memoryId, characterId } = await request.json();

			if (!sessionId || !memoryId) {
				return new Response(JSON.stringify({
					error: 'Missing required fields'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			const response = await registry.fetch(new Request('http://internal/handle-delete-memory', {
				method: 'POST',
				body: JSON.stringify({
					sessionId,
					memoryId,
					characterId,
					username: authResult.username
				})
			}));

			return new Response(await response.text(), {
				status: response.status,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Delete memory error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},
	async handleFindMemory(request, env) {
		try {
			const { sessionId, query, agentId } = await request.json();

			if (!sessionId || !query) {
				return new Response(JSON.stringify({
					error: 'Missing required fields'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			// get api key from header
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');
			// get the user from the api key
			const authResult = await this.verifyApiKey(apiKey, env);
			console.log('[handleFindMemory] Auth result:', authResult);
			if (!authResult.success) {
				return new Response(JSON.stringify({
					error: 'Invalid API key'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			const response = await registry.fetch(new Request('http://internal/handle-find-memory', {
				method: 'POST',
				body: JSON.stringify({
					sessionId,
					query,
					agentId,
					username: authResult.username
				})
			}));

			return new Response(await response.text(), {
				status: response.status,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Find memory error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},
	async handleUpdateMemory(request, env) {
		try {
			// get api key from header
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// get the user from the api key
			const authResult = await this.verifyApiKey(apiKey, env);
			console.log('[handleUpdateMemory] Auth result:', authResult);
			if (!authResult.success) {
				return new Response(JSON.stringify({
					error: 'Invalid API key'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const { sessionId, memoryId, content, type, userId, importance_score = 0, metadata = {} } = await request.json();
			console.log('[handleUpdateMemory] Request params:', {
				sessionId,
				memoryId,
				type,
				userId,
				importance_score,
				contentSample: content ? JSON.stringify(content).slice(0, 100) : 'No content'
			});

			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			const response = await registry.fetch(new Request('http://internal/handle-update-memory', {
				method: 'POST',
				body: JSON.stringify({
					sessionId,
					memoryId,
					content,
					importance_score,
					type,
					userId,
					username: authResult.username // Pass authenticated username
				})
			}));

			const responseText = await response.text();
			console.log('[handleUpdateMemory] DO Response:', {
				status: response.status,
				body: responseText.slice(0, 200) + '...'
			});

			return new Response(responseText, {
				status: response.status,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Update memory error:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},
	async handleMemoryList(request, env) {
		try {
			let sessionId, type, slug;

			// get api key from header
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// get the user from the api key
			const authResult = await this.verifyApiKey(apiKey, env);
			console.log('[handleMemoryList] Auth result:', authResult);
			if (!authResult.success) {
				return new Response(JSON.stringify({
					error: 'Invalid API key'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			if (request.method === 'GET') {
				const url = new URL(request.url);
				sessionId = url.searchParams.get('sessionId');
				slug = url.searchParams.get('slug');
				type = url.searchParams.get('type');
			} else if (request.method === 'POST') {
				const body = await request.json();
				sessionId = body.sessionId;
				slug = body.slug;
				type = body.type;
			} else {
				return new Response(JSON.stringify({
					error: 'Method not allowed'
				}), {
					status: 405,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			console.log('[handleMemoryList] Request params:', { sessionId, type, slug, method: request.method });

			if (!sessionId) {
				return new Response(JSON.stringify({
					error: 'Missing sessionId parameter'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}

			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			const response = await registry.fetch(new Request('http://internal/handle-memory-list', {
				method: 'POST',
				body: JSON.stringify({
					slug,
					sessionId,
					type,
					username: authResult.username // Pass authenticated username
				})
			}));

			const responseText = await response.text();
			console.log('[handleMemoryList] Response:', {
				status: response.status,
				headers: Object.fromEntries(response.headers),
				body: responseText.slice(0, 200) + '...'
			});

			return new Response(responseText, {
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('[handleMemoryList] Error:', {
				message: error.message,
				stack: error.stack,
				type: error.constructor.name
			});
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}
	},
	async handleCreateBackup(request, env) {
		try {
			const { userId, characterName } = await request.json();

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			// Get character data and create backup
			const id = env.CHARACTER_REGISTRY.idFromName("global");
			const registry = env.CHARACTER_REGISTRY.get(id);

			// Export character data
			const exportResponse = await registry.fetch(new Request('http://internal/export-character', {
				method: 'POST',
				body: JSON.stringify({
					userId,
					characterName
				})
			}));

			if (!exportResponse.ok) {
				throw new Error('Failed to export character data');
			}

			const exportData = await exportResponse.json();
			const timestamp = new Date().toISOString();
			const backupKey = `${userId}/${characterName}/checkpoints/${timestamp}-${crypto.randomUUID()}.json`;

			// Store in backup bucket
			await env.CHARACTER_BACKUPS.put(backupKey, JSON.stringify(exportData), {
				httpMetadata: {
					contentType: 'application/json',
					cacheControl: 'private, no-cache'
				}
			});

			return new Response(JSON.stringify({
				success: true,
				message: 'Backup created successfully',
				timestamp
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});

		} catch (error) {
			console.error('Create backup error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to create backup',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},

	async handleListBackups(request, env) {
		try {
			const url = new URL(request.url);
			const userId = url.searchParams.get('userId');
			const characterName = url.searchParams.get('characterName');

			if (!userId || !characterName) {
				return new Response(JSON.stringify({
					error: 'Missing required parameters'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS }
				});
			}

			// Auth check
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}
			const [, apiKey] = authHeader.split(' ');

			// Verify API key and username match
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			// Get automatic backups
			const autoBackups = await env.CHARACTER_BACKUPS.list({
				prefix: `${userId}/${characterName}/automatic/`
			});

			// Get checkpoint backups
			const checkpointBackups = await env.CHARACTER_BACKUPS.list({
				prefix: `${userId}/${characterName}/checkpoints/`
			});

			// Format backup data
			const backups = {
				automatic: autoBackups.objects.map(obj => ({
					key: obj.key,
					date: obj.key.split('/automatic/')[1].split('-')[0],
					type: 'automatic',
					uploaded: obj.uploaded
				})),
				checkpoints: checkpointBackups.objects.map(obj => ({
					key: obj.key,
					date: obj.key.split('/checkpoints/')[1].split('-')[0],
					type: 'checkpoint',
					uploaded: obj.uploaded
				}))
			};

			return new Response(JSON.stringify(backups), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});

		} catch (error) {
			console.error('List backups error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to list backups',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},
	async handleDownloadBackup(request, env) {
		try {
			const url = new URL(request.url);
			const userId = url.searchParams.get('userId');
			const characterName = url.searchParams.get('characterName');
			const key = url.searchParams.get('key');

			if (!userId || !characterName || !key) {
				return new Response(JSON.stringify({
					error: 'Missing required parameters'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS }
				});
			}

			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			const [, apiKey] = authHeader.split(' ');
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			const backup = await env.CHARACTER_BACKUPS.get(key);
			if (!backup) {
				return new Response(JSON.stringify({
					error: 'Backup not found'
				}), {
					status: 404,
					headers: { ...CORS_HEADERS }
				});
			}

			const headers = new Headers();
			headers.set('Content-Type', 'application/json');
			headers.set('Content-Disposition', `attachment; filename="${characterName}-backup.json"`);
			Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));

			// Return the raw backup data directly
			return new Response(backup, { headers });
		} catch (error) {
			console.error('Error downloading backup:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},

	async handleDeleteBackup(request, env) {
		try {
			const { userId, characterName, key } = await request.json();

			if (!userId || !characterName || !key) {
				return new Response(JSON.stringify({
					error: 'Missing required parameters'
				}), {
					status: 400,
					headers: { ...CORS_HEADERS }
				});
			}

			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				return new Response(JSON.stringify({
					error: 'Missing Authorization header'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			const [, apiKey] = authHeader.split(' ');
			const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
			if (!isValid) {
				return new Response(JSON.stringify({
					error: 'Unauthorized: Invalid API key or username mismatch'
				}), {
					status: 401,
					headers: { ...CORS_HEADERS }
				});
			}

			// Check if backup exists before attempting to delete
			const exists = await env.CHARACTER_BACKUPS.head(key);
			if (!exists) {
				return new Response(JSON.stringify({
					error: 'Backup not found'
				}), {
					status: 404,
					headers: { ...CORS_HEADERS }
				});
			}

			// Delete the backup
			await env.CHARACTER_BACKUPS.delete(key);

			return new Response(JSON.stringify({
				success: true,
				message: 'Backup deleted successfully'
			}), {
				status: 200,
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Error deleting backup:', error);
			return new Response(JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	},

	async getFeaturedAuthors(env) {
		try {
		  // Get the DO instance for user auth
		  const id = env.USER_AUTH.idFromName("global");
		  const auth = env.USER_AUTH.get(id);
	  
		  // Create a request to the DO to get the data
		  const response = await auth.fetch(new Request('http://internal/get-featured-authors', {
			method: 'GET'
		  }));
	  
		  if (!response.ok) {
			throw new Error(`Failed to fetch featured authors: ${response.status}`);
		  }
	  
		  return await response.json();
		} catch (error) {
		  console.error("Error fetching featured authors:", error);
		  throw error;
		}
	  },	  

	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Handle OPTIONS request first
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: CORS_HEADERS
			});
		}

		// // Initialize Twitter endpoints handler
		// const twitterEndpoints = new TwitterEndpoints(null, env);
		// const twitterResponse = await twitterEndpoints.handleRequest(request, path);
		// if (twitterResponse) {
		// 	return twitterResponse;
		// }

		// Get DO instance (one global instance for the registry)
		const id = env.WORLD_REGISTRY.idFromName("global");
		const registry = env.WORLD_REGISTRY.get(id);

		// Special case for user creation - doesn't require API key auth
		if (path === '/create-user' && request.method === "POST") {
			return await this.handleCreateUser(request, env);
		}

		if (path === '/interactions') {
			const signature = request.headers.get('x-signature-ed25519');
			const timestamp = request.headers.get('x-signature-timestamp');
			const bodyText = await request.text();
			const body = JSON.parse(bodyText);
			const applicationId = body.application_id;

			// Get DO instance with specific app ID
			const bot = getDiscordBot(env, applicationId);

			// Create new request with the same body
			const newRequest = new Request('http://internal/interactions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-signature-ed25519': signature,
					'x-signature-timestamp': timestamp
				},
				body: bodyText
			});

			return bot.fetch(newRequest);
		}


		if (path === '/request-key-roll' && request.method === "POST") {

			const { username, email } = await request.json();

			const id = env.USER_AUTH.idFromName("global");
			const auth = env.USER_AUTH.get(id);

			// Create a new request with the parsed body data
			const internalRequest = new Request('http://internal/request-key-roll', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ username, email })
			});

			return await auth.fetch(internalRequest);
		}

		// Authenticate non-GET requests (except certain public endpoints)
		if (request.method !== 'GET' && ![
			'/search',
			'/initiate-key-roll',
			'/verify-key-roll',
			'/api/character/',
			'/api/character/chat-message',
			'/api/character/message',
			'/migrate-character-schema',
			'/api/character/session',
			'/api/character/asset-upload-chunk',
			'/api/character/asset-upload-complete',
			'/api/character/get-character-assets',
			'/api/character/delete-asset',
			'/api/character/update-asset-metadata',
			'/api/character/handle-asset-thumbnail-upload',
			'/featured-characters',
			'/discord/init',
			'/discord/check',
			'/discord/interactions',
			'/interactions',
			'/memory-list',
			'/migrate-schema',
			'/api/character/backup-list',
			'/api/character/download-backup',
			'/api/character/generate-prompt',
			'/api/character/generate-plan',
			'/api/character/get-plan',
			'/api/user/settings/migrate',
			'/api/user/settings',
			'/api/user/settings/update',
			'/init',
			'/check'
		].includes(path)) {
			if (!await this.authenticateRequest(request, env)) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
				});
			}
		}

		// Main request routing
		switch (request.method) {
			case 'GET': {
				switch (path) {
					case '/': {
						return this.handleHomepage(request, env);
					}
					case '/clear-cache': {
						return this.handleClearCacheGet(request, env);
					}
					case '/get-world': {
						return await this.handleGetWorld(request, env);
					}
					case '/api/character': {
						try {
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
								});
							}

							const url = new URL(request.url);
							const author = url.searchParams.get('author');
							const slug = url.searchParams.get('slug');

							if (!author || !slug) {
								return new Response(JSON.stringify({ error: 'Missing author or slug parameter' }), {
									status: 400,
									headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
								});
							}

							const [, apiKey] = authHeader.split(' ');
							const isValid = await this.verifyApiKeyAndUsername(apiKey, author, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const response = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author, slug })
							}));

							if (!response.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
								});
							}

							return new Response(await response.text(), {
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						} catch (error) {
							console.error('Get character error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}
					case '/api/character/backup-list': {
						return await this.handleListBackups(request, env);
					}
					case 'get-world-data': {
						return await this.handleGetWorldData(request, env);
					}
					case '/world-data': {
						return this.handleGetWorldData(request, env);
					}
					case '/author-data': {
						return this.handleGetAuthorData(request, env);
					}
					case '/authors-list': {
						return this.handleGetAuthorsList(env);
					}
					case '/version-check': {
						return this.handleVersionCheck(request, env);
					}
					case '/memory-list': {
						return await this.handleMemoryList(request, env);
					}
					case '/api/character/download-backup': {
						return await this.handleDownloadBackup(request, env);
					}
					case '/visit-count': {
						return this.getVisitCount(request, env);
					}
					case '/register': {
						return generateRegisterHTML();
					}
					case '/roll-api-key': {
						if (url.searchParams.has('token')) {
							return generateRollKeyHTML();
						}
						return generateRequestKeyRollHTML();
					}
					case '/roll-key-with-token': {
						const { token } = await request.json();
						const id = env.USER_AUTH.idFromName("global");
						const auth = env.USER_AUTH.get(id);
						return await auth.fetch(request);
					}
					case '/search': {
						const searchQuery = url.searchParams.get('q') || '';
						const searchTags = url.searchParams.getAll('tag');
						const limit = parseInt(url.searchParams.get('limit') || '20');
						const offset = parseInt(url.searchParams.get('offset') || '0');

						const searchRequest = new Request('http://internal/search', {
							method: 'POST',
							body: JSON.stringify({
								query: searchQuery,
								tags: searchTags,
								limit,
								offset
							})
						});

						const results = await registry.fetch(searchRequest);
						return new Response(await results.text(), {
							headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
						});
					}
					case '/directory/search': {
						return this.handleSearchResultsPage(request, env);
					}
					case '/character-data': {
						return this.handleGetCharacterData(request, env);
					}
					case '/featured-characters': {
						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);

						const request = new Request('http://internal/get-featured-characters', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ authors: ['antpb'] })
						});

						const response = await registry.fetch(request);
						return new Response(await response.text(), {
							headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
						});
					}
					case '/author-characters': {
						return this.handleGetAuthorCharacters(request, env);
					}
					case '/api/user/settings': {
						const { username, id, success } = await this.authenticateRequest(request, env);
						if (!success) {
							return new Response(JSON.stringify({ error: 'Unauthorized' }), {
								status: 401,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}

						const authId = env.USER_AUTH.idFromName("global");
						const auth = env.USER_AUTH.get(authId);

						console.log("username is", username);
						
						const response = await auth.fetch(new Request('http://internal/get-user-settings', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ username, id })
						}));

						const settings = await response.json();
						return new Response(JSON.stringify(settings), {
							headers: { 
								'Content-Type': 'application/json',
								'Access-Control-Allow-Origin': '*',
								'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
								'Access-Control-Allow-Headers': 'Content-Type, Authorization'
							}
						});
					}
					case '/websocket/': {
						const channelId = path.split('/')[2];
						const upgradeHeader = request.headers.get('Upgrade');

						if (!upgradeHeader || upgradeHeader !== 'websocket') {
							return new Response('Expected Upgrade: websocket', { status: 426 });
						}

						const bot = getDiscordBot(env);

						return bot.fetch(request);
					}
					case '/featured-authors': {
						if (request.method === "GET") {
							try {
								const authors = await this.getFeaturedAuthors(env);
								return new Response(JSON.stringify(authors), {
									headers: {
										'Content-Type': 'application/json',
										'Access-Control-Allow-Origin': '*',
										'Access-Control-Allow-Methods': 'GET',
										'Access-Control-Allow-Headers': 'Content-Type'
									}
								});
							} catch (error) {
								return new Response(JSON.stringify({
									error: 'Failed to fetch featured authors',
									details: error.message
								}), {
									status: 500,
									headers: {
										'Content-Type': 'application/json',
										'Access-Control-Allow-Origin': '*'
									}
								});
							}
						}
						return new Response('Method not allowed', { 
							status: 405,
							headers: {
								'Access-Control-Allow-Origin': '*'
							}
						});
					}
					default: {
						// Handle directory and author paths that need path parameter extraction
						if (path.startsWith('/directory/') && path.split('/').length === 4) {
							return this.handleGetWorldDirectory(request, env);
						}
						if (path.startsWith('/characters/') && path.split('/').length === 4) {
							return this.handleGetCharacterDirectory(request, env);
						}
						if (path.startsWith('/author/') && path.split('/').length === 3) {
							return this.handleGetAuthorDirectory(request, env);
						}
						break;
					}
				}
				break;
			}

			case 'POST': {
				switch (path) {
					case '/init': {
						try {
							const clonedRequest = request.clone();
							const bodyData = await clonedRequest.text();
							let applicationId = 'default';

							try {
								const jsonData = JSON.parse(bodyData);
								applicationId = jsonData.applicationId || 'default';
							} catch (e) {
								console.error('Failed to parse JSON from init request:', e);
							}

							// Remove this line since it's redundant with getDiscordBot
							// const id = env.DISCORD_BOTS.idFromName(applicationId);
							const bot = getDiscordBot(env, applicationId);

							// Create new request with the stored body data
							return bot.fetch(new Request('http://internal/init', {
								method: 'POST',
								headers: request.headers,
								body: bodyData
							}));
						} catch (error) {
							console.error('Init handler error:', error);
							return new Response(JSON.stringify({
								error: 'Failed to process init request',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}

					case '/check': {
						// Get applicationId from body
						const body = await request.json();
						const applicationId = body.applicationId || 'default';
						const bot = getDiscordBot(env, applicationId);
						return bot.fetch(new Request('http://internal/check', {
							method: 'POST'
						}));
					}
					case '/migrate-data': {
						try {
							const migrateRequest = new Request('http://internal/migrate-data', {
								method: 'POST',
								body: JSON.stringify({})
							});
							const response = await registry.fetch(migrateRequest);

							// Even if there's a JSON parse error, check if columns were added
							const text = await response.text();
							let result;
							try {
								result = JSON.parse(text);
							} catch (e) {
								// If JSON parsing fails but we see success indicators in the text
								if (text.includes('Updated table schema') ||
									text.includes('activation_count')) {
									result = {
										success: true,
										message: 'Schema update completed with warnings',
										warning: 'Migration completed but encountered non-fatal errors'
									};
								} else {
									throw e; // Re-throw if it's a real error
								}
							}

							return new Response(JSON.stringify(result), {
								status: 200,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						} catch (error) {
							return new Response(JSON.stringify({
								success: false,
								error: 'Migration error',
								details: error.message,
								status: 'partial',
								message: 'Schema may have been updated despite errors'
							}), {
								status: 200, // Using 200 since it might be partially successful
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}
					case '/delete-world': {
						try {
							const { authorName, worldName } = await request.json();
							const response = await removeWorld(authorName, worldName, env);
							return new Response(JSON.stringify(response), {
								status: response.success ? 200 : 400,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						} catch (error) {
							return new Response(JSON.stringify({
								success: false,
								message: 'Failed to delete world'
							}), {
								status: 500,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}
					case '/generate-character': {
						try {
							const { prompt } = await request.json();
							const character = await this.generateCharacter(prompt, env);

							return new Response(JSON.stringify(character), {
								status: 200,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						} catch (error) {
							console.error('Character generation error:', error);
							return new Response(JSON.stringify({
								error: 'Failed to generate character',
								details: error.message
							}), {
								status: error.message.includes('refused') ? 400 : 500,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}
					case '/api/character/memory': {
						const { sessionId, content, type, userId, userName, roomId, agentId, isUnique, importance_score } = await request.json();

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);

						const response = await registry.fetch(new Request('http://internal/create-memory', {
							method: 'POST',
							body: JSON.stringify({ sessionId, content, type, userId, userName, roomId, agentId, isUnique, importance_score })
						}));

						return new Response(await response.text(), {
							headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
						});
					}
					case '/api/character/memories': {
						const url = new URL(request.url);
						const sessionId = url.searchParams.get('sessionId');
						const roomId = url.searchParams.get('roomId');
						const count = parseInt(url.searchParams.get('count') || '10');
						const type = url.searchParams.get('type');
						const unique = url.searchParams.get('unique') === 'true';

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);

						const response = await registry.fetch(new Request('http://internal/get-memories', {
							method: 'POST',
							body: JSON.stringify({ sessionId, roomId, count, type, unique })
						}));

						return new Response(await response.text(), {
							headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
						});
					}

					case '/api/character/memories/by-rooms': {
						const { sessionId, agentId, roomIds, count } = await request.json();

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);

						const response = await registry.fetch(new Request('http://internal/get-memories-by-rooms', {
							method: 'POST',
							body: JSON.stringify({ sessionId, agentId, roomIds, count })
						}));

						return new Response(await response.text(), {
							headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
						});
					}

					case '/api/twitter/post': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, tweet, sessionId, roomId, nonce } = await request.json();
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character very not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							return await registry.fetch(new Request('http://internal/twitter-post', {
								method: 'POST',
								body: JSON.stringify({ userId, characterName, tweet, sessionId, roomId, nonce, character })
							}));
						} catch (error) {
							console.error('Twitter post error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/twitter/notifications': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, sessionId, roomId, nonce, updatedCharacter } = await request.json();
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							return await registry.fetch(new Request('http://internal/api/twitter/notifications', {
								method: 'POST',
								body: JSON.stringify({ userId, characterName, sessionId, roomId, nonce, character })
							}));
						} catch (error) {
							console.error('Twitter notifications error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/twitter/retweet': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, tweetId, quoteText } = await request.json();

							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							return await registry.fetch(new Request('http://internal/twitter-retweet', {
								method: 'POST',
								body: JSON.stringify({
									characterId: character.id,
									tweetId,
									quoteText
								})
							}));
						} catch (error) {
							console.error('Twitter retweet error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/twitter/reply': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, tweetId, replyText } = await request.json();

							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							return await registry.fetch(new Request('http://internal/twitter-reply', {
								method: 'POST',
								body: JSON.stringify({
									characterId: character.id,
									tweetId,
									replyText,
									characterName,
									userId
								})
							}));
						} catch (error) {
							console.error('Twitter reply error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/twitter/like': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, tweetId } = await request.json();

							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							return await registry.fetch(new Request('http/internal/twitter-like', {
								method: 'POST',
								body: JSON.stringify({
									characterId: character.id,
									tweetId
								})
							}));
						} catch (error) {
							console.error('Twitter like error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/discord-credentials': {
						try {
							const { userId, characterName } = await request.json();

							// Auth check
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({
									error: 'Missing Authorization header'
								}), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							// Verify API key and username match
							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({
									error: 'Invalid API key or username mismatch'
								}), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							// Get character ID first
							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							// First get the character
							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({
									error: 'Character not found'
								}), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();
							// Now get Discord credentials using character ID
							const credsResponse = await registry.fetch(new Request('http://internal/get-discord-credentials', {
								method: 'POST',
								body: JSON.stringify({ characterId: character.id, env })
							}));

							return new Response(await credsResponse.text(), {
								status: credsResponse.status,
								headers: { ...CORS_HEADERS }
							});

						} catch (error) {
							console.error('Discord credentials error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/get-my-telegram-credentials': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName } = await request.json();
							// Auth check
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');
							// Verify API key and username match
							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								console.error('Character lookup failed:', await charResponse.text());
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();
							const credResponse = await registry.fetch(new Request('http://internal/get-telegram-credentials', {
								method: 'POST',
								body: JSON.stringify({ characterId: character.id }),
							}));

							return new Response(await credResponse.text(), {
								status: credResponse.status,
								headers: { ...CORS_HEADERS }
							});
						} catch (error) {
							console.error('Telegram credentials error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/api/telegram/message': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, chatId, message, sessionId, roomId, nonce } = await request.json();
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								console.error('Character lookup failed:', await charResponse.text());
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();
							console.log('Character is:', character);
							return await registry.fetch(new Request('http://internal/telegram-message', {
								method: 'POST',
								body: JSON.stringify({
									characterId: character.id,
									chatId,
									message,
									sessionId,
									roomId,
									nonce
								})
							}));
						} catch (error) {
							console.error('Telegram message error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/telegram/updates': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, sessionId, roomId, nonce } = await request.json();

							const character = await this.getCharacter(userId, characterName);
							if (!character) {
								throw new Error('Character not found');
							}

							const secrets = await this.getCharacterSecrets(character.id);
							if (!secrets?.modelKeys?.telegram_token) {
								throw new Error('Telegram credentials not found');
							}

							const { TelegramClient } = await import('./telegram-client/index.js');
							const client = new TelegramClient({
								token: secrets.modelKeys.telegram_token
							});

							const updates = await client.getUpdates();
							const { nonce: newNonce } = await this.nonceManager.createNonce(roomId, sessionId);

							return new Response(JSON.stringify({
								updates,
								nonce: newNonce
							}), {
								headers: {
									'Content-Type': 'application/json',
									...CORS_HEADERS
								}
							});
						} catch (error) {
							console.error('Telegram updates error:', {
								message: error.message,
								stack: error.stack,
								type: error.constructor.name
							});

							return new Response(JSON.stringify({
								error: 'Failed to fetch updates',
								details: error.message
							}), {
								status: error.message.includes('not found') ? 404 : 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/telegram/reply': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, messageId, replyText, chatId, sessionId, roomId, nonce } = await request.json();

							const character = await this.getCharacter(userId, characterName);
							if (!character) {
								throw new Error('Character not found');
							}

							const secrets = await this.getCharacterSecrets(character.id);
							if (!secrets?.modelKeys?.telegram_token) {
								throw new Error('Telegram credentials not found');
							}

							const { TelegramClient } = await import('./telegram-client/index.js');
							const client = new TelegramClient({
								token: secrets.modelKeys.telegram_token
							});

							const result = await client.replyToMessage(chatId, messageId, replyText);
							const { nonce: newNonce } = await this.nonceManager.createNonce(roomId, sessionId);

							return new Response(JSON.stringify({
								message: result,
								nonce: newNonce
							}), {
								headers: { ...CORS_HEADERS }
							});
						} catch (error) {
							console.error('Telegram reply error:', error);
							return new Response(JSON.stringify({
								error: 'Failed to send reply',
								details: error.message
							}), {
								status: error.message.includes('not found') ? 404 : 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/telegram/edit': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, messageId, newText, chatId, sessionId, roomId, nonce } = await request.json();

							const character = await this.getCharacter(userId, characterName);
							if (!character) {
								throw new Error('Character not found');
							}

							const secrets = await this.getCharacterSecrets(character.id);
							if (!secrets?.modelKeys?.telegram_token) {
								throw new Error('Telegram credentials not found');
							}

							const { TelegramClient } = await import('./telegram-client/index.js');
							const client = new TelegramClient({
								token: secrets.modelKeys.telegram_token
							});

							const result = await client.editMessage(chatId, messageId, newText);
							const { nonce: newNonce } = await this.nonceManager.createNonce(roomId, sessionId);

							return new Response(JSON.stringify({
								message: result,
								nonce: newNonce
							}), {
								headers: { ...CORS_HEADERS }
							});
						} catch (error) {
							console.error('Telegram edit error:', error);
							return new Response(JSON.stringify({
								error: 'Failed to edit message',
								details: error.message
							}), {
								status: error.message.includes('not found') ? 404 : 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/telegram/pin': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, messageId, chatId, sessionId, roomId, nonce } = await request.json();

							const character = await this.getCharacter(userId, characterName);
							if (!character) {
								throw new Error('Character not found');
							}

							const secrets = await this.getCharacterSecrets(character.id);
							if (!secrets?.modelKeys?.telegram_token) {
								throw new Error('Telegram credentials not found');
							}

							const { TelegramClient } = await import('./telegram-client/index.js');
							const client = new TelegramClient({
								token: secrets.modelKeys.telegram_token
							});

							const result = await client.pinMessage(chatId, messageId);
							const { nonce: newNonce } = await this.nonceManager.createNonce(roomId, sessionId);

							return new Response(JSON.stringify({
								success: result,
								nonce: newNonce
							}), {
								headers: { ...CORS_HEADERS }
							});
						} catch (error) {
							console.error('Telegram pin error:', error);
							return new Response(JSON.stringify({
								error: 'Failed to pin message',
								details: error.message
							}), {
								status: error.message.includes('not found') ? 404 : 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/api/telegram/messages': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, chatId, sessionId, roomId, nonce } = await request.json();

							// Auth check
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							// Get character to verify it exists and get ID
							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								console.error('Character lookup failed:', await charResponse.text());
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							// Forward to internal handler
							const messagesResponse = await registry.fetch(new Request('http://internal/telegram-messages', {
								method: 'POST',
								body: JSON.stringify({
									characterId: character.id,
									chatId,
									sessionId,
									roomId,
									nonce
								})
							}));

							// Just return the response from CharacterRegistryDO which will include the nonce
							return new Response(await messagesResponse.text(), {
								status: messagesResponse.status,
								headers: { ...CORS_HEADERS }
							});
						} catch (error) {
							console.error('Telegram messages error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/get-my-twitter-credentials': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName } = await request.json();
							// Auth check
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');
							// Verify API key and username match
							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							// Get character ID first
							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);
							// First get the character
							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();
							// Get Twitter credentials using character ID
							const credsResponse = await registry.fetch(new Request('http://internal/get-twitter-credentials', {
								method: 'POST',
								body: JSON.stringify({ characterId: character.id }),
							}));

							return new Response(await credsResponse.text(), {
								status: credsResponse.status,
								headers: { ...CORS_HEADERS }
							});
						} catch (error) {
							console.error('Twitter credentials error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/initiate-key-roll': {
						const { username, email } = await request.json();
						if (!username || !email) {
							return new Response(JSON.stringify({
								error: 'Missing required fields'
							}), {
								status: 400,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}

						const id = env.USER_AUTH.idFromName("global");
						const auth = env.USER_AUTH.get(id);

						const internalRequest = new Request('http://internal/initiate-key-roll', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ username, email })
						});

						return await auth.fetch(internalRequest);
					}
					case '/upload-character-image': {
						return await this.handleCharacterImageUpload(request, env);
					}
					case '/update-character-keys': {
						return await this.handleUpdateCharacterKeys(request, env);
					}
					case '/verify-key-roll': {
						const { gistUrl, verificationToken } = await request.json();
						if (!gistUrl || !verificationToken) {
							return new Response(JSON.stringify({
								error: 'Missing required fields'
							}), {
								status: 400,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}

						const id = env.USER_AUTH.idFromName("global");
						const auth = env.USER_AUTH.get(id);

						const internalRequest = new Request('http://internal/verify-key-roll', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ gistUrl, verificationToken })
						});

						return await auth.fetch(internalRequest);
					}

					case '/delete-author': {
						try {
							const { authorName } = await request.json();
							const response = await removeAuthor(authorName, env);
							return new Response(JSON.stringify(response), {
								status: response.success ? 200 : 400,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						} catch (error) {
							return new Response(JSON.stringify({
								success: false,
								message: 'Failed to delete author'
							}), {
								status: 500,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}

					case '/migrate-authors': {
						const id = env.WORLD_REGISTRY.idFromName("global");
						const registry = env.WORLD_REGISTRY.get(id);

						const migrateRequest = new Request('http://internal/migrate-authors', {
							method: 'POST'
						});
						const response = await registry.fetch(migrateRequest);

						return new Response(await response.text(), {
							status: response.status,
							headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
						});
					}
					case '/record-visit': {
						const author = url.searchParams.get('author');
						const slug = url.searchParams.get('slug');

						if (!author || !slug) {
							return new Response(JSON.stringify({ error: 'Missing author or slug parameter' }), {
								status: 400,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}

						const downloadRequest = new Request(url, {
							method: 'POST',
							body: JSON.stringify({ author, slug })
						});
						return await registry.fetch(downloadRequest);
					}
					case '/api/character/chat-message': {
						try {
							const { roomId, sessionId, message, nonce } = await request.json();
							if (!sessionId || !message) {
								return new Response(JSON.stringify({
									error: 'Missing required fields'
								}), {
									status: 400,
									headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
								});
							}

							// Get API key from header if it exists
							const apiKey = request.headers.get('Authorization');

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const response = await registry.fetch(new Request('http://internal/send-chat-message', {
								method: 'POST',
								body: JSON.stringify({ roomId, sessionId, message, nonce, apiKey }) // Pass apiKey to DO
							}));

							if (!response.ok) {
								const error = await response.text();
								if (error.includes('Invalid or expired nonce')) {
									return new Response(JSON.stringify({
										error: 'Session expired, please start a new session',
										code: 'SESSION_EXPIRED'
									}), {
										status: 401,
										headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
									});
								}
								throw new Error(error);
							}

							const result = await response.json();
							return new Response(JSON.stringify(result), {
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						} catch (error) {
							console.error('Message handling error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}
					case '/api/character/message': {
						try {
							const { roomId, sessionId, message, nonce } = await request.json();
							if (!sessionId || !message) {
								return new Response(JSON.stringify({
									error: 'Missing required fields'
								}), {
									status: 400,
									headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
								});
							}

							// Get API key from header if it exists
							const apiKey = request.headers.get('Authorization');

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const response = await registry.fetch(new Request('http://internal/send-chat-message', {
								method: 'POST',
								body: JSON.stringify({ roomId, sessionId, message, nonce, apiKey }) // Pass apiKey to DO
							}));

							if (!response.ok) {
								const error = await response.text();
								if (error.includes('Invalid or expired nonce')) {
									return new Response(JSON.stringify({
										error: 'Session expired, please start a new session',
										code: 'SESSION_EXPIRED'
									}), {
										status: 401,
										headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
									});
								}
								throw new Error(error);
							}

							const result = await response.json();
							return new Response(JSON.stringify(result), {
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						} catch (error) {
							console.error('Message handling error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
							});
						}
					}
					case '/api/character/session': {
						return await this.handleCharacterSession(request, env);
					}
					case '/migrate-character-schema': {
						return await this.handleCharacterSchemaMigration(request, env);
					}
					case '/upload-character': {
						return this.handleCharacterUpload(request, env);
					}
					case '/update-character': {
						return await this.handleCharacterUpdate(request, env);
					}
					case '/update-character-metadata': {
						return await this.handleCharacterMetadata(request, env);
					}
					case '/delete-character': {
						return await this.handleDeleteCharacter(request, env);
					}
					case '/upload-world': {
						return await this.handleWorldUpload(request, env);
					}
					case 'update-world': {
						return await this.handleWorldMetadata(request, env);
					}
					case '/world-metadata': {
						return await this.handleWorldMetadata(request, env);
					}
					case '/update-active-users': {
						return await this.handleUpdateActiveUsers(request, env);
					}
					case '/world-upload-assets': {
						return this.handleUploadAsset(request, env);
					}
					case '/update-author-info': {
						return this.handleUpdateAuthorInfo(request, env);
					}
					case '/backup-world': {
						return this.handleBackupWorld(request, env);
					}
					case '/clear-cache': {
						return this.handleClearCache(request, env);
					}
					case '/create-user': {
						return await this.handleCreateUser(request, env);
					}
					case '/delete-user': {
						return this.handleDeleteUser(request, env);
					}
					case '/rotate-key': {
						return await this.handleRotateApiKey(request, env);
					}
					case '/admin-update-user': {
						const id = env.USER_AUTH.idFromName("global");
						const auth = env.USER_AUTH.get(id);

						// Verify API key at the worker level
						const authHeader = request.headers.get('Authorization');
						if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
							return new Response(JSON.stringify({
								error: 'Unauthorized'
							}), { status: 401 });
						}

						// Create internal request with admin flag @todo maybe this can be different in the future.
						const internalRequest = new Request('http://internal/admin-update-user', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'X-Admin-Secret': env.API_SECRET
							},
							body: JSON.stringify(await request.json())
						});

						return await auth.fetch(internalRequest);
					}
					case '/api/twitter/classify': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, text } = await request.json();

							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							return await registry.fetch(new Request('http://internal/handle-twitter-classify', {
								method: 'POST',
								body: JSON.stringify({
									userId,
									characterName,
									text
								})
							}));
						} catch (error) {
							console.error('Twitter classify error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/api/character/asset-upload-chunk': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/handle-asset-chunk-upload', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}
					
					case '/api/character/asset-upload-complete': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/handle-asset-upload-complete', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}
					
					case '/api/character/assets': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/get-character-assets', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}
					
					case '/api/character/delete-asset': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/delete-asset', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}
					
					case '/api/character/update-asset-metadata': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/update-asset-metadata', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}
					
					case '/api/character/asset-thumbnail-upload': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/handle-asset-thumbnail-upload', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}
					case '/api/twitter/post-with-media': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const formData = await request.formData();
							const userId = formData.get('userId');
							const characterName = formData.get('characterName');

							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							const charResponse = await registry.fetch(new Request('http://internal/get-character', {
								method: 'POST',
								body: JSON.stringify({ author: userId, slug: characterName })
							}));

							if (!charResponse.ok) {
								return new Response(JSON.stringify({ error: 'Character not found' }), {
									status: 404,
									headers: { ...CORS_HEADERS }
								});
							}

							const character = await charResponse.json();

							// Forward the entire FormData to the internal handler
							return await registry.fetch(new Request('http://internal/handle-twitter-post-with-media', {
								method: 'POST',
								body: request.body,
								headers: {
									'Content-Type': request.headers.get('Content-Type')
								}
							}));
						} catch (error) {
							console.error('Twitter post with media error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}

					case '/api/vision/describe': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName, image } = await request.json();

							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							// Call OpenAI's vision API
							const headers = {
								"Content-Type": "application/json",
								"Authorization": `Bearer ${env.OPENAI_API_KEY}`
							};

							const payload = {
								"model": "gpt-4-turbo",
								"messages": [
									{
										"role": "user",
										"content": [
											{
												"type": "text",
												"text": "Describe this image in a concise way that would be natural to include in a tweet. Focus on the main subject and any notable details. Keep it under 100 characters."
											},
											{
												"type": "image_url",
												"image_url": {
													"url": image
												}
											}
										]
									}
								],
								"max_tokens": 100
							};

							const response = await fetch("https://api.openai.com/v1/chat/completions", {
								method: 'POST',
								headers: headers,
								body: JSON.stringify(payload)
							});

							if (!response.ok) {
								const errorData = await response.json();
								console.error('OpenAI API error:', {
									status: response.status,
									statusText: response.statusText,
									error: errorData
								});
								throw new Error(`OpenAI API error: ${JSON.stringify(errorData.error || errorData)}`);
							}

							const data = await response.json();
							const description = data.choices[0].message.content.trim();

							return new Response(JSON.stringify({
								success: true,
								description
							}), {
								headers: {
									...CORS_HEADERS,
									'Content-Type': 'application/json'
								}
							});

						} catch (error) {
							console.error('Vision API error:', error);
							return new Response(JSON.stringify({
								error: 'Failed to generate image description',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/delete-memory': {
						return await this.handleDeleteMemory(request, env);
					}
					case '/find-memory': {
						return await this.handleFindMemory(request, env);
					}
					case '/update-memory': {
						return await this.handleUpdateMemory(request, env);
					}
					case '/memory-list': {
						return await this.handleMemoryList(request, env);
					}
					case '/api/character/export':
					case '/export-character': {
						try {
							const { userId, characterName } = await request.json();
							const characterRegistry = env.CHARACTER_REGISTRY.get(env.CHARACTER_REGISTRY.idFromName('default'));
							const response = await characterRegistry.fetch(new Request('http://internal/export-character', {
								method: 'POST',
								headers: request.headers,
								body: JSON.stringify({ userId, characterName })
							}));
							return response;
						} catch (error) {
							return new Response(JSON.stringify({ error: error.message }), {
								status: 500,
								headers: { 'Content-Type': 'application/json', ...corsHeaders() }
							});
						}
					}
					case '/api/character/import-new': {
						try {
							// Handle preflight request
							if (request.method === 'OPTIONS') {
								return new Response(null, {
									status: 204,
									headers: {
										'Access-Control-Allow-Origin': '*',
										'Access-Control-Allow-Methods': 'POST, OPTIONS',
										'Access-Control-Allow-Headers': 'Content-Type, Authorization',
										'Access-Control-Max-Age': '86400'
									}
								});
							}

							const body = await request.json();
							const { userId, importData, characterData } = body;

							// If we have importData, extract character from it
							const rawCharacterData = characterData || (importData?.character ? importData.character : null);

							if (!rawCharacterData) {
								return new Response(JSON.stringify({
									error: 'Missing character data',
									details: 'Request must include either characterData or importData.character'
								}), {
									status: 400,
									headers: {
										'Content-Type': 'application/json',
										'Access-Control-Allow-Origin': '*'
									}
								});
							}

							// Normalize field names to snake_case
							const finalCharacterData = {
								name: rawCharacterData.name,
								model_provider: rawCharacterData.model_provider || rawCharacterData.modelProvider,
								status: rawCharacterData.status || 'private',
								bio: rawCharacterData.bio || '',
								settings: rawCharacterData.settings || {},
								vrm_url: rawCharacterData.vrm_url || rawCharacterData.vrmUrl,
								profile_img: rawCharacterData.profile_img || rawCharacterData.profileImg,
								banner_img: rawCharacterData.banner_img || rawCharacterData.bannerImg,
								clients: rawCharacterData.clients || ['DIRECT'],
								lore: rawCharacterData.lore || [],
								topics: rawCharacterData.topics || [],
								adjectives: rawCharacterData.adjectives || [],
								messageExamples: rawCharacterData.messageExamples || [],
								postExamples: rawCharacterData.postExamples || [],
								style: rawCharacterData.style || { all: [], chat: [], post: [] },
								wallets: rawCharacterData.wallets || { ETH: '0x0000000000000000000000000000000000000000' }
							};

							const characterRegistry = env.CHARACTER_REGISTRY.get(env.CHARACTER_REGISTRY.idFromName('default'));
							const registryResponse = await characterRegistry.fetch(new Request('http://internal/import-new-character', {
								method: 'POST',
								headers: request.headers,
								body: JSON.stringify({ userId, characterData: finalCharacterData })
							}));

							const responseData = await registryResponse.json();

							return new Response(JSON.stringify(responseData), {
								status: registryResponse.status,
								headers: {
									'Content-Type': 'application/json',
									'Access-Control-Allow-Origin': '*',
									'Access-Control-Allow-Methods': 'POST, OPTIONS',
									'Access-Control-Allow-Headers': 'Content-Type, Authorization'
								}
							});
						} catch (error) {
							return new Response(JSON.stringify({
								error: 'Failed to import character',
								details: error.message
							}), {
								status: 500,
								headers: {
									'Content-Type': 'application/json',
									'Access-Control-Allow-Origin': '*',
									'Access-Control-Allow-Methods': 'POST, OPTIONS',
									'Access-Control-Allow-Headers': 'Content-Type, Authorization'
								}
							});
						}
					}
					case '/api/character/create-backup': {
						return await this.handleCreateBackup(request, env);
					}
					case '/api/character/delete-backup': {
						return await this.handleDeleteBackup(request, env);
					}
					case '/api/character/generate-prompt': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName } = await request.json();
							
							// Auth check
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');

							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}

							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);

							return await registry.fetch(new Request('http://internal/generate-prompt', {
								method: 'POST',
								body: JSON.stringify({ userId, characterName })
							}));
						} catch (error) {
							console.error('Generate prompt error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/api/character/generate-plan': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName } = await request.json();
							
							// Auth check
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');
					
							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
					
							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);
					
							return await registry.fetch(new Request('http://internal/generate-plan', {
								method: 'POST',
								body: JSON.stringify({ userId, characterName })
							}));
						} catch (error) {
							console.error('Generate plan error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					
					case '/api/character/get-plan': {
						if (request.method !== 'POST') {
							return new Response('Method not allowed', { status: 405 });
						}
						try {
							const { userId, characterName } = await request.json();
							
							// Auth check
							const authHeader = request.headers.get('Authorization');
							if (!authHeader) {
								return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
							const [, apiKey] = authHeader.split(' ');
					
							const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
							if (!isValid) {
								return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
									status: 401,
									headers: { ...CORS_HEADERS }
								});
							}
					
							const id = env.CHARACTER_REGISTRY.idFromName("global");
							const registry = env.CHARACTER_REGISTRY.get(id);
					
							return await registry.fetch(new Request('http://internal/get-plan', {
								method: 'POST',
								body: JSON.stringify({ userId, characterName })
							}));
						} catch (error) {
							console.error('Get plan error:', error);
							return new Response(JSON.stringify({
								error: 'Internal server error',
								details: error.message
							}), {
								status: 500,
								headers: { ...CORS_HEADERS }
							});
						}
					}
					case '/api/character/verify-action': {
                        const url = new URL(request.url);
                        const token = url.searchParams.get('token');
                        const isDenied = url.searchParams.get('deny') === 'true';

                        if (!token) {
                            return new Response(JSON.stringify({ error: 'Missing verification token' }), {
                                status: 400,
                                headers: { ...CORS_HEADERS }
                            });
                        }

                        const id = env.CHARACTER_REGISTRY.idFromName("global");
                        const registry = env.CHARACTER_REGISTRY.get(id);

                        try {
                            const response = await registry.fetch(new Request('http://internal/verify-action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token, isDenied })
                            }));

                            const result = await response.json();

                            // Redirect to a success page
                            return new Response(null, {
                                status: 302,
                                headers: {
                                    'Location': `/verification-result?status=${result.status}&message=${encodeURIComponent(result.message)}`,
                                    ...CORS_HEADERS
                                }
                            });
                        } catch (error) {
                            console.error('Verification error:', error);
                            return new Response(JSON.stringify({
                                error: 'Verification failed',
                                details: error.message
                            }), {
                                status: 500,
                                headers: { ...CORS_HEADERS }
                            });
                        }
                    }
					case '/api/user/settings/migrate': {
						const id = env.USER_AUTH.idFromName("global");
						const auth = env.USER_AUTH.get(id);

						// Verify API key at the worker level
						const authHeader = request.headers.get('Authorization');
						if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
							return new Response(JSON.stringify({
								error: 'Unauthorized'
							}), { 
								status: 401,
								headers: {
									'Content-Type': 'application/json',
									...CORS_HEADERS
								}
							});
						}

						try {
							const internalRequest = new Request('http://internal/migrate-user-settings', {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'X-Admin-Secret': env.API_SECRET
								},
								body: JSON.stringify({ action: 'migrate' })
							});

							const response = await auth.fetch(internalRequest);
							
							if (!response.ok) {
								const errorData = await response.json();
								return new Response(JSON.stringify(errorData), {
									status: response.status,
									headers: {
										'Content-Type': 'application/json',
										...CORS_HEADERS
									}
								});
							}

							const result = await response.json();
							return new Response(JSON.stringify(result), {
								headers: {
									'Content-Type': 'application/json',
									...CORS_HEADERS
								}
							});
						} catch (error) {
							console.error('Migration error:', error);
							return new Response(JSON.stringify({
								error: 'Migration failed',
								details: error.message
							}), {
								status: 500,
								headers: {
									'Content-Type': 'application/json',
									...CORS_HEADERS
								}
							});
						}
					}
					case '/api/user/settings/update': {
						if (request.method === 'POST') {
							const { username } = await this.authenticateRequest(request, env);
							const { settings } = await request.json();
							
							if (settings.companion_slug) {
								const charId = env.CHARACTER_REGISTRY.idFromName("global");
								const charRegistry = env.CHARACTER_REGISTRY.get(charId);
												try {
									const companion = await charRegistry.fetch(new Request('http://internal/get-character', {
										method: 'POST',
										// headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ author: username, slug: settings.companion_slug })
									}));
									
									if (!companion.ok) {
										return new Response(JSON.stringify({
											error: 'Invalid companion_slug. Character not found.'
										}), {
											status: 400,
											headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
										});
									}
								} catch (error) {
									return new Response(JSON.stringify({
										error: 'Failed to validate companion',
										details: error.message
									}), {
										status: 500,
										headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
									});
								}
							}

							if (settings.vrm_url && !settings.vrm_url.match(/^https?:\/\/.+\.vrm$/i)) {
								return new Response(JSON.stringify({
									error: 'Invalid VRM URL. Must be a URL ending in .vrm'
								}), {
									status: 400,
									headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
								});
							}

							const id = env.USER_AUTH.idFromName("global");
							const auth = env.USER_AUTH.get(id);

							const internalRequest = new Request('http://internal/update-user-settings', {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json'
								},
								body: JSON.stringify({ username, settings })
							});

							try {
								const response = await auth.fetch(internalRequest);
								const result = await response.json();

								return new Response(JSON.stringify(result), {
									status: response.status,
									headers: {
										'Content-Type': 'application/json',
										...CORS_HEADERS
									}
								});
							} catch (error) {
								return new Response(JSON.stringify({
									error: 'Settings update failed',
									details: error.message
								}), {
									status: 500,
									headers: {
										'Content-Type': 'application/json',
										...CORS_HEADERS
									}
								});
							}
						} else if (request.method === 'OPTIONS') {
							return new Response(null, {
								headers: {
									...CORS_HEADERS,
									'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
									'Access-Control-Allow-Headers': 'Content-Type, Authorization'
								}
							});
						}
						break;
					}
					case '/api/author/asset-upload-chunk': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/handle-author-asset-chunk-upload', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}

					case '/api/author/asset-upload-complete': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/handle-author-asset-upload-complete', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}

					case '/api/author/assets': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/get-author-assets', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}

					case '/api/author/delete-asset': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/delete-author-asset', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}

					case '/api/author/update-asset-metadata': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/update-author-asset-metadata', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}

					case '/api/author/asset-thumbnail-upload': {
						const { userId, ...requestData } = await request.json();

						const authHeader = request.headers.get('Authorization');
						if (!authHeader) {
							return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}
						const [, apiKey] = authHeader.split(' ');

						const isValid = await this.verifyApiKeyAndUsername(apiKey, userId, env);
						if (!isValid) {
							return new Response(JSON.stringify({ error: 'Invalid API key or username mismatch' }), {
								status: 401,
								headers: { ...CORS_HEADERS }
							});
						}

						const id = env.CHARACTER_REGISTRY.idFromName("global");
						const registry = env.CHARACTER_REGISTRY.get(id);
						const response = await registry.fetch(new Request('http://internal/handle-author-asset-thumbnail-upload', {
							method: 'POST',
							headers: request.headers,
							body: JSON.stringify({ userId, ...requestData })
						}));
						
						const responseData = await response.text();
						return new Response(responseData, {
							status: response.status,
							headers: {
								...CORS_HEADERS,
								'Content-Type': 'application/json'
							}
						});
					}
				default: {
						return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
							status: 404,
							headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
						});
					}
				}
				break;
			}

			default: {
				return new Response(JSON.stringify({ error: 'Method not allowed' }), {
					status: 405,
					headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
				});
			}
		}

		return new Response(JSON.stringify({ error: 'Not found' }), {
			status: 404,
			headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
		});
	}
}



