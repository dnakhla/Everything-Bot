/**
 * Safe Code Runner - Execute JavaScript code in a controlled environment
 */

import vm from 'vm';
import { Logger } from '../utils/logger.js';

/**
 * Execute JavaScript code safely with timeout and sandboxing
 */
export async function runCode(code, context = {}, options = {}) {
  const {
    timeout = 5000, // 5 second timeout
    language = 'javascript'
  } = options;

  if (language !== 'javascript' && language !== 'js') {
    throw new Error(`Unsupported language: ${language}. Only JavaScript is supported.`);
  }

  try {
    Logger.log(`Executing code: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);

    // Create a safe execution context
    const sandbox = {
      // Math functions
      Math: Math,

      // Safe global functions
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,

      // Date operations
      Date: Date,

      // JSON operations
      JSON: JSON,

      // Array operations
      Array: Array,

      // Object operations
      Object: Object,

      // String operations
      String: String,

      // Number operations
      Number: Number,

      // RegExp
      RegExp: RegExp,

      // Console for debugging (limited)
      console: {
        log: (...args) => Logger.log(`CODE OUTPUT: ${args.join(' ')}`),
        error: (...args) => Logger.log(`CODE ERROR: ${args.join(' ')}`, 'error'),
        warn: (...args) => Logger.log(`CODE WARN: ${args.join(' ')}`, 'warn')
      },

      // Add user context variables
      ...context,

      // Result variable to capture output
      result: undefined
    };

    // Wrap code to capture result
    const wrappedCode = `
      try {
        result = (function() {
          ${code}
        })();
        if (result === undefined) {
          // If no explicit return, try to evaluate as expression
          result = eval(${JSON.stringify(code)});
        }
      } catch (e) {
        if (result === undefined) {
          // Try direct evaluation as fallback
          result = eval(${JSON.stringify(code)});
        }
      }
    `;

    // Create VM context
    const vmContext = vm.createContext(sandbox);

    // Execute code with timeout
    vm.runInContext(wrappedCode, vmContext, {
      timeout: timeout,
      displayErrors: true
    });

    const result = vmContext.result;

    Logger.log(`Code execution completed. Result type: ${typeof result}`);

    // Format result for display
    if (result === null) {
      return 'null';
    } else if (result === undefined) {
      return 'undefined';
    } else if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch (e) {
        return result.toString();
      }
    } else if (typeof result === 'function') {
      return `[Function: ${result.name || 'anonymous'}]`;
    } else {
      return String(result);
    }

  } catch (error) {
    Logger.log(`Code execution error: ${error.message}`, 'error');

    // Provide helpful error messages
    if (error.message.includes('Script execution timed out')) {
      return `❌ Code execution timed out after ${timeout}ms. Try simplifying your code.`;
    } else if (error.message.includes('is not defined')) {
      return `❌ ${error.message}. Available functions: Math.*, Date, JSON, Array.*, Object.*, String.*, Number.*`;
    } else if (error.message.includes('Access denied')) {
      return `❌ Access denied. Code execution is restricted to safe operations only.`;
    } else {
      return `❌ Error: ${error.message}`;
    }
  }
}

/**
 * Validate code for basic safety (additional layer of protection)
 */
function validateCode(code) {
  const dangerousPatterns = [
    /require\s*\(/,
    /import\s+/,
    /process\./,
    /global\./,
    /eval\s*\(/,  // Block explicit eval calls (we use it internally safely)
    /Function\s*\(/,
    /setTimeout\s*\(/,
    /setInterval\s*\(/,
    /fs\./,
    /child_process/,
    /exec\s*\(/,
    /spawn\s*\(/
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      throw new Error(`Potentially unsafe code pattern detected: ${pattern.source}`);
    }
  }
}

export { validateCode };