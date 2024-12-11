export class WorldRegistryDO {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		this.sql = state.storage.sql;
		this.initializeSchema();
	}

	async initializeSchema() {
		try {
			this.sql.exec(`
				-- World metadata table
				CREATE TABLE IF NOT EXISTS worlds (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					author TEXT NOT NULL,
					slug TEXT NOT NULL,
					name TEXT NOT NULL,
					short_description TEXT,
					long_description TEXT,
					version TEXT NOT NULL,
					preview_image TEXT,
					html_url TEXT NOT NULL,
					entry_point TEXT DEFAULT '0,0,0',
					visibility TEXT DEFAULT 'public',
					capacity INTEGER DEFAULT 100,
					visit_count INTEGER DEFAULT 0,
					active_users INTEGER DEFAULT 0,
					content_rating TEXT DEFAULT 'everyone',
					properties TEXT,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(author, slug)
				);
							
				-- World tags for search
				CREATE TABLE IF NOT EXISTS world_tags (
					world_id INTEGER,
					tag TEXT NOT NULL,
					FOREIGN KEY(world_id) REFERENCES worlds(id),
					PRIMARY KEY(world_id, tag)
				);

				-- World versions for version history
				CREATE TABLE IF NOT EXISTS world_versions (
					world_id INTEGER,
					version TEXT NOT NULL,
					html_url TEXT NOT NULL,
					changelog TEXT,
					published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY(world_id) REFERENCES worlds(id),
					PRIMARY KEY(world_id, version)
				);
				
				CREATE INDEX IF NOT EXISTS idx_worlds_search 
				ON worlds(name, short_description);
				
				CREATE INDEX IF NOT EXISTS idx_worlds_visits
				ON worlds(visit_count DESC);
				
				CREATE INDEX IF NOT EXISTS idx_worlds_author
				ON worlds(author);

				CREATE TABLE IF NOT EXISTS authors (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL UNIQUE,
					email TEXT,
					avatar_url TEXT,
					bio TEXT,
					member_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					website TEXT,
					twitter TEXT,
					github TEXT,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_authors_username 
				ON authors(username);
			`);
		} catch (error) {
			console.error("Error initializing schema:", error);
			throw error;
		}
	}

	async syncAuthorData(authorData) {
		try {
			if (typeof authorData !== 'object' || authorData === null) {
				throw new Error(`Invalid author data type: ${typeof authorData}`);
			}

			const result = await this.sql.exec(`
				INSERT INTO authors (
					username, email, avatar_url, bio, 
					website, twitter, github
				) 
				VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(username) DO UPDATE SET
					email = EXCLUDED.email,
					avatar_url = EXCLUDED.avatar_url,
					bio = EXCLUDED.bio,
					website = EXCLUDED.website,
					twitter = EXCLUDED.twitter,
					github = EXCLUDED.github,
					updated_at = CURRENT_TIMESTAMP
				RETURNING id
			`,
				authorData.username,
				authorData.email,
				authorData.avatar_url,
				authorData.bio,
				authorData.website,
				authorData.twitter,
				authorData.github
			).one();

			return result.id;
		} catch (error) {
			console.error("Error syncing author data:", error);
			throw error;
		}
	}

	async handleSearch(query = '', tags = [], limit = 20, offset = 0) {
		try {
			const whereClause = query ?
				`WHERE (w.name LIKE ? OR w.short_description LIKE ? OR w.author LIKE ?)` :
				'WHERE 1=1';

			const tagFilters = tags.length > 0 ?
				`AND w.id IN (
					SELECT world_id FROM world_tags 
					WHERE tag IN (${tags.map(() => '?').join(',')})
					GROUP BY world_id 
					HAVING COUNT(DISTINCT tag) = ${tags.length}
				)` : '';

			const params = query ?
				[...query.split(' ').flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]), ...tags, limit, offset] :
				[...tags, limit, offset];

			const results = this.sql.exec(`
				SELECT w.*, 
					a.username as author_username,
					a.avatar_url as author_avatar,
					(
						SELECT GROUP_CONCAT(tag) 
						FROM world_tags 
						WHERE world_id = w.id
					) as tags
				FROM worlds w
				LEFT JOIN authors a ON w.author = a.username
				${whereClause}
				${tagFilters}
				ORDER BY w.visit_count DESC, w.updated_at DESC
				LIMIT ? OFFSET ?
			`, ...params).toArray();

			return results.map(row => ({
				...row,
				tags: row.tags ? row.tags.split(',') : []
			}));
		} catch (error) {
			console.error('Search error:', error);
			return [];
		}
	}

	async recordVisit(author, slug) {
		const world = this.sql.exec(
			"SELECT id FROM worlds WHERE author = ? AND slug = ?",
			author, slug
		).one();

		if (!world) return false;

		await this.sql.exec(`
			UPDATE worlds 
			SET visit_count = visit_count + 1,
				updated_at = CURRENT_TIMESTAMP 
			WHERE id = ?
		`, world.id);

		return true;
	}

	async updateActiveUsers(author, slug, count) {
		await this.sql.exec(`
			UPDATE worlds 
			SET active_users = ?,
				updated_at = CURRENT_TIMESTAMP 
			WHERE author = ? AND slug = ?
		`, count, author, slug);
	}

	async createOrUpdateWorld(worldData) {
		try {
			return await this.state.storage.transaction(async (txn) => {
				// Ensure all required fields have values or defaults
				const data = {
					author: worldData.author,
					slug: worldData.slug,
					name: worldData.name,
					short_description: worldData.short_description || null,
					long_description: worldData.long_description || null,
					version: worldData.version || '1.0.0',
					preview_image: worldData.preview_image || null,
					html_url: worldData.html_url,
					entry_point: worldData.entry_point || '0,0,0',
					visibility: worldData.visibility || 'public',
					capacity: worldData.capacity || 100,
					content_rating: worldData.content_rating || 'everyone',
					properties: worldData.properties ? JSON.stringify(worldData.properties) : null
				};
	
				const result = await this.sql.exec(`
					INSERT INTO worlds (
						author,
						slug,
						name,
						short_description,
						long_description,
						version,
						preview_image,
						html_url,
						entry_point,
						visibility,
						capacity,
						content_rating,
						properties
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(author, slug) DO UPDATE SET
						name = EXCLUDED.name,
						short_description = EXCLUDED.short_description,
						long_description = EXCLUDED.long_description,
						version = EXCLUDED.version,
						preview_image = EXCLUDED.preview_image,
						html_url = EXCLUDED.html_url,
						entry_point = EXCLUDED.entry_point,
						visibility = EXCLUDED.visibility,
						capacity = EXCLUDED.capacity,
						content_rating = EXCLUDED.content_rating,
						properties = EXCLUDED.properties,
						updated_at = CURRENT_TIMESTAMP
					RETURNING id
				`,
					data.author,
					data.slug,
					data.name,
					data.short_description,
					data.long_description,
					data.version,
					data.preview_image,
					data.html_url,
					data.entry_point,
					data.visibility,
					data.capacity,
					data.content_rating,
					data.properties
				).one();
	
				if (!result?.id) {
					throw new Error('Failed to create/update world record');
				}
	
				// Handle tags if present
				if (worldData.tags && Array.isArray(worldData.tags)) {
					await this.sql.exec("DELETE FROM world_tags WHERE world_id = ?", result.id);
					for (const tag of worldData.tags) {
						await this.sql.exec(
							"INSERT INTO world_tags (world_id, tag) VALUES (?, ?)",
							result.id,
							tag
						);
					}
				}
	
				// Add version history
				await this.sql.exec(`
					INSERT INTO world_versions (
						world_id,
						version,
						html_url,
						changelog
					) VALUES (?, ?, ?, ?)
				`, result.id, data.version, data.html_url, worldData.changelog || '');
	
				return result.id;
			});
		} catch (error) {
			console.error("Error creating/updating world:", error);
			throw error;
		}
	}

	async fetch(request) {
		if (request.method === "GET") {
			return new Response("Method not allowed", { status: 405 });
		}

		const url = new URL(request.url);

		switch (url.pathname) {
			case '/search': {
				const body = await request.json();
				const results = await this.handleSearch(
					body.query || '',
					body.tags || [],
					parseInt(body.limit || 20),
					parseInt(body.offset || 0)
				);
				return new Response(JSON.stringify(results), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			case '/create-world':
			case '/update-world': {
				const worldData = await request.json();
				const worldId = await this.createOrUpdateWorld(worldData);
				return new Response(JSON.stringify({ success: true, worldId }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			case '/record-visit': {
				const { author, slug } = await request.json();
				const success = await this.recordVisit(author, slug);
				return new Response(JSON.stringify({ success }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			case '/update-active-users': {
				const { author, slug, count } = await request.json();
				await this.updateActiveUsers(author, slug, count);
				return new Response(JSON.stringify({ success: true }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			case '/sync-author': {
				const authorData = await request.json();
				const authorId = await this.syncAuthorData(authorData);
				return new Response(JSON.stringify({ success: true, authorId }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			case '/list-authors': {
				try {
					const authors = await this.sql.exec(`
						SELECT 
							a.*,
							COUNT(DISTINCT w.id) as world_count,
							SUM(w.visit_count) as total_visits
						FROM authors a
						LEFT JOIN worlds w ON w.author = a.username
						GROUP BY a.id
						ORDER BY total_visits DESC NULLS LAST, a.updated_at DESC
					`).toArray();

					return new Response(JSON.stringify(authors), {
						headers: { 'Content-Type': 'application/json' }
					});
				} catch (error) {
					console.error('Error listing authors:', error);
					return new Response(JSON.stringify({ error: 'Internal server error' }), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			default:
				return new Response("Not found", { status: 404 });
		}
	}
}