/**
 * Drag and drop handling for the terminal webview
 */

export const getDragDropScript = (): string => `
    let isDragActive = false;
    
    function setupDragCapture() {
        // Use capture phase to intercept events before VS Code
        document.addEventListener('dragenter', handleDragEnter, true);
        document.addEventListener('dragover', handleDragOver, true);
        document.addEventListener('dragleave', handleDragLeave, true);
        document.addEventListener('drop', handleDrop, true);
        document.addEventListener('dragend', handleDragEnd, true);
        
        // Reset on mouse interactions
        document.addEventListener('mouseup', resetAllDragState);
        document.addEventListener('click', resetAllDragState);
    }
    
    function resetAllDragState() {
        isDragActive = false;
        const terminal = document.getElementById('terminal');
        terminal.classList.remove('drag-over');
    }
    
    function handleDragEnd(ev) {
        resetAllDragState();
    }
    
    function handleDragEnter(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        dragenter(ev);
    }
    
    function handleDragOver(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        dragover(ev);
    }
    
    function handleDragLeave(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        dragleave(ev);
    }
    
    function handleDrop(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        Object.defineProperty(ev, 'shiftKey', { value: true, writable: false });
        drop(ev);
    }
    
    function dragenter(ev) {
        isDragActive = true;
        const terminal = document.getElementById('terminal');
        terminal.classList.add('drag-over');
    }
    
    function dragover(ev) {
        // Keep drag active
    }
    
    function dragleave(ev) {
        // Only remove if leaving the document completely
        if (ev.clientX === 0 && ev.clientY === 0) {
            resetAllDragState();
        }
    }
    
    function drop(ev) {
        resetAllDragState();
        
        const files = ev.dataTransfer.files;
        const text = ev.dataTransfer.getData('text/plain');
        
        if (files.length > 0) {
            // Handle file drops with FileReader
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    const fileData = event.target.result;
                    vscode.postMessage({
                        command: 'fileDrop',
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        fileData: fileData
                    });
                };
                
                // Read file based on type
                if (file.type.startsWith('image/') || file.type.startsWith('application/')) {
                    reader.readAsDataURL(file);
                } else {
                    reader.readAsText(file);
                }
            }
        } else if (text) {
            // Plain text drop
            const lines = text.split('\\n');
            for (const line of lines) {
                if (line.trim()) {
                    if (line.startsWith('/') || line.match(/^[a-zA-Z]:\\\\\\\\/)) {
                        vscode.postMessage({ command: 'fileDrop', fileName: line, fileType: 'text/path', fileSize: 0, fileData: line });
                    }
                }
            }
        }
    }
`;