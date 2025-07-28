/**
 * Test Example for Todo Module
 * 
 * This file demonstrates how to test the todo functionality.
 * Run this as a standalone script to verify the module works correctly.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TodoManager } from './todoManager';
import { TodoParser } from './todoParser';

// Test data
const TEST_SESSION_ID = 'test-session-12345';
const TODOS_DIR = path.join(os.homedir(), '.claude', 'todos');
const TEST_FILE = path.join(TODOS_DIR, `todos-${TEST_SESSION_ID}.json`);

const TEST_TODO_DATA = {
    todos: [
        {
            id: '1',
            content: 'Implement todo file watcher',
            status: 'completed',
            priority: 'high'
        },
        {
            id: '2',
            content: 'Create todo parser module',
            status: 'completed',
            priority: 'high'
        },
        {
            id: '3',
            content: 'Test integration with session manager',
            status: 'in_progress',
            priority: 'medium'
        },
        {
            id: '4',
            content: 'Create TreeView provider for Phase 3',
            status: 'pending',
            priority: 'medium'
        }
    ]
};

async function runTest() {
    console.log('=== Todo Module Test Example ===\n');
    
    // Ensure todos directory exists
    if (!fs.existsSync(TODOS_DIR)) {
        fs.mkdirSync(TODOS_DIR, { recursive: true });
        console.log(`Created test directory: ${TODOS_DIR}`);
    }
    
    // Test 1: TodoParser
    console.log('1. Testing TodoParser...');
    
    // Create test file
    fs.writeFileSync(TEST_FILE, JSON.stringify(TEST_TODO_DATA, null, 2));
    console.log(`   Created test file: ${TEST_FILE}`);
    
    // Parse the file
    const parseResult = await TodoParser.parseTodoFile(TEST_FILE);
    if (parseResult.success && parseResult.data) {
        console.log(`   ✓ Parsed successfully`);
        console.log(`   - Session ID: ${parseResult.data.sessionId}`);
        console.log(`   - Todos: ${parseResult.data.todos.length}`);
        
        const stats = TodoParser.getTodoStats(parseResult.data);
        console.log(`   - Stats: ${JSON.stringify(stats)}`);
    } else {
        console.error(`   ✗ Parse failed:`, parseResult.error);
    }
    
    // Test 2: TodoManager
    console.log('\n2. Testing TodoManager...');
    
    const todoManager = new TodoManager();
    let changeEventFired = false;
    
    // Set up listener
    todoManager.on('todoChanged', (event) => {
        changeEventFired = true;
        console.log(`   ✓ Received ${event.type} event for session ${event.sessionId}`);
        if (event.todoList) {
            console.log(`   - Todos: ${event.todoList.todos.length}`);
        }
    });
    
    // Start session
    await todoManager.startSession(TEST_SESSION_ID);
    console.log(`   Started session: ${TEST_SESSION_ID}`);
    
    // Wait a bit for events to fire
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get current todos
    const currentTodos = todoManager.getCurrentTodos();
    console.log(`   Current todos: ${currentTodos.length} lists`);
    
    const stats = todoManager.getTodoStats();
    console.log(`   Overall stats: ${JSON.stringify(stats)}`);
    
    // Test 3: File update
    console.log('\n3. Testing file update detection...');
    
    // Update the file
    TEST_TODO_DATA.todos[2].status = 'completed';
    fs.writeFileSync(TEST_FILE, JSON.stringify(TEST_TODO_DATA, null, 2));
    console.log('   Updated test file');
    
    // Wait for update event
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Stop session
    todoManager.stopSession();
    console.log('   Stopped session');
    
    // Cleanup
    todoManager.dispose();
    
    // Remove test file
    if (fs.existsSync(TEST_FILE)) {
        fs.unlinkSync(TEST_FILE);
        console.log(`\nCleaned up test file: ${TEST_FILE}`);
    }
    
    console.log('\n=== Test completed ===');
}

// Run test if this file is executed directly
if (require.main === module) {
    runTest().catch(console.error);
}