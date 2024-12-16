class SecureHtmlService {
	generateNonce() {
		const array = new Uint8Array(16);
		crypto.getRandomValues(array);
		return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
	}

	getSecurityHeaders(nonce) {
		return {
			'Content-Security-Policy': [
				// Allow resources from same origin and CDN
				"default-src 'self' https://cdn.jsdelivr.net https://builds.sxp.digital https://items.sxp.digital https://unpkg.com",
				// Allow scripts and our web components
				`script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://cdn.jsdelivr.net https://builds.sxp.digital https://unpkg.com`,
				"worker-src 'self' blob:",
				// Allow styles from CDN and inline styles (needed for web components)
				"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
				// Allow images from any HTTPS source
				"img-src 'self' https: data: blob:",
				// Allow fonts from CDN
				"font-src 'self' https://cdn.jsdelivr.net",
				// Allow custom elements
				`script-src-elem 'self' 'nonce-${nonce}' blob: https://cdn.jsdelivr.net https://builds.sxp.digital https://unpkg.com`,
				// Allow connections (needed for any real-time features)
				"connect-src 'self' wss: https: blob:",
				// Basic security headers
				"base-uri 'self'"
			].join('; '),
			'X-Content-Type-Options': 'nosniff',
			'X-Frame-Options': 'SAMEORIGIN',
			'Referrer-Policy': 'strict-origin-when-cross-origin'
		};
	}

	sanitizeText(text) {
		if (!text) return '';
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#x27;');
	}

	sanitizeUrl(url) {
		if (!url) return '';
		try {
			const parsed = new URL(url);
			return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
		} catch {
			return url.startsWith('/') && !url.includes('..') ? url : '';
		}
	}

	createMetaTransformer(nonce) {
		return {
			element: (element) => {
				if (element.tagName === 'head') {
					element.append(`
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			  `, { html: true });
				}
			}
		};
	}

	createScriptTransformer(nonce) {
		return {
			element: (element) => {
				if (element.tagName === 'script') {
					const src = element.getAttribute('src');
					if (src && (
						src.includes('cdn.jsdelivr.net') ||
						src.includes('playground.wordpress.net') ||
						src.includes('playground.xr.foundation') ||
						src.includes('builds.sxp.digital') ||
						src.includes('unpkg.com')
					)) {
						element.setAttribute('nonce', nonce);
						return;
					}
					element.remove();
				}
			}
		};
	}

	createLinkTransformer() {
		return {
			element: (element) => {
				if (element.tagName === 'a') {
					const href = element.getAttribute('href');
					if (href) {
						const sanitizedHref = this.sanitizeUrl(href);
						if (!sanitizedHref) {
							element.remove();
							return;
						}
						element.setAttribute('href', sanitizedHref);
						if (sanitizedHref.startsWith('http')) {
							element.setAttribute('rel', 'noopener noreferrer');
							element.setAttribute('target', '_blank');
						}
					}
				}
			}
		};
	}

	async transformHTML(rawHtml) {
		const nonce = this.generateNonce();
		const response = new Response(rawHtml, {
			headers: {
				'Content-Type': 'text/html',
				...this.getSecurityHeaders(nonce)
			}
		});

		return new HTMLRewriter()
			.on('head', this.createMetaTransformer(nonce))
			.on('script', this.createScriptTransformer(nonce))
			.on('a', this.createLinkTransformer())
			.transform(response);
	}

	// Slugify function that preserves case but handles spaces and special characters
	slugifyCharacterName(name) {
		return name
			.trim()
			.replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
			.replace(/\s+/g, '-');    // Replace spaces with hyphens
	}

	// Function to normalize character name for comparison
	normalizeCharacterName(name) {
		return name.trim().toLowerCase();
	}

	sanitizeCharacterData(character) {
		if (!character) return null;

		return {
			name: this.sanitizeText(character.name),
			slug: this.slugifyCharacterName(this.sanitizeText(this.normalizeCharacterName(character.name))),
			modelProvider: this.sanitizeText(character.modelProvider || 'LLAMALOCAL'),
			bio: this.sanitizeText(character.bio),
			author: this.sanitizeText(character.author),
			lore: Array.isArray(character.lore)
				? character.lore.map(item => this.sanitizeText(item))
				: [],
			messageExamples: Array.isArray(character.messageExamples)
				? character.messageExamples.map(conversation => {
					if (!Array.isArray(conversation)) return [];
					return conversation.map(message => ({
						user: this.sanitizeText(message.user),
						content: {
							text: this.sanitizeText(message.content?.text || '')
						}
					}));
				})
				: [],
			postExamples: Array.isArray(character.postExamples)
				? character.postExamples.map(post => this.sanitizeText(post))
				: [],
			topics: Array.isArray(character.topics)
				? character.topics.map(topic => this.sanitizeText(topic))
				: [],
			style: character.style ? {
				all: Array.isArray(character.style.all)
					? character.style.all.map(style => this.sanitizeText(style))
					: [],
				chat: Array.isArray(character.style.chat)
					? character.style.chat.map(style => this.sanitizeText(style))
					: [],
				post: Array.isArray(character.style.post)
					? character.style.post.map(style => this.sanitizeText(style))
					: []
			} : {
				all: [],
				chat: [],
				post: []
			},
			adjectives: Array.isArray(character.adjectives)
				? character.adjectives.map(adj => this.sanitizeText(adj))
				: [],
			settings: character.settings ? {
				model: this.sanitizeText(character.settings.model || ''),
				voice: {
					model: this.sanitizeText(character.settings.voice?.model || '')
				}
			} : {
				model: '',
				voice: { model: '' }
			},
			vrmUrl: this.sanitizeUrl(character.vrmUrl),
			created_at: this.sanitizeText(character.created_at),
			updated_at: this.sanitizeText(character.updated_at),
			authorData: character.authorData ? this.sanitizeAuthorData(character.authorData) : null
		};
	}

	sanitizePluginData(plugin) {
		if (!plugin) return null;
		return {
			name: this.sanitizeText(plugin.name),
			slug: this.sanitizeText(plugin.slug),
			short_description: this.sanitizeText(plugin.short_description),
			version: this.sanitizeText(plugin.version),
			download_link: this.sanitizeUrl(plugin.download_link),
			support_url: this.sanitizeUrl(plugin.support_url),
			requires: this.sanitizeText(plugin.requires),
			tested: this.sanitizeText(plugin.tested),
			requires_php: this.sanitizeText(plugin.requires_php),
			rating: parseFloat(plugin.rating) || 0,
			active_installs: parseInt(plugin.active_installs) || 0,
			last_updated: this.sanitizeText(plugin.updated_at),
			author: this.sanitizeText(plugin.author),
			banners: {
				"high": this.sanitizeUrl(plugin.banners_high || plugin.banners?.high || 'default-banner-1500x620.jpg'),
				"low": this.sanitizeUrl(plugin.banners_low || plugin.banners?.low || '/images/default-banner.jpg')
			},
			icons: {
				'1x': this.sanitizeUrl(plugin.icons_1x || plugin.icons?.['1x'] || '/images/default-icon.jpg'),
				'2x': this.sanitizeUrl(plugin.icons_2x || plugin.icons?.['2x'] || '/images/default-icon.jpg')
			},
			sections: plugin.sections ? {
				installation: this.sanitizeText(plugin.sections.installation),
				faq: this.sanitizeHtml(plugin.sections.faq),
				description: this.sanitizeHtml(plugin.sections.description)
			} : {},
			authorData: plugin.authorData ? this.sanitizeAuthorData(plugin.authorData) : null
		};
	}

	sanitizeAuthorData(author) {
		if (!author) return null;

		return {
			username: this.sanitizeText(author.username),
			bio: this.sanitizeText(author.bio),
			website: this.sanitizeUrl(author.website),
			avatar_url: this.sanitizeUrl(author.avatar_url || '/images/default-avatar.jpg'),
			twitter: this.sanitizeText(author.twitter),
			github: this.sanitizeText(author.github),
			plugins: Array.isArray(author.plugins) ?
				author.plugins.map(plugin => this.sanitizePluginData(plugin)) : []
		};
	}

	sanitizeHtml(html) {
		if (!html) return '';

		const decoded = html.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#x27;/g, "'")
			.replace(/&#x2F;/g, "/");

		// Extended allowed tags to include our web components
		const allowedTags = {
			// Standard HTML tags
			'p': [],
			'h1': [],
			'h2': [],
			'h3': [],
			'h4': [],
			'h5': [],
			'h6': [],
			'br': [],
			'strong': [],
			'em': [],
			'ul': [],
			'ol': [],
			'li': [],
			'a': ['href', 'title', 'target'],
			'code': [],
			'pre': [],
			// 3D World Web Components
			'three-environment-block': [
				'class',
				'devicetarget',
				'threeobjecturl',
				'scale',
				'positiony',
				'rotationy',
				'animations',
				'camcollisions'
			],
			'three-spawn-point-block': [
				'class',
				'positionx',
				'positiony',
				'positionz',
				'rotationx',
				'rotationy',
				'rotationz'
			],
			'three-model-block': [
				'class',
				'threeobjecturl',
				'scalex',
				'scaley',
				'scalez',
				'positionx',
				'positiony',
				'positionz',
				'rotationx',
				'rotationy',
				'rotationz',
				'animations',
				'collidable',
				'alt'
			]
		};

		// Use the same sanitization logic but with our extended allowedTags
		return decoded.replace(/<[^>]*>/g, (tag) => {
			const matches = tag.match(/<\/?([a-z0-9\-]+)(.*?)\/?\s*>/i);
			if (!matches) return '';

			const tagName = matches[1].toLowerCase();
			const attrs = matches[2];

			if (!allowedTags[tagName]) {
				return '';
			}

			if (tag.startsWith('</')) {
				return `</${tagName}>`;
			}

			let sanitizedAttrs = '';
			if (attrs) {
				const allowedAttrs = allowedTags[tagName];
				const attrMatches = attrs.match(/([a-z0-9\-]+)="([^"]*?)"/gi);
				if (attrMatches) {
					attrMatches.forEach(attr => {
						const [name, value] = attr.split('=');
						const cleanName = name.toLowerCase();
						if (allowedAttrs.includes(cleanName)) {
							if (cleanName === 'href') {
								const sanitizedUrl = this.sanitizeUrl(value.slice(1, -1));
								if (sanitizedUrl) {
									sanitizedAttrs += ` href="${sanitizedUrl}"`;
								}
							} else {
								sanitizedAttrs += ` ${cleanName}=${value}`;
							}
						}
					});
				}
			}

			return `<${tagName}${sanitizedAttrs}>`;
		});
	}
	sanitizeWorldData(world) {
		if (!world) return null;
		return {
			name: this.sanitizeText(world.name),
			slug: this.sanitizeText(world.slug),
			short_description: this.sanitizeText(world.short_description),
			long_description: this.sanitizeText(world.long_description),
			version: this.sanitizeText(world.version),
			preview_image: this.sanitizeUrl(world.preview_image || '/images/default-preview.jpg'),
			html_url: this.sanitizeUrl(world.html_url),
			entry_point: this.sanitizeText(world.entry_point || '0,0,0'),
			visibility: this.sanitizeText(world.visibility || 'public'),
			capacity: parseInt(world.capacity) || 100,
			visit_count: parseInt(world.visit_count) || 0,
			active_users: parseInt(world.active_users) || 0,
			content_rating: this.sanitizeText(world.content_rating || 'everyone'),
			author: this.sanitizeText(world.author),
			html_content: this.sanitizeHtml(world.html_content),
			created_at: this.sanitizeText(world.created_at),
			updated_at: this.sanitizeText(world.updated_at),
			authorData: world.authorData ? this.sanitizeAuthorData(world.authorData) : null
		};
	}
}



// Export a factory function instead of an instance
export function createSecureHtmlService() {
	return new SecureHtmlService();
}