# Claude Pilot Todo List Integration Plan

## Overview
Integrate Claude's todo lists into the VS Code extension by tracking session IDs and displaying todos in a native VS Code interface.

## Key Insight
Claude saves todo lists to `~/.claude/todos/` with filenames containing the session ID. By controlling session ID generation, we can reliably track and display todos.

## Implementation Phases

### Phase 1: Session ID Management
**Goal**: Take control of session ID generation and tracking

1. **Generate UUIDs for new sessions**
   - Use `crypto.randomUUID()` when starting new Claude sessions
   - Pass generated UUID to Claude CLI with appropriate flags

2. **Store session IDs in VS Code state**
   - Create state structure: `{lastSessionId: string, sessionHistory: string[]}`
   - Persist across VS Code sessions using `context.globalState`

3. **Update startup menu handling**
   - Modify "New Session" to use generated UUID
   - Pass UUID to Claude CLI: `claude --session <uuid>`

4. **Modify resume functionality**
   - "Continue Last Session": Use stored `lastSessionId`
   - Pass to Claude CLI: `claude --resume <uuid>`

### Phase 2: Todo File Monitoring
**Goal**: Watch and parse Claude's todo files

1. **Create file watcher**
   - Monitor `~/.claude/todos/` directory
   - Filter for files matching current session ID pattern
   - Handle file creation, updates, and deletion

2. **Parse todo JSON files**
   - Read and parse todo file structure
   - Extract todo items with id, content, status, priority
   - Handle parsing errors gracefully

3. **Match files to active session**
   - Use tracked session ID to identify correct todo file
   - Handle multiple VS Code instances safely

### Phase 3: Todo Display (TreeView)
**Goal**: Display todos in VS Code's native UI

1. **Create VS Code TreeView provider**
   - Implement `vscode.TreeDataProvider` for todos
   - Structure: Todo items grouped by status
   - Show todo content, status, and priority

2. **Register todo view**
   - Add view container in `package.json`
   - Position in activity bar or panel
   - Add icon and title

3. **Update todos on file changes**
   - Refresh TreeView when todo file updates
   - Maintain expanded/collapsed state
   - Show loading state during updates

4. **Show todo status visually**
   - Different icons for pending/in_progress/completed
   - Color coding for priority levels
   - Progress indicators

### Phase 4: Enhancements
**Goal**: Improve usability and integration

1. **Interactive features**
   - Click to copy todo text to clipboard
   - Double-click to insert into active editor
   - Context menu actions

2. **Status indicators**
   - Show todo count in status bar
   - Badge on activity bar icon
   - Progress percentage

3. **Auto-refresh**
   - Debounced updates to prevent flashing
   - Smooth transitions between states
   - Error recovery

4. **Session management**
   - Quick session switching
   - Show session info in todo view
   - Clear old session data

## Technical Considerations

### File Structure
```
src/
  todos/
    todoProvider.ts      # TreeView provider
    todoWatcher.ts       # File system watcher
    todoParser.ts        # JSON parsing logic
  session/
    sessionManager.ts    # UUID generation and tracking
```

### State Management
- Use VS Code's `globalState` for persistence
- Implement migration for existing users
- Handle corrupt state gracefully

### Error Handling
- Missing todo files
- Invalid JSON
- Permission errors
- Race conditions with multiple instances

## Success Criteria
- [ ] Session IDs are reliably tracked
- [ ] Todos appear immediately when created
- [ ] Updates reflect in real-time
- [ ] Works with multiple VS Code instances
- [ ] Graceful handling of edge cases