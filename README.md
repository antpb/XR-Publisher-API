# World and Character Management System

If this helps you and you want to tip to fund future development, feel free to use the following wallet addresses
### SOL: 5h7YzknKdQKA9QxiZKdt3X5JpjVAyoTEQUroaRGuphAx

### ETH: 0x94899E0Cc3115D7761EeCd9bBc04D8eBff9de871

## Overview

The World and Character Management System is a comprehensive solution built on Cloudflare Workers and R2 storage, designed to handle both virtual world publishing and AI character management. This system provides endpoints for managing worlds (3D environments), user authentication, and interactive AI characters.

## Prerequisites

Before you begin, ensure you have the following:

- A Cloudflare account with Workers and R2 enabled
- [Node.js](https://nodejs.org/) (version 12 or later) and npm installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/) installed and authenticated with your Cloudflare account

## Configuration

The `wrangler.toml` file contains the configuration for your worker and R2 bucket. Key configurations include:

### KV Namespaces
- `VISIT_COUNTS`: Tracks world visits
- `DOWNLOAD_RATELIMIT`: Manages rate limiting
- `DOWNLOAD_QUEUE`: Handles download queues

### Durable Objects
- `WORLD_REGISTRY`: Class name (`WorldRegistryDO`)
- `USER_AUTH`: Class name (`UserAuthDO`)
- `CHARACTER_REGISTRY`: Class name (`CharacterRegistryDO`)

### Environment Variables Required
- `CHARACTER_SALT`: Secret for character encryption
- `USER_KEY_SALT`: Secret for user key generation
- `API_SECRET`: Admin API secret
- `CF_ACCOUNT_ID`: Cloudflare account ID
- `CF_GATEWAY_ID`: Cloudflare gateway ID
- `OPENAI_API_KEY`: OpenAI API key (for character AI)
- `ANTHROPIC_API_KEY`: Anthropic API key (for character AI)

## World Management Endpoints

### GET Endpoints
- `/`: Homepage with author listings and world directory
- `/world-data`: Retrieve world metadata (cached)
- `/author-data`: Retrieve author data (cached)
- `/authors-list`: Get a list of all authors (cached)
- `/directory/{author}/{slug}`: Get HTML page for a specific world (cached)
- `/author/{author}`: Get HTML page for a specific author (cached)
- `/version-check`: Compare new version against author/slug/metadata.json
- `/download`: Download a world file
- `/download-count`: Get download count for a world
- `/search`: Search worlds with optional tag filtering
- `/directory/search`: Get HTML search results page
- `/visit-count`: Get visit count for a world

### POST Endpoints
- `/upload-world`: Upload a world's HTML content and assets
- `/world-metadata`: Update world metadata
- `/update-active-users`: Update active users count for a world
- `/world-upload-assets`: Upload world assets (previews, etc.)
- `/update-author-info`: Update author information
- `/backup-world`: Create backup of currently live files
- `/delete-world`: Remove a specific world

## Character Management Endpoints

### GET Endpoints
- `/character-data`: Get character metadata and configuration
- `/featured-characters`: Get list of featured characters
- `/author-characters`: Get all characters for an author
- `/characters/{author}/{name}`: Get character profile page

### POST Endpoints
- `/create-character`: Create new character
- `/update-character`: Update existing character
- `/update-character-metadata`: Update character metadata only
- `/update-character-images`: Update character profile/banner images
- `/update-character-secrets`: Update character API keys and credentials
- `/delete-character`: Remove character and associated data
- `/api/character/session`: Initialize new character session
- `/api/character/message`: Send message to character
- `/api/character/memory`: Create memory for character
- `/api/character/memories`: Get character memories
- `/api/character/memories/by-rooms`: Get memories across multiple rooms
- `/api/character/find-memory`: Search character memories
- `/api/character/delete-memory`: Delete a specific memory
- `/api/character/update-memory`: Update an existing memory

## Backup System

The system includes both automatic daily backups and manual checkpoint backups for characters.

### Automatic Daily Backups
- System automatically creates daily backups at midnight UTC
- Maintains a 7-day rolling window of backups
- Stored in character's backup directory: `{userId}/{characterName}/{date}-{uuid}.json`
- Old backups automatically cleaned up after 7 days

### Manual Checkpoint Backups
- Users can create manual checkpoint backups at any time
- No limit on number of checkpoint backups
- Stored in separate directory: `{userId}/{characterName}/checkpoints/{timestamp}-{uuid}.json`
- Useful for saving important character states or before making major changes

### Backup Endpoints

#### Create Manual Backup
- Endpoint: `POST /api/character/create-backup`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string"
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "message": "Backup created successfully",
    "timestamp": "ISO-8601 timestamp"
  }
  ```

#### List Available Backups
- Endpoint: `GET /api/character/backup-list`
- Authentication: Required
- Query Parameters:
  - `userId`: Character owner's ID
  - `characterName`: Character's slug/name
- Response:
  ```json
  {
    "automatic": [
      {
        "key": "string",
        "date": "YYYY-MM-DD",
        "type": "automatic",
        "uploaded": "timestamp"
      }
    ],
    "checkpoints": [
      {
        "key": "string",
        "date": "ISO-8601 timestamp",
        "type": "checkpoint",
        "uploaded": "timestamp"
      }
    ]
  }
  ```

#### Download Backup
- Endpoint: `GET /api/character/download-backup`
- Authentication: Required
- Query Parameters:
  - `userId`: Character owner's ID
  - `characterName`: Character's slug/name
  - `key`: Full backup key path from backup-list
- Response: JSON file download containing character backup data

#### Delete Backup
- Endpoint: `POST /api/character/delete-backup`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "key": "string"
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "message": "Backup deleted successfully"
  }
  ```

### Security Features
- All backups stored in a separate, private R2 bucket
- Access requires valid API key authentication
- Filenames include random UUIDs to prevent unauthorized access
- Cache-Control headers prevent caching of backup data
- Backups organized by user/character to maintain data isolation

### Best Practices
1. Create manual checkpoints before:
   - Making significant character changes
   - Updating training data or personality
   - Modifying memory systems
2. Use descriptive timestamps for manual checkpoints
3. Monitor backup storage usage
4. Regularly verify backup integrity
5. Keep track of important checkpoint dates

## Memory Management System

The system includes a comprehensive memory management system for characters that supports various operations:

### Memory Endpoints

#### Create Memory
- Endpoint: `POST /api/character/memory`
- Authentication: Required
- Request Body:
  ```json
  {
    "sessionId": "string",
    "content": {
      "text": "string",
      "model": "string"
    },
    "type": "string",
    "userId": "string",
    "userName": "string",
    "roomId": "string",
    "agentId": "string",
    "isUnique": boolean,
    "importance_score": number
  }
  ```
- Response: 
  ```json
  {
    "success": true,
    "memory": {
      "id": "string",
      "type": "string",
      "content": {
        "text": "string",
        "model": "string"
      },
      "createdAt": number
    }
  }
  ```

#### Find Memories
- Endpoint: `POST /api/character/find-memory`
- Authentication: Required
- Request Body:
  ```json
  {
    "sessionId": "string",
    "query": "string",
    "agentId": "string"
  }
  ```
- Response: 
  ```json
  {
    "memories": [
      {
        "id": "string",
        "type": "string",
        "content": {
          "text": "string",
          "model": "string"
        },
        "createdAt": number,
        "importance_score": number
      }
    ]
  }
  ```

#### List Memories
- Endpoint: `POST /api/character/memories`
- Authentication: Required
- Request Body:
  ```json
  {
    "slug": "string",
    "sessionId": "string",
    "type": "string"
  }
  ```
- Response: Array of memory objects

#### Delete Memory
- Endpoint: `POST /api/character/delete-memory`
- Authentication: Required
- Request Body:
  ```json
  {
    "sessionId": "string",
    "memoryId": "string"
  }
  ```
- Response:
  ```json
  {
    "success": true
  }
  ```

#### Update Memory
- Endpoint: `POST /api/character/update-memory`
- Authentication: Required
- Request Body:
  ```json
  {
    "sessionId": "string",
    "memoryId": "string",
    "content": {
      "text": "string",
      "model": "string"
    },
    "type": "string",
    "importance_score": number
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "memory": {
      "id": "string",
      "type": "string",
      "content": {
        "text": "string",
        "model": "string"
      },
      "importance_score": number,
      "updatedAt": number
    }
  }
  ```

### Memory Schema
```sql
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    userId TEXT,
    userName TEXT,
    roomId TEXT,
    agentId TEXT NOT NULL,
    isUnique INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    importance_score REAL DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    last_accessed INTEGER,
    metadata TEXT,
    FOREIGN KEY(agentId) REFERENCES characters(slug)
);
```

### Memory Types
The system supports various memory types:
- `message`: Standard conversation messages
- `reflection`: Character's internal thoughts/reflections
- `fact`: Important facts about users or context
- `summary`: Conversation summaries
- `custom`: User-defined memory types

### Memory Security
The memory system implements several security measures:
1. API key authentication for all endpoints
2. Character ownership verification
3. User-specific memory access control
4. Public vs private memory separation
5. Secure memory deletion with ownership checks

### Memory Search Features
The search functionality includes:
1. Full-text search within memory content
2. Case-insensitive matching
3. Character-specific scoping
4. User-specific filtering
5. Type-based filtering
6. Importance score consideration
7. Room-based context filtering

### Best Practices for Memory Management
1. Regularly clean up old or unused memories
2. Use appropriate memory types for different content
3. Set reasonable importance scores
4. Implement proper error handling
5. Monitor memory usage and performance
6. Regular backups of critical memories
7. Proper security checks before operations

## Social Media Integration

### Twitter Endpoints

#### Post Tweet
- Endpoint: `POST /api/twitter/post`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "tweet": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Post Tweet with Media
- Endpoint: `POST /api/twitter/post-with-media`
- Authentication: Required
- Request Body: FormData containing:
  - `userId`: Character owner's ID
  - `characterName`: Character's name
  - Media file(s)

#### Get Twitter Notifications
- Endpoint: `POST /api/twitter/notifications`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Retweet
- Endpoint: `POST /api/twitter/retweet`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "tweetId": "string",
    "quoteText": "string"
  }
  ```

#### Reply to Tweet
- Endpoint: `POST /api/twitter/reply`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "tweetId": "string",
    "replyText": "string"
  }
  ```

#### Like Tweet
- Endpoint: `POST /api/twitter/like`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "tweetId": "string"
  }
  ```

#### Classify Tweet Content
- Endpoint: `POST /api/twitter/classify`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "text": "string"
  }
  ```

#### Get Twitter Credentials
- Endpoint: `POST /get-my-twitter-credentials`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string"
  }
  ```

### Telegram Endpoints

#### Send Message
- Endpoint: `POST /api/telegram/message`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "chatId": "string",
    "message": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Get Updates
- Endpoint: `POST /api/telegram/updates`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Reply to Message
- Endpoint: `POST /api/telegram/reply`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "messageId": "string",
    "replyText": "string",
    "chatId": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Edit Message
- Endpoint: `POST /api/telegram/edit`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "messageId": "string",
    "newText": "string",
    "chatId": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Pin Message
- Endpoint: `POST /api/telegram/pin`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "messageId": "string",
    "chatId": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Get Messages
- Endpoint: `POST /api/telegram/messages`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "chatId": "string",
    "sessionId": "string",
    "roomId": "string",
    "nonce": "string"
  }
  ```

#### Get Telegram Credentials
- Endpoint: `POST /get-my-telegram-credentials`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string"
  }
  ```

## Discord Integration

#### Get Discord Credentials
- Endpoint: `POST /discord-credentials`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string"
  }
  ```

#### Handle Discord Interactions
- Endpoint: `POST /interactions`
- Authentication: Not Required
- Headers Required:
  - `x-signature-ed25519`
  - `x-signature-timestamp`
- Request Body: Discord interaction payload

#### Initialize Discord Bot
- Endpoint: `POST /discord/init`
- Authentication: Not Required
- Request Body:
  ```json
  {
    "applicationId": "string"
  }
  ```

#### Check Discord Bot Status
- Endpoint: `POST /discord/check`
- Authentication: Not Required
- Request Body:
  ```json
  {
    "applicationId": "string"
  }
  ```

## Vision and AI Endpoints

#### Generate Character
- Endpoint: `POST /generate-character`
- Authentication: Required
- Request Body:
  ```json
  {
    "prompt": "string"
  }
  ```

#### Describe Image
- Endpoint: `POST /api/vision/describe`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "image": "string" // URL of the image
  }
  ```

## Character Import/Export

#### Export Character
- Endpoint: `POST /api/character/export`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string"
  }
  ```

#### Import New Character
- Endpoint: `POST /api/character/import-new`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "importData": {
      "character": {
        "name": "string",
        "model_provider": "string",
        "status": "string",
        "bio": "string",
        // ... other character fields
      }
    }
  }
  ```

## System Management Endpoints

#### Migrate Data
- Endpoint: `POST /migrate-data`
- Authentication: Required (Admin)

#### Migrate Authors
- Endpoint: `POST /migrate-authors`
- Authentication: Required (Admin)

#### Migrate Character Schema
- Endpoint: `POST /migrate-character-schema`
- Authentication: Required (Admin)

#### Clear Cache
- Endpoint: `POST /clear-cache`
- Authentication: Required (Admin)

#### Record Visit
- Endpoint: `POST /record-visit`
- Authentication: Not Required
- Query Parameters:
  - `author`: Author name
  - `slug`: World slug

#### Upload Character Image
- Endpoint: `POST /upload-character-image`
- Authentication: Required
- Request Body: FormData containing image file

#### Update Character Keys
- Endpoint: `POST /update-character-keys`
- Authentication: Required
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string",
    "keys": {
      // API keys and credentials
    }
  }
  ```

## Authentication System

### Public Endpoints
- `/register`: Get registration page HTML
- `/create-user`: Register new user (requires invite code)
- `/roll-api-key`: Get API key roll interface
- `/roll-key-with-token`: Complete key roll with verification token
- `/initiate-key-roll`: Start key recovery process
- `/verify-key-roll`: Complete key recovery with GitHub verification

### Authenticated Endpoints
- `/rotate-key`: Standard API key rotation
- `/delete-user`: Remove user and associated data (admin only)
- `/admin-update-user`: Update user details (admin only)

## Authentication Requirements

Most POST endpoints require authentication via API key in the Authorization header:

```bash
curl -X POST https://your-worker.dev/endpoint \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

Admin-only endpoints require the main API secret:
```bash
curl -X POST https://your-worker.dev/admin-update-user \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: 'application/json"
```

## User Management

The Plugin Publishing System includes a robust user management system with secure registration, API key management, and GitHub-based verification.

### Registration

New users can register through the `/register` endpoint which provides a web interface for:
- Creating a new author account
- Setting up GitHub integration
- Generating initial API credentials
- Requiring invite codes for controlled access

Registation workflow:
1. User visits the registration page
2. Provides username, email, GitHub username, and invite code
3. System validates credentials and invite code
4. Generates initial API key
5. Downloads configuration file with credentials


## Character System Features

### Character Configuration
Characters support rich configuration including:
- Basic info (name, bio, status)
- Model provider selection (OpenAI/Anthropic)
- Communication channels (Discord, Direct)
- Personality traits and topics
- Message examples
- Style settings
- Custom API keys per character

### Memory System
Characters maintain:
- Conversation history
- User-specific memories
- Room-based context
- Memory importance scoring
- Cross-room memory retrieval

### Session Management
- Secure session initialization
- Nonce-based message validation
- Room-based conversations
- Auto-cleanup of expired sessions

## Database Schema

### World Registry
```sql
CREATE TABLE worlds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    short_description TEXT,
    version TEXT NOT NULL,
    visit_count INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(author, slug)
);
```

### Character Registry
```sql
CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    name TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    bio TEXT,
    settings TEXT,
    vrm_url TEXT,
    profile_img TEXT,
    banner_img TEXT,
    status TEXT DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(author, name)
);

CREATE TABLE character_secrets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    salt TEXT NOT NULL,
    model_keys TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(character_id) REFERENCES characters(id)
);

CREATE TABLE character_sessions (
    id TEXT PRIMARY KEY,
    character_id INTEGER,
    room_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(character_id) REFERENCES characters(id)
);
```

### User Authentication
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    github_username TEXT,
    key_id TEXT NOT NULL UNIQUE,
    key_hash TEXT NOT NULL,
    invite_code_used TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_key_rotation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Key Management

The system provides several methods for managing API keys:

#### Standard Key Rotation
- Endpoint: `POST /rotate-key`
- Requires current API key authentication
- Generates new credentials immediately
- Invalidates previous key

#### GitHub-Based Key Recovery
For users who need to recover access, the system provides a secure GitHub-based verification:

1. **Initiate Recovery**
   - Endpoint: `POST /initiate-key-roll`
   - Required fields:
     ```json
     {
       "username": "string",
       "email": "string"
     }
     ```
   - Returns verification instructions and token

2. **Create Verification Gist**
   - User creates a public GitHub gist
   - Filename must match pattern: `plugin-publisher-verify-{username}.txt`
   - Content must include provided verification token

3. **Complete Verification**
   - Endpoint: `POST /verify-key-roll`
   - Required fields:
     ```json
     {
       "gistUrl": "string",
       "verificationToken": "string"
     }
     ```
   - System verifies:
     - Gist ownership matches registered GitHub username
     - Verification token is valid and not expired
     - File content matches expected format
   - Returns new API key upon successful verification

![Roll Key Gist Example](../docs/assets/roll-key-screenshot.jpg)

## Caching

The system implements caching for GET requests with:
- CDN edge caching (1-hour TTL)
- Version-based cache keys
- Automatic invalidation on content updates
- Auth-based cache bypassing

Cache is automatically invalidated when:
- A new world/character is published
- Author information is updated
- A GET request contains a valid API secret

## Rate Limiting

- IP-based rate limiting using Cloudflare KV
- 5 downloads per hour per IP/world combination
- Message rate limiting for character interactions

## Security Features

- HMAC-based API key validation
- Nonce-based message authentication
- Salt-based secret encryption
- GitHub-based key recovery verification
- CSP headers for world rendering
- Invite code system for registration

## Error Handling

All endpoints return standardized error responses:
```json
{
    "error": "Error description",
    "details": "Detailed error message"
}
```

## Best Practices

1. Always verify API keys before sensitive operations
2. Use appropriate content-type headers
3. Implement proper error handling
4. Clear cache after content updates
5. Regular key rotation
6. Monitor rate limits
7. Backup important worlds before updates

## Troubleshooting

1. **Wrangler not found**: Ensure Wrangler is installed globally: `npm install -g wrangler`
2. **Deployment fails**: Verify you're logged in to your Cloudflare account: `npx wrangler login`
3. **R2 bucket creation fails**: Confirm R2 is enabled for your Cloudflare account
4. **API requests fail**: Double-check you're using the correct API Secret in your requests

## Limitations

- The setup script assumes you have the necessary permissions to create resources and deploy workers in your Cloudflare account.
- The script does not provide options for cleaning up resources if the setup fails midway.
- Existing resources with the same names may be overwritten without warning.
- Caching is set to a fixed duration (1 hour). Adjust the `max-age` value in the code if you need different caching behavior.

## Support

For issues or assistance:
1. Check the Troubleshooting section
2. Review the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
3. Contact Cloudflare support for platform-specific issues