# World and Character Management System

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
- `CHARACTER_PLANS`: Stores daily activity plans for characters, with keys in format `plan_{characterId}_{YYYY-MM-DD}`
- `VISIT_COUNTS`: Tracks world visits and analytics
- `DOWNLOAD_RATELIMIT`: Manages rate limiting for world downloads
- `DOWNLOAD_QUEUE`: Handles download queues for large world files

Each KV namespace serves a specific purpose:

### CHARACTER_PLANS
- Stores daily generated plans for each character
- Keys are time-based and character-specific
- Used by the planning system to track and execute character activities
- Automatically cleaned up after plans expire
- Example key: `plan_123_2024-02-03`

### VISIT_COUNTS
- Tracks analytics for world visits
- Helps measure world popularity
- Used for featured worlds ranking
- Aggregates visit data over time

### DOWNLOAD_RATELIMIT
- Prevents abuse of download endpoints
- Tracks IP-based rate limits
- Ensures fair usage of bandwidth
- Configurable limits per time window

### DOWNLOAD_QUEUE
- Manages asynchronous download requests
- Handles large world downloads
- Prevents server overload
- Provides status tracking for downloads

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

### Character Activity Planning

The system includes a sophisticated planning system that allows characters to generate and execute daily activity plans. Plans are stored in a dedicated KV store named `CHARACTER_PLANS`.

#### Generate Tweet Prompt
- Endpoint: `POST /api/character/generate-prompt`
- Authentication: Required
- Description: Generates a contextually appropriate tweet prompt based on the character's personality and style
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
    "topic": "string",
    "context": "string"
  }
  ```

#### Generate Daily Plan
- Endpoint: `POST /api/character/generate-plan`
- Authentication: Required
- Description: Creates a daily plan of activities for the character, including social media interactions, world visits, and messaging
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
    "plan": [
      {
        "time": "UTC timestamp in ISO format",
        "action": "string (one of: tweet, tweet_with_media, like, reply, retweet, telegram_message, telegram_reply, telegram_edit, telegram_pin, discord_message, discord_reply, discord_react, discord_pin, discord_thread, visit_world)",
        "reason": "string explaining why this action at this time",
        "status": "string (pending, completed, failed)"
      }
    ],
    "characterId": "string",
    "characterName": "string",
    "userId": "string",
    "generatedAt": "ISO timestamp",
    "lastChecked": "ISO timestamp"
  }
  ```

#### Get Current Plan
- Endpoint: `POST /api/character/get-plan`
- Authentication: Required
- Description: Retrieves the current day's plan for a character from the KV store
- Request Body:
  ```json
  {
    "userId": "string",
    "characterName": "string"
  }
  ```
- Response: Same format as generate-plan response

### Plan Storage and Execution

Plans are stored in Cloudflare KV with the following characteristics:
- Key format: `plan_{characterId}_{YYYY-MM-DD}`
- Daily plans are automatically generated and stored
- Plans include a mix of social media and world interaction activities
- Each action includes execution status tracking
- Plans are executed based on UTC timestamps
- Failed actions are logged with error details
- Plan execution status is updated in real-time

### Best Practices for Character Plans

1. Generate plans during low-activity periods
2. Include a mix of different action types
3. Space activities throughout the day
4. Consider character's timezone and typical active hours
5. Monitor plan execution status
6. Handle failed actions appropriately
7. Regular cleanup of old plans

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

### Extended Character Fields
The character system includes several specialized fields for enhanced functionality:

#### Companion System
- `companion_slug`: Links characters together, enabling companion relationships and interactions
- Useful for creating character networks and relationships
- Enables cross-character memory sharing and interactions

#### Equipment System
- `equipped_inventory`: JSON array storing currently equipped items
- Supports virtual item management
- Can affect character behavior and capabilities
- Stored as stringified JSON for flexibility

#### Approval and Moderation
- `approval_channel`: Configures where moderation requests are sent
- Enables content filtering and approval workflows
- Can be used for multi-stage content review

#### Character State
- `mood`: Tracks character's current emotional state
- Defaults to "normal"
- Influences character responses and behavior
- Can be updated based on interactions

#### Stats and Metrics
- `stats`: JSON object storing character statistics
- Can track interaction metrics, preferences, and other numerical data
- Useful for character development and progression
- Stored as stringified JSON for flexibility

#### Extended Data Storage
- `extras`: Public additional data storage
- `private_extras`: Protected additional data storage
- Both stored as JSON objects
- `extras` is always returned to clients
- `private_extras` is only accessible server-side
- Useful for storing character-specific configuration and data

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
    companion_slug TEXT,
    equipped_inventory TEXT DEFAULT '[]',
    approval_channel TEXT,
    mood TEXT DEFAULT 'normal',
    stats TEXT DEFAULT '{}',
    extras TEXT DEFAULT '{}',
    private_extras TEXT DEFAULT '{}',
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