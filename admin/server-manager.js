#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to kill existing server processes
function killExistingServers() {
    return new Promise((resolve) => {
        exec('pkill -f "node server.js"', (error) => {
            // Ignore errors since process might not exist
            setTimeout(resolve, 1000); // Wait a bit for cleanup
        });
    });
}

// Function to check if port is in use
function isPortInUse(port) {
    return new Promise((resolve) => {
        exec(`lsof -ti:${port}`, (error, stdout) => {
            resolve(!!stdout.trim());
        });
    });
}

// Function to start server
function startServer() {
    console.log('Starting admin server...');
    
    const serverProcess = spawn('node', ['server.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });
    
    serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
    
    serverProcess.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Server exited with code ${code}`);
        }
    });
    
    // Open browser after a delay
    setTimeout(() => {
        const open = process.platform === 'darwin' ? 'open' : 
                     process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${open} http://localhost:3002`);
    }, 3000);
    
    return serverProcess;
}

// Main function
async function main() {
    console.log('Everything Bot Admin Server Manager');
    console.log('==================================');
    
    // Kill any existing servers
    console.log('Checking for existing servers...');
    await killExistingServers();
    
    // Check if port is still in use
    const portInUse = await isPortInUse(3002);
    if (portInUse) {
        console.log('Port 3002 is still in use. Waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Start new server
    const server = startServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down server...');
        server.kill('SIGTERM');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        server.kill('SIGTERM');
        process.exit(0);
    });
}

main().catch(console.error);