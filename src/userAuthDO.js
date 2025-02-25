export class UserAuthDO {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		this.sql = state.storage.sql;  // This is correct

		if (!env.USER_KEY_SALT) {
			throw new Error('Missing required secret: USER_KEY_SALT');
		}

		this.initializeSchema();
	}

	async initializeSchema() {
		try {
			await this.sql.exec(`
				CREATE TABLE IF NOT EXISTS users (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL UNIQUE,
					email TEXT NOT NULL,
					github_username TEXT,
					key_id TEXT NOT NULL UNIQUE,
					key_hash TEXT NOT NULL,
					invite_code_used TEXT NOT NULL,
					created_at INTEGER DEFAULT (unixepoch()),
					last_key_rotation INTEGER DEFAULT (unixepoch())
				);

				CREATE INDEX IF NOT EXISTS idx_users_key_id 
				ON users(key_id);

				CREATE TABLE IF NOT EXISTS key_roll_verifications (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL,
					verification_token TEXT NOT NULL UNIQUE,
					created_at INTEGER DEFAULT (unixepoch()),
					expires_at INTEGER NOT NULL,
					used INTEGER DEFAULT 0,
					FOREIGN KEY(username) REFERENCES users(username)
				);

				CREATE TABLE IF NOT EXISTS user_settings (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL,
					telegram_chat_id TEXT,
					telegram_username TEXT,
					verification_enabled INTEGER DEFAULT 1,
					auto_approve_low_risk INTEGER DEFAULT 0,
					companion_slug TEXT,
					vrm_url TEXT,
					display_name TEXT,
					status TEXT,
					profile_img TEXT,
					banner_img TEXT,
					extras TEXT DEFAULT '{}',
					private_extras TEXT DEFAULT '{}',
					created_at INTEGER DEFAULT (unixepoch()),
					updated_at INTEGER DEFAULT (unixepoch()),
					FOREIGN KEY(username) REFERENCES users(username),
					UNIQUE(username)
				);
			`);

			// Create default settings for existing users
			await this.sql.exec(`
				INSERT OR IGNORE INTO user_settings (username)
				SELECT username FROM users
				WHERE username NOT IN (SELECT username FROM user_settings)
			`);
		} catch (error) {
			console.error("Error initializing user auth schema:", error);
			throw error;
		}
	}

	async migrateUserSettings() {
		try {
			const columns = await this.sql.exec("PRAGMA table_info(user_settings)").toArray();

			if (!columns.some(col => col.name === 'companion_slug')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN companion_slug TEXT");
			}

			if (!columns.some(col => col.name === 'vrm_url')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN vrm_url TEXT");
			}

			if (!columns.some(col => col.name === 'display_name')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN display_name TEXT");
			}

			if (!columns.some(col => col.name === 'status')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN status TEXT");
			}

			if (!columns.some(col => col.name === 'profile_img')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN profile_img TEXT");
			}

			if (!columns.some(col => col.name === 'banner_img')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN banner_img TEXT");
			}

			if (!columns.some(col => col.name === 'extras')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN extras TEXT DEFAULT '{}'");
			}

			if (!columns.some(col => col.name === 'private_extras')) {
				await this.sql.exec("ALTER TABLE user_settings ADD COLUMN private_extras TEXT DEFAULT '{}'");
			}

			return { success: true, message: 'User settings migration completed' };
		} catch (error) {
			console.error('User settings migration failed:', error);
			throw error;
		}
	}

	async updateUserSettings(username, settings) {
		try {
			await this.sql.exec(`
				INSERT INTO user_settings (
					username,
					telegram_chat_id,
					telegram_username,
					verification_enabled,
					auto_approve_low_risk,
					companion_slug,
					vrm_url,
					display_name,
					status,
					profile_img,
					banner_img,
					extras,
					private_extras,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
				ON CONFLICT(username) DO UPDATE SET
					telegram_chat_id = ?,
					telegram_username = ?,
					verification_enabled = ?,
					auto_approve_low_risk = ?,
					companion_slug = ?,
					vrm_url = ?,
					display_name = ?,
					status = ?,
					profile_img = ?,
					banner_img = ?,
					extras = ?,
					private_extras = ?,
					updated_at = unixepoch()
			`,
				username,
				settings.telegram_chat_id,
				settings.telegram_username,
				settings.verification_enabled ? 1 : 0,
				settings.auto_approve_low_risk ? 1 : 0,
				settings.companion_slug,
				settings.vrm_url,
				settings.display_name,
				settings.status,
				settings.profile_img,
				settings.banner_img,
				settings.extras || '{}',
				settings.private_extras || '{}',
				// Repeat values for UPDATE part
				settings.telegram_chat_id,
				settings.telegram_username,
				settings.verification_enabled ? 1 : 0,
				settings.auto_approve_low_risk ? 1 : 0,
				settings.companion_slug,
				settings.vrm_url,
				settings.display_name,
				settings.status,
				settings.profile_img,
				settings.banner_img,
				settings.extras || '{}',
				settings.private_extras || '{}'
			);

			return { success: true };
		} catch (error) {
			console.error('Failed to update user settings:', error);
			throw error;
		}
	}

	async handleGetFeaturedAuthors() {
		try {
		  console.log("Handling GET featured-authors request");
		  
		  // First get all users with their settings
		  const authors = await this.sql.exec(`
			SELECT 
			  u.username,
			  u.github_username,
			  us.display_name,
			  us.status,
			  us.profile_img,
			  us.banner_img,
			  us.extras,
			  us.companion_slug,
			  us.vrm_url
			FROM users u
			JOIN user_settings us ON u.username = us.username
			WHERE us.extras IS NOT NULL
			ORDER BY u.created_at DESC
		  `).toArray();
	  
		  console.log("Found total authors:", authors.length);
	  
		  // Filter authors to only include those with featured: true in their extras
		  const processedAuthors = authors.reduce((featured, author) => {
			let extras = {};
			try {
			  extras = JSON.parse(author.extras || '{}');
			  // Only include this author if they have featured: true
			  if (extras.featured === true) {
				featured.push({
				  username: author.username,
				  github_username: author.github_username,
				  display_name: author.display_name || author.username,
				  status: author.status,
				  profile_img: author.profile_img,
				  banner_img: author.banner_img,
				  companion_slug: author.companion_slug,
				  vrm_url: author.vrm_url,
				  ...extras
				});
			  }
			} catch (e) {
			  console.error(`Error parsing extras for author ${author.username}:`, e);
			}
			return featured;
		  }, [{
			"username": "antpb",
			"github_username": "antpb",
			"display_name": "antpb",
			"status": "buildin...",
			"profile_img": "https://pbs.twimg.com/profile_images/1865340701589811200/GBrkXZXt_400x400.jpg",
			"banner_img": "https://pbs.twimg.com/profile_banners/205894419/1640718159/1500x500",
			"companion_slug": "pixel",
			"vrm_url": "https://items.sxp.digital/f8886983-a11b-4367-a19c-388662542d84/xrpublisherdefaultavatar.vrm"
			}]);
	  
		  console.log("Found featured authors:", processedAuthors.length);
	  
		  return new Response(JSON.stringify(processedAuthors), {
			headers: { 
			  'Content-Type': 'application/json',
			  'Access-Control-Allow-Origin': '*',
			  'Access-Control-Allow-Methods': 'GET',
			  'Access-Control-Allow-Headers': 'Content-Type'
			}
		  });
		} catch (error) {
		  console.error("Error in handleGetFeaturedAuthors:", error);
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

	async getUserSettings(username) {
		try {
			const settings = await this.sql.exec(`
				SELECT 
					id,
					username,
					telegram_chat_id,
					telegram_username,
					verification_enabled,
					auto_approve_low_risk,
					companion_slug,
					vrm_url,
					display_name,
					status,
					profile_img,
					banner_img,
					extras,
					created_at,
					updated_at
				FROM user_settings 
				WHERE username = ?`,
				username
			).one();

			if (settings) {
				// Parse JSON fields if they exist
				if (settings.extras) {
					try {
						settings.extras = JSON.parse(settings.extras);
					} catch (e) {
						settings.extras = {};
					}
				}
			}

			return settings;
		} catch (error) {
			console.error('Failed to get user settings:', error);
			throw error;
		}
	}

	async getUserPrivateSettings(username, apiKey) {
		try {
			// Verify API key matches the user
			const keyVerification = await this.verifyApiKey(apiKey);
			if (!keyVerification.valid || keyVerification.username !== username) {
				throw new Error('Invalid credentials');
			}

			const settings = await this.sql.exec(
				"SELECT private_extras FROM user_settings WHERE username = ?",
				username
			).one();

			if (settings?.private_extras) {
				try {
					settings.private_extras = JSON.parse(settings.private_extras);
				} catch (e) {
					settings.private_extras = {};
				}
			}

			return settings?.private_extras || {};
		} catch (error) {
			console.error('Failed to get user private settings:', error);
			throw error;
		}
	}

	// Generate a secure random key ID
	generateKeyId() {
		const buffer = new Uint8Array(16); // 128-bit random value
		crypto.getRandomValues(buffer);
		return Array.from(buffer)
			.map(byte => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	// Generate API key by combining key ID with master salt
	async generateApiKey(keyId) {
		// Create a TextEncoder to convert strings to Uint8Array
		const encoder = new TextEncoder();

		// Convert master salt and key ID to Uint8Array
		const masterSalt = encoder.encode(this.env.USER_KEY_SALT);
		const keyIdBytes = encoder.encode(keyId);

		// Import master salt as HMAC key
		const key = await crypto.subtle.importKey(
			'raw',
			masterSalt,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);

		// Generate HMAC
		const signature = await crypto.subtle.sign(
			'HMAC',
			key,
			keyIdBytes
		);

		// Convert signature to hex string
		return Array.from(new Uint8Array(signature))
			.map(byte => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	// Create a new user account
	async createUser(username, inviteCode, github_username, email) {
		try {
			const existingUser = await this.sql.exec(
				"SELECT 1 FROM users WHERE username = ?",
				[username]
			).toArray();

			if (existingUser.length > 0) {
				throw new Error('Username already taken');
			}

			if (!this.env.INVITE_CODE || inviteCode !== this.env.INVITE_CODE) {
				throw new Error('Invalid invite code');
			}

			const keyId = this.generateKeyId();
			const keyHash = await this.generateApiKey(keyId);

			const query = `
				INSERT INTO users (
					username,
					github_username,
					email,
					key_id,
					key_hash,
					invite_code_used,
					created_at
				) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

			// Pass each parameter individually
			await this.sql.exec(query, username, github_username, email, keyId, keyHash, inviteCode);

			return { username, keyId, keyHash, apiKey: `${username}.${keyId}` };
		} catch (error) {
			console.error(error);
			throw error;
		}
	}
	async updateUserAsAdmin(username, updates) {
		try {
			// Check if github_username column exists, add it if it doesn't
			const columns = await this.sql.exec(`PRAGMA table_info(users)`).toArray();
			if (!columns.some(col => col.name === 'github_username')) {
				await this.sql.exec(`ALTER TABLE users ADD COLUMN github_username TEXT`);
			}

			const user = await this.sql.exec(
				"SELECT * FROM users WHERE username = ?",
				username
			).one();

			if (!user) {
				throw new Error('User not found');
			}

			// Start building update query
			let updateFields = [];
			let updateValues = [];

			if (updates.email) {
				updateFields.push('email = ?');
				updateValues.push(updates.email);
			}

			if (updates.github_username) {
				updateFields.push('github_username = ?');
				updateValues.push(updates.github_username);
			}

			if (updates.newUsername) {
				// Check if new username is available
				const existing = await this.sql.exec(
					"SELECT username FROM users WHERE username = ?",
					updates.newUsername
				).one();

				if (existing) {
					throw new Error('New username already taken');
				}

				updateFields.push('username = ?');
				updateValues.push(updates.newUsername);
			}

			// If a new API key is requested, generate one
			if (updates.generateNewKey) {
				const newKeyId = this.generateKeyId();
				const newKeyHash = await this.generateApiKey(newKeyId);

				updateFields.push('key_id = ?');
				updateValues.push(newKeyId);

				updateFields.push('key_hash = ?');
				updateValues.push(newKeyHash);

				updateFields.push('last_key_rotation = CURRENT_TIMESTAMP');

				// Store the new API key to return to admin
				updates.newApiKey = `${updates.newUsername || username}.${newKeyId}`;
			}

			if (updateFields.length === 0) {
				throw new Error('No valid updates provided');
			}

			// Build and execute update query
			const query = `
				UPDATE users 
				SET ${updateFields.join(', ')}
				WHERE username = ?
			`;

			await this.sql.exec(query, ...updateValues, username);

			return {
				success: true,
				message: 'User updated successfully',
				username: updates.newUsername || username,
				email: updates.email,
				github_username: updates.github_username,
				newApiKey: updates.newApiKey
			};
		} catch (error) {
			console.error("Admin update error:", error);
			throw error;
		}
	}

	async deleteUser(username) {
		try {
			// First delete any pending key roll verifications
			await this.sql.exec(
				"DELETE FROM key_roll_verifications WHERE username = ?",
				username
			);

			// Then delete the user
			const result = await this.sql.exec(
				"DELETE FROM users WHERE username = ?",
				username
			);

			// Return success even if no user was found (idempotent delete)
			return {
				success: true,
				deleted: result.changes > 0
			};
		} catch (error) {
			console.error("Error deleting user from auth database:", error);
			throw new Error(`Failed to delete user from auth database: ${error.message}`);
		}
	}

	// Verify API key
	async verifyApiKey(apiKey) {
		try {
			const [username, keyId] = apiKey.split('.');
			if (!username || !keyId) {
				return false;
			}

			const expectedHash = await this.generateApiKey(keyId);
			const user = await this.sql.exec(
				"SELECT username FROM users WHERE username = ? AND key_id = ? AND key_hash = ?",
				username, keyId, expectedHash
			).one();

			return { valid: !!user, username: username };
		} catch (error) {
			console.error("Error verifying API key:", error);
			return false;
		}
	}

	// Rotate API key for a user
	async rotateApiKey(username, currentApiKey) {
		try {
			// Verify current API key
			if (!await this.verifyApiKey(currentApiKey)) {
				throw new Error('Invalid credentials');
			}

			// Generate new key ID and hash
			const newKeyId = this.generateKeyId();
			const newKeyHash = await this.generateApiKey(newKeyId);

			// Update user record
			await this.sql.exec(`
        UPDATE users 
        SET key_id = ?, key_hash = ?, last_key_rotation = CURRENT_TIMESTAMP
        WHERE username = ?
      `, newKeyId, newKeyHash, username);

			return {
				success: true,
				message: 'Store this API key securely - it cannot be recovered if lost',
				apiKey: `${username}.${newKeyId}`
			};
		} catch (error) {
			console.error("Error rotating API key:", error);
			throw error;
		}
	}

	async initiateKeyRoll(username, email) {
		// Verify username and email match
		const user = await this.sql.exec(
			"SELECT * FROM users WHERE username = ? AND email = ?",
			username, email
		).one();

		if (!user) {
			throw new Error('Invalid username or email');
		}

		if (!user.github_username) {
			throw new Error('GitHub username not set for this account. Please contact support to update your GitHub username.');
		}

		// Generate verification token and content
		const buffer = new Uint8Array(32);
		crypto.getRandomValues(buffer);
		const verificationToken = Array.from(buffer)
			.map(byte => byte.toString(16).padStart(2, '0'))
			.join('');

		// Store verification info with expiration
		await this.sql.exec(`
			INSERT INTO key_roll_verifications (
				username,
				verification_token,
				created_at,
				expires_at
			) VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+1 hour'))
		`, username, verificationToken);

		return {
			verificationToken,
			verificationFilename: `plugin-publisher-verify-${username}.txt`,
			verificationContent: `Verifying plugin-publisher key roll request for ${username}\nToken: ${verificationToken}\nTimestamp: ${new Date().toISOString()}`
		};
	}

	async verifyGistAndRollKey(gistUrl, verificationToken) {
		try {
			// Verify the token is valid and not expired
			const verification = await this.sql.exec(`
					SELECT username FROM key_roll_verifications
					WHERE verification_token = ?
					AND expires_at > CURRENT_TIMESTAMP
					AND used = 0
				`, verificationToken).one();

			if (!verification) {
				throw new Error('Invalid or expired verification token');
			}

			// Extract gist ID from URL
			const gistId = gistUrl.split('/').pop();

			// Fetch gist content from GitHub API
			const response = await fetch(`https://api.github.com/gists/${gistId}`, {
				headers: {
					'User-Agent': 'antpb-plugin-publisher'
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error("GitHub API error response:", errorText);
				throw new Error(`Could not verify gist: ${response.status} ${errorText}`);
			}

			const gistData = await response.json();

			const expectedFilename = `plugin-publisher-verify-${verification.username}.txt`;

			// Verify gist content
			const file = gistData.files[expectedFilename];
			if (!file) {
				console.error("File not found in gist. Available files:", Object.keys(gistData.files));
				throw new Error(`Verification file "${expectedFilename}" not found in gist`);
			}

			if (!file.content.includes(verificationToken)) {
				console.error("Token not found in file content. Content:", file.content);
				throw new Error('Verification token not found in gist content');
			}

			// Verify gist owner matches GitHub username in our records
			const user = await this.sql.exec(`
					SELECT github_username FROM users
					WHERE username = ?
				`, verification.username).one();

			if (!user || user.github_username !== gistData.owner.login) {
				throw new Error(`GitHub username mismatch. Expected: ${user?.github_username}, Found: ${gistData.owner.login}`);
			}

			// Mark verification as used
			await this.sql.exec(`
				UPDATE key_roll_verifications
				SET used = 1
				WHERE verification_token = ?
			`, verificationToken);

			// Generate and set new API key
			const newKeyId = this.generateKeyId();
			const newKeyHash = await this.generateApiKey(newKeyId);

			await this.sql.exec(`
				UPDATE users 
				SET key_id = ?, 
					key_hash = ?,
					last_key_rotation = CURRENT_TIMESTAMP
				WHERE username = ?
			`, newKeyId, newKeyHash, verification.username);

			return {
				success: true,
				message: 'API key successfully rolled. Store this key securely - it cannot be recovered if lost.',
				apiKey: `${verification.username}.${newKeyId}`
			};
		} catch (error) {
			console.error("Error verifying gist and rolling key:", error);
			throw error;
		}
	}

	// Handle incoming requests
	async fetch(request) {
		const url = new URL(request.url);
		// Handle GET requests first
		if (request.method === "GET") {
			switch (url.pathname) {
				case '/get-featured-authors': {
					console.log("Handling GET featured-authors request");
					return await this.handleGetFeaturedAuthors();
				}
			}
		}
		if (request.method === "POST") {
			const body = await request.json();

			switch (url.pathname) {
				case '/get-user-settings': {
					const { username } = body;
					console.log('Fetching settings for username:', username);

					if (!username) {
						console.error('Missing username in request body');
						return new Response(JSON.stringify({
							error: 'Missing username'
						}), { status: 400 });
					}

					try {
						// First check if user exists
						const userExists = await this.sql.exec(
							"SELECT * FROM users WHERE username = ?",
							username
						).toArray();

						console.log('User exists check:', userExists);

						if (!userExists.length) {
							console.error('User not found:', username);
							return new Response(JSON.stringify({
								error: 'User not found'
							}), { status: 404 });
						}

						// Check if settings exist
						const settings = await this.sql.exec(`
							SELECT 
								telegram_chat_id,
								telegram_username,
								verification_enabled,
								auto_approve_low_risk,
								companion_slug,
								vrm_url,
								display_name,
								status,
								profile_img,
								banner_img,
								extras
							FROM user_settings
							WHERE username = ?
						`, username).toArray();

						console.log('Settings query result:', settings);

						if (!settings.length) {
							console.log('No settings found, creating default settings for:', username);
							// Insert default settings
							await this.sql.exec(`
								INSERT INTO user_settings (
									username,
									verification_enabled,
									auto_approve_low_risk,
									extras,
									private_extras
								) VALUES (?, 1, 0, '{}', '{}')
							`, username);

							// Fetch the newly created settings
							const newSettings = await this.sql.exec(`
								SELECT 
									telegram_chat_id,
									telegram_username,
									verification_enabled,
									auto_approve_low_risk,
									companion_slug,
									vrm_url,
									display_name,
									status,
									profile_img,
									banner_img,
									extras
								FROM user_settings
								WHERE username = ?
							`, username).toArray();

							console.log('Newly created settings:', newSettings[0]);

							const defaultSettings = newSettings[0] || {
								telegram_chat_id: null,
								telegram_username: null,
								verification_enabled: 1,
								auto_approve_low_risk: 0,
								companion_slug: null,
								vrm_url: null,
								display_name: null,
								status: null,
								profile_img: null,
								banner_img: null,
								extras: '{}'
							};

							// Parse JSON fields
							try {
								defaultSettings.extras = JSON.parse(defaultSettings.extras || '{}');
							} catch (e) {
								defaultSettings.extras = {};
							}

							return new Response(JSON.stringify(defaultSettings), {
								headers: { 'Content-Type': 'application/json' }
							});
						}

						// Parse JSON fields for existing settings
						const settingsWithParsedJson = { ...settings[0] };
						try {
							settingsWithParsedJson.extras = JSON.parse(settingsWithParsedJson.extras || '{}');
						} catch (e) {
							settingsWithParsedJson.extras = {};
						}

						console.log('Sending existing settings:', settingsWithParsedJson);

						return new Response(JSON.stringify(settingsWithParsedJson), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Error fetching user settings:', {
							username,
							error: error.message,
							stack: error.stack
						});
						return new Response(JSON.stringify({
							error: error.message
						}), { status: 500 });
					}
				}

				case '/get-user-private-settings': {
					const { username, apiKey } = body;
					if (!username || !apiKey) {
						return new Response(JSON.stringify({
							error: 'Missing required fields'
						}), { status: 400 });
					}

					try {
						const privateSettings = await this.getUserPrivateSettings(username, apiKey);
						return new Response(JSON.stringify(privateSettings), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						return new Response(JSON.stringify({
							error: error.message
						}), { status: 401 });
					}
				}

				case '/create-user': {
					const { username, inviteCode, github_username, email } = body;
					if (!username || !inviteCode) {
						return new Response(JSON.stringify({
							error: 'Missing required fields'
						}), { status: 400 });
					}

					try {
						const result = await this.createUser(username, inviteCode, github_username, email);
						return new Response(JSON.stringify(result));
					} catch (error) {
						return new Response(JSON.stringify({
							error: error.message
						}), { status: 400 });
					}
				}
				case '/delete-user': {
					const { username } = body;
					if (!username) {
						return new Response(JSON.stringify({
							error: 'Missing username'
						}), { status: 400 });
					}

					try {
						await this.deleteUser(username);
						return new Response(JSON.stringify({ success: true }));
					} catch (error) {
						return new Response(JSON.stringify({
							error: error.message
						}), { status: 500 });
					}
				}

				case '/verify-key': {
					const { apiKey } = body;
					const verifyResponse = await this.verifyApiKey(apiKey);
					return new Response(JSON.stringify(verifyResponse));
				}

				case '/rotate-key': {
					const { username, currentApiKey } = body;
					try {
						const result = await this.rotateApiKey(username, currentApiKey);
						return new Response(JSON.stringify(result));
					} catch (error) {
						return new Response(JSON.stringify({
							error: error.message
						}), { status: 400 });
					}
				}
				case '/migrate-user-settings': {
					try {
						const result = await this.migrateUserSettings();
						return new Response(JSON.stringify(result), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						return new Response(JSON.stringify({
							error: 'Migration failed',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/initiate-key-roll': {
					const { username, email } = body;
					try {
						const result = await this.initiateKeyRoll(username, email);
						return new Response(JSON.stringify(result), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						return new Response(JSON.stringify({
							error: error.message
						}), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/verify-key-roll': {
					const { gistUrl, verificationToken } = body;
					try {
						const result = await this.verifyGistAndRollKey(gistUrl, verificationToken);
						return new Response(JSON.stringify(result), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						return new Response(JSON.stringify({
							error: error.message
						}), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/admin-update-user': {
					const { username, ...updates } = body;
					if (!username) {
						return new Response(JSON.stringify({
							error: 'Username is required'
						}), { status: 400 });
					}

					try {
						const result = await this.updateUserAsAdmin(username, updates);
						return new Response(JSON.stringify(result));
					} catch (error) {
						return new Response(JSON.stringify({
							error: error.message
						}), { status: 400 });
					}
				}

				case '/update-user-settings': {
					const { username, settings } = body;
					console.log('Updating settings for user:', username, 'with settings:', settings);

					if (!username || !settings) {
						return new Response(JSON.stringify({
							error: 'Missing required fields'
						}), { status: 400 });
					}

					try {
						// First verify user exists
						const userExists = await this.sql.exec(
							"SELECT 1 FROM users WHERE username = ?",
							username
						).toArray();

						if (!userExists.length) {
							return new Response(JSON.stringify({
								error: 'User not found'
							}), { status: 404 });
						}

						// Update or insert settings
						await this.sql.exec(`
							INSERT INTO user_settings (
								username,
								telegram_chat_id,
								telegram_username,
								verification_enabled,
								auto_approve_low_risk,
								companion_slug,
								vrm_url,
								display_name,
								status,
								profile_img,
								banner_img,
								extras,
								private_extras,
								updated_at
							) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
							ON CONFLICT(username) DO UPDATE SET
								telegram_chat_id = ?,
								telegram_username = ?,
								verification_enabled = ?,
								auto_approve_low_risk = ?,
								companion_slug = ?,
								vrm_url = ?,
								display_name = ?,
								status = ?,
								profile_img = ?,
								banner_img = ?,
								extras = ?,
								private_extras = ?,
								updated_at = unixepoch()
						`,
							username,
							settings.telegram_chat_id || null,
							settings.telegram_username || null,
							settings.verification_enabled ? 1 : 0,
							settings.auto_approve_low_risk ? 1 : 0,
							settings.companion_slug || null,
							settings.vrm_url || null,
							settings.display_name || null,
							settings.status || null,
							settings.profile_img || null,
							settings.banner_img || null,
							JSON.stringify(settings.extras || {}),
							JSON.stringify(settings.private_extras || {}),
							// Repeat values for UPDATE part
							settings.telegram_chat_id || null,
							settings.telegram_username || null,
							settings.verification_enabled ? 1 : 0,
							settings.auto_approve_low_risk ? 1 : 0,
							settings.companion_slug || null,
							settings.vrm_url || null,
							settings.display_name || null,
							settings.status || null,
							settings.profile_img || null,
							settings.banner_img || null,
							JSON.stringify(settings.extras || {}),
							JSON.stringify(settings.private_extras || {})
						);

						// Fetch and return updated settings
						const updatedSettings = await this.sql.exec(`
							SELECT 
								telegram_chat_id,
								telegram_username,
								verification_enabled,
								auto_approve_low_risk,
								companion_slug,
								vrm_url,
								display_name,
								status,
								profile_img,
								banner_img,
								extras,
								private_extras
							FROM user_settings
							WHERE username = ?
						`, username).one();

						console.log('Updated settings:', updatedSettings);

						return new Response(JSON.stringify(updatedSettings), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Error updating user settings:', error);
						return new Response(JSON.stringify({
							error: 'Failed to update settings',
							details: error.message
						}), { status: 500 });
					}
				}

				default:
					return new Response('Not found', { status: 404 });
			}
		}

		return new Response('Method not allowed', { status: 405 });
	}
}
