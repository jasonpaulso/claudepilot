# Todo Integration Module

This module implements Phase 2 of the Claude Pilot todo integration plan, providing file watching and parsing capabilities for Claude's todo lists.

## Architecture

### Core Components

1. **TodoWatcher** (`todoWatcher.ts`)
   - Monitors `~/.claude/todos/` directory for file changes
   - Filters files based on session ID
   - Emits events for file creation, updates, and deletion
   - Handles file system errors gracefully

2. **TodoParser** (`todoParser.ts`)
   - Parses Claude's todo JSON files
   - Validates and transforms various todo formats
   - Extracts session IDs from filenames
   - Provides todo statistics

3. **TodoManager** (`todoManager.ts`)
   - Orchestrates watching and parsing
   - Maintains todo cache
   - Debounces rapid file updates
   - Emits unified todo change events

## Usage

```typescript
import { TodoManager } from './todos';
import { SessionManager } from '../session/sessionManager';

// Initialize
const todoManager = new TodoManager();

// Start tracking todos for a session
await todoManager.startSession(sessionId);

// Listen for changes
todoManager.on('todoChanged', (event) => {
    console.log('Todos updated:', event);
    // Update UI, send to webview, etc.
});

// Get current todos
const todos = todoManager.getCurrentTodos();
const stats = todoManager.getTodoStats();

// Stop tracking
todoManager.stopSession();
```

## Event Structure

### TodoChangeEvent
```typescript
{
    type: 'created' | 'updated' | 'deleted',
    sessionId: string,
    todoList?: TodoList,
    error?: Error
}
```

### TodoList
```typescript
{
    sessionId: string,
    todos: TodoItem[],
    filePath: string,
    lastUpdated: Date
}
```

### TodoItem
```typescript
{
    id: string,
    content: string,
    status: 'pending' | 'in_progress' | 'completed',
    priority: 'low' | 'medium' | 'high'
}
```

## File Patterns

The module recognizes these todo filename patterns:
- `todos-{sessionId}.json`
- `{sessionId}-todos.json`
- `todos_{sessionId}.json`
- `{sessionId}.json` (fallback)

## Error Handling

- **Missing files**: Handled gracefully with error events
- **Invalid JSON**: Parser returns error in result
- **Permission errors**: Logged and emitted as error events
- **Race conditions**: Debouncing prevents rapid updates

## Integration Points

1. **Session Start**: Call `todoManager.startSession(sessionId)` when Claude session begins
2. **Session Resume**: Use same session ID to continue tracking
3. **UI Updates**: Listen to `todoChanged` events and update webview
4. **Status Bar**: Use `getTodoStats()` for todo counts
5. **Cleanup**: Call `dispose()` when extension deactivates

## Next Steps (Phase 3)

The next phase will implement:
- VS Code TreeView provider for todo display
- Interactive todo features
- Status bar indicators
- Webview integration