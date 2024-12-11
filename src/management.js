/**
 * Removes an author and all their associated worlds and data
 * @param {string} authorName - The name of the author to remove
 * @param {Object} env - Environment containing storage connections
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function removeAuthor(authorName, env) {
    if (!authorName) {
        return {
            success: false,
            message: 'Invalid author name provided'
        };
    }

    try {
        // Get DO instance
        const id = env.WORLD_REGISTRY.idFromName("global");
        const registry = env.WORLD_REGISTRY.get(id);

        // Create internal request to delete author
        const deleteRequest = new Request('http://internal/delete-author', {
            method: 'POST',
            body: JSON.stringify({ authorName })
        });

        const response = await registry.fetch(deleteRequest);
        if (!response.ok) {
            throw new Error(`Failed to delete author: ${response.status}`);
        }

        // Delete from bucket
        const prefix = `${authorName}/`;
        const files = await env.WORLD_BUCKET.list({ prefix });
        for (const file of files.objects) {
            await env.WORLD_BUCKET.delete(file.key);
        }

        // Delete visit tracking data if you have any
        const visitsPrefix = `visits:${authorName}:`;
        const visits = await env.VISIT_COUNTS.list({ prefix: visitsPrefix });
        for (const key of visits.keys) {
            await env.VISIT_COUNTS.delete(key.name);
        }

        return {
            success: true,
            message: `Successfully removed author ${authorName} and all associated worlds`
        };

    } catch (error) {
        console.error('Error removing author:', error);
        return {
            success: false,
            message: 'Failed to remove author. Please try again later.'
        };
    }
}

/**
 * Removes a specific world
 * @param {string} authorName - The world's author name
 * @param {string} worldName - The name of the world to remove
 * @param {Object} env - Environment containing storage connections
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function removeWorld(authorName, worldName, env) {
    if (!authorName || !worldName) {
        return {
            success: false,
            message: 'Invalid author or world name provided'
        };
    }

    try {
        // Get DO instance
        const id = env.WORLD_REGISTRY.idFromName("global");
        const registry = env.WORLD_REGISTRY.get(id);

        // Create internal request to delete world
        const deleteRequest = new Request('http://internal/delete-world', {
            method: 'POST',
            body: JSON.stringify({ authorName, worldName })
        });

        const response = await registry.fetch(deleteRequest);
        if (!response.ok) {
            throw new Error(`Failed to delete world: ${response.status}`);
        }

        // Get world slug from response
        const { slug } = await response.json();

        // Delete all world files (HTML, previews, versions)
        const prefix = `${authorName}/${slug}/`;
        const files = await env.WORLD_BUCKET.list({ prefix });
        for (const file of files.objects) {
            await env.WORLD_BUCKET.delete(file.key);
        }

        // Delete version history
        const versionsPrefix = `versions:${authorName}:${slug}/`;
        const versions = await env.WORLD_BUCKET.list({ prefix: versionsPrefix });
        for (const version of versions.objects) {
            await env.WORLD_BUCKET.delete(version.key);
        }

        // Delete visit statistics
        const visitKey = `visits:${authorName}:${slug}`;
        await env.VISIT_COUNTS?.delete(visitKey);

        // Delete active users tracking
        const activeUsersKey = `active:${authorName}:${slug}`;
        await env.ACTIVE_USERS?.delete(activeUsersKey);

        return {
            success: true,
            message: `Successfully removed world "${worldName}"`
        };

    } catch (error) {
        console.error('Error removing world:', error);
        return {
            success: false,
            message: error.message === 'World not found' ?
                'World not found' :
                'Failed to remove world. Please try again later.'
        };
    }
}

/**
 * Archives a world instead of deleting it
 * @param {string} authorName - The world's author name
 * @param {string} worldName - The name of the world to archive
 * @param {Object} env - Environment containing storage connections
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function archiveWorld(authorName, worldName, env) {
    if (!authorName || !worldName) {
        return {
            success: false,
            message: 'Invalid author or world name provided'
        };
    }

    try {
        // Get DO instance
        const id = env.WORLD_REGISTRY.idFromName("global");
        const registry = env.WORLD_REGISTRY.get(id);

        // Create internal request to archive world
        const archiveRequest = new Request('http://internal/archive-world', {
            method: 'POST',
            body: JSON.stringify({ authorName, worldName })
        });

        const response = await registry.fetch(archiveRequest);
        if (!response.ok) {
            throw new Error(`Failed to archive world: ${response.status}`);
        }

        return {
            success: true,
            message: `Successfully archived world "${worldName}"`
        };

    } catch (error) {
        console.error('Error archiving world:', error);
        return {
            success: false,
            message: 'Failed to archive world. Please try again later.'
        };
    }
}