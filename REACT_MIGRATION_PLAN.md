# ClaudePilot React Migration Plan

## Overview
This document outlines the strategy for migrating the ClaudePilot extension's webview implementation from vanilla JavaScript/HTML to React. The migration will be done incrementally to maintain functionality while modernizing the codebase.

## Current Architecture Analysis

### Webview Components
1. **Terminal View** - xterm.js based terminal emulator
2. **Startup Menu** - Interactive session management interface
3. **Enhanced Startup Menu** - Extended menu with session browsing
4. **Todo Integration** - Task tracking display (planned)
5. **Drag & Drop Handler** - File drop functionality

### Communication Layer
- Message-based architecture using `postMessage`/`onmessage`
- Bidirectional communication between extension host and webview
- Event-driven updates for terminal data, resize, and user actions

## Migration Strategy

### Phase 1: Setup and Infrastructure (Week 1)
1. **React Build Pipeline**
   - Set up webpack/vite configuration for webview builds
   - Configure TypeScript for React components
   - Set up development hot-reload for webview
   - Integrate build process with extension compilation

2. **Base React App Structure**
   - Create React app entry point
   - Set up React context for VS Code API
   - Implement message passing hooks
   - Create base layout component

3. **Security and CSP**
   - Maintain CSP nonce generation
   - Configure React for CSP compliance
   - Ensure no inline styles/scripts

### Phase 2: Component Migration (Weeks 2-3)
1. **Terminal Component**
   - Wrap xterm.js in React component
   - Implement lifecycle management (mount/unmount)
   - Handle resize with React hooks
   - Maintain terminal state in React

2. **Menu Components**
   - Convert startup menu to React component
   - Implement enhanced menu as separate component
   - Use React state for menu interactions
   - Add keyboard navigation with React

3. **Shared Components**
   - Create reusable Button component
   - Create SessionList component
   - Create LoadingSpinner component
   - Create ErrorBoundary component

### Phase 3: State Management (Week 4)
1. **Context Providers**
   - TerminalContext for terminal state
   - SessionContext for session management
   - SettingsContext for user preferences
   - MessageContext for extension communication

2. **Custom Hooks**
   - `useVSCodeAPI` - VS Code API wrapper
   - `useTerminal` - Terminal operations
   - `useMessages` - Message handling
   - `useSessions` - Session management
   - `useKeyboardShortcuts` - Keyboard handling

### Phase 4: Feature Enhancement (Week 5)
1. **New Features**
   - Add terminal tabs support
   - Implement split terminal view
   - Add command palette integration
   - Enhanced drag & drop with preview

2. **UI Improvements**
   - Add smooth transitions
   - Implement theme-aware components
   - Add accessibility features
   - Responsive layout adjustments

### Phase 5: Testing and Optimization (Week 6)
1. **Testing**
   - Unit tests for React components
   - Integration tests for message passing
   - E2E tests for critical workflows
   - Performance benchmarking

2. **Optimization**
   - Code splitting for faster load
   - Lazy loading for menu components
   - Memoization for expensive renders
   - WebGL renderer optimization

## Technical Implementation Details

### File Structure
```
src/
├── webview/
│   ├── components/
│   │   ├── Terminal/
│   │   │   ├── Terminal.tsx
│   │   │   ├── Terminal.styles.ts
│   │   │   └── index.ts
│   │   ├── Menu/
│   │   │   ├── StartupMenu.tsx
│   │   │   ├── EnhancedMenu.tsx
│   │   │   ├── Menu.styles.ts
│   │   │   └── index.ts
│   │   ├── Todo/
│   │   │   ├── TodoList.tsx
│   │   │   ├── TodoItem.tsx
│   │   │   └── index.ts
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Loading.tsx
│   │       └── ErrorBoundary.tsx
│   ├── contexts/
│   │   ├── TerminalContext.tsx
│   │   ├── SessionContext.tsx
│   │   ├── SettingsContext.tsx
│   │   └── MessageContext.tsx
│   ├── hooks/
│   │   ├── useVSCodeAPI.ts
│   │   ├── useTerminal.ts
│   │   ├── useMessages.ts
│   │   └── useSessions.ts
│   ├── utils/
│   │   ├── messages.ts
│   │   ├── terminal.ts
│   │   └── theme.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── types.ts
├── claudeCodeProvider.ts (modified)
└── utils/
    └── webviewTemplate.ts (modified for React)
```

### Key React Components

#### Terminal Component
```typescript
interface TerminalProps {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  theme: TerminalTheme;
}

const Terminal: React.FC<TerminalProps> = ({ onData, onResize, theme }) => {
  // xterm.js integration
  // Handle lifecycle, resize, data flow
};
```

#### Message Hook
```typescript
interface UseMessagesReturn {
  sendMessage: (type: string, data: any) => void;
  addMessageHandler: (type: string, handler: Function) => void;
  removeMessageHandler: (type: string, handler: Function) => void;
}

const useMessages = (): UseMessagesReturn => {
  // VS Code postMessage wrapper
  // Event listener management
};
```

### Build Configuration
```javascript
// webpack.config.js
module.exports = {
  entry: './src/webview/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist/webview'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  externals: {
    vscode: 'commonjs vscode'
  }
};
```

## Migration Checklist

### Pre-Migration
- [ ] Backup current implementation
- [ ] Document current message API
- [ ] List all webview features
- [ ] Identify external dependencies

### Phase 1
- [ ] Set up React build pipeline
- [ ] Create base React structure
- [ ] Implement message passing
- [ ] Verify CSP compliance

### Phase 2
- [ ] Migrate terminal component
- [ ] Migrate menu components
- [ ] Create shared components
- [ ] Maintain backward compatibility

### Phase 3
- [ ] Implement state management
- [ ] Create custom hooks
- [ ] Refactor message handling
- [ ] Add TypeScript types

### Phase 4
- [ ] Add new features
- [ ] Enhance UI/UX
- [ ] Implement accessibility
- [ ] Add keyboard shortcuts

### Phase 5
- [ ] Write component tests
- [ ] Performance optimization
- [ ] Documentation update
- [ ] User acceptance testing

## Risk Mitigation

### Potential Risks
1. **Breaking Changes** - Maintain feature parity during migration
2. **Performance Issues** - Monitor bundle size and render performance
3. **CSP Violations** - Test thoroughly with VS Code CSP
4. **Theme Integration** - Ensure React components respect VS Code themes

### Mitigation Strategies
1. **Feature Flags** - Toggle between old/new implementation
2. **Incremental Rollout** - Migrate one component at a time
3. **Extensive Testing** - Automated tests for each phase
4. **User Feedback** - Beta testing with select users

## Success Metrics
- No regression in functionality
- Improved load time (<200ms)
- Reduced bundle size (<500KB)
- Better maintainability (component reusability)
- Enhanced user experience (smooth interactions)

## Timeline
- **Total Duration**: 6 weeks
- **Start Date**: TBD
- **Key Milestones**:
  - Week 1: Infrastructure ready
  - Week 3: Core components migrated
  - Week 4: State management complete
  - Week 5: New features added
  - Week 6: Testing complete

## Next Steps
1. Review and approve migration plan
2. Set up development environment
3. Create feature branch for migration
4. Begin Phase 1 implementation