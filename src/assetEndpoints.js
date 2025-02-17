// Asset management endpoints
export const handleAssetEndpoints = async (path, request, env) => {
    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    switch (path) {
        case 'http://internal/handle-asset-chunk-upload': {
            const id = env.CHARACTER_REGISTRY.idFromName("global");
            const registry = env.CHARACTER_REGISTRY.get(id);
            return await registry.fetch(new Request('http://internal/handle-asset-chunk-upload', {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(await request.json())
            }));
        }

        case 'http://internal/handle-asset-upload-complete': {
            const id = env.CHARACTER_REGISTRY.idFromName("global");
            const registry = env.CHARACTER_REGISTRY.get(id);
            return await registry.fetch(new Request('http://internal/handle-asset-upload-complete', {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(await request.json())
            }));
        }

        case 'http://internal/get-character-assets': {
            const id = env.CHARACTER_REGISTRY.idFromName("global");
            const registry = env.CHARACTER_REGISTRY.get(id);
            return await registry.fetch(new Request('http://internal/get-character-assets', {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(await request.json())
            }));
        }

        case 'http://internal/delete-asset': {
            const id = env.CHARACTER_REGISTRY.idFromName("global");
            const registry = env.CHARACTER_REGISTRY.get(id);
            return await registry.fetch(new Request('http://internal/delete-asset', {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(await request.json())
            }));
        }

        case 'http://internal/update-asset-metadata': {
            const id = env.CHARACTER_REGISTRY.idFromName("global");
            const registry = env.CHARACTER_REGISTRY.get(id);
            return await registry.fetch(new Request('http://internal/update-asset-metadata', {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(await request.json())
            }));
        }

        case 'http://internal/handle-asset-thumbnail-upload': {
            const id = env.CHARACTER_REGISTRY.idFromName("global");
            const registry = env.CHARACTER_REGISTRY.get(id);
            return await registry.fetch(new Request('http://internal/handle-asset-thumbnail-upload', {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify(await request.json())
            }));
        }

        default: {
            return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
                status: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }
    }
}; 