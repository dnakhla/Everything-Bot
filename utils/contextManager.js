/**
 * Context Management System
 * Collects and manages conversation context for reflection and strategic thinking
 */

import { Logger } from './logger.js';

export class ContextManager {
  constructor() {
    this.conversationState = {
      userQuestion: '',
      originalMessage: '',
      chatId: '',
      messageId: '',
      toolsUsed: [],
      searchQueries: [],
      findingsCollected: [],
      currentLoop: 1,
      maxLoops: 10,
      groupDynamics: '',
      taskProgress: ``,
      errors: [],
      startTime: Date.now()
    };
  }

  /**
   * Initialize context with user message and chat info
   */
  initialize(userMessage, chatId, messageId) {
    this.conversationState.userQuestion = userMessage;
    this.conversationState.originalMessage = userMessage;
    this.conversationState.chatId = chatId;
    this.conversationState.messageId = messageId;
    this.conversationState.startTime = Date.now();

    Logger.log(`[ContextManager] Initialized with message: "${userMessage.slice(0, 100)}..."`);
  }

  /**
   * Record tool usage
   */
  recordToolUsage(toolName, parameters, result) {
    // Handle non-string results safely
    const resultString = typeof result === 'string' ? result : JSON.stringify(result);

    const toolUsage = {
      tool: toolName,
      parameters,
      timestamp: Date.now(),
      success: typeof result === 'string' ? !result.includes('Error') : true,
      summary: resultString.slice(0, 200) + (resultString.length > 200 ? '...' : '')
    };

    this.conversationState.toolsUsed.push(toolUsage);

    // Track specific types
    if (toolName === `search`) {
      this.conversationState.searchQueries.push({
        query: parameters.query,
        results: resultString.slice(0, 300)
      });
    }

    Logger.log(`[ContextManager] Recorded ${toolName} usage`);
  }

  /**
   * Update loop information
   */
  updateLoop(currentLoop, maxLoops) {
    this.conversationState.currentLoop = currentLoop;
    this.conversationState.maxLoops = maxLoops;
  }

  /**
   * Record error or issue
   */
  recordError(error, context = ``) {
    this.conversationState.errors.push({
      error: error.toString(),
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Update group dynamics understanding
   */
  updateGroupDynamics(dynamics) {
    this.conversationState.groupDynamics = dynamics;
  }

  /**
   * Update task progress
   */
  updateTaskProgress(progress) {
    this.conversationState.taskProgress = progress;
  }

  /**
   * Add findings or insights
   */
  addFinding(finding) {
    this.conversationState.findingsCollected.push({
      finding,
      timestamp: Date.now()
    });
  }

  /**
   * Generate context for reflection tool
   */
  generateReflectionContext() {
    const elapsed = (Date.now() - this.conversationState.startTime) / 1000;

    // Build tools used summary
    const toolsSummary = this.conversationState.toolsUsed
      .map(t => `${t.tool}(${t.success ? '✓' : '✗'})`)
      .join(', ') || 'None yet';

    // Build search queries summary
    const searchSummary = this.conversationState.searchQueries
      .map(s => `"${s.query}"`)
      .join(', ') || 'None yet';

    // Build findings summary
    const findingsSummary = this.conversationState.findingsCollected
      .map(f => f.finding.slice(0, 100))
      .join('; ') || 'None yet';

    // Assess progress
    const progress = this.assessProgress();

    return {
      userQuestion: this.conversationState.userQuestion,
      conversationHistory: `Loop ${this.conversationState.currentLoop}/${this.conversationState.maxLoops} (${elapsed.toFixed(1)}s elapsed)`,
      toolsUsed: `Tools: ${toolsSummary} | Searches: ${searchSummary}`,
      currentTask: this.conversationState.taskProgress || 'Working on user request',
      groupDynamics: this.conversationState.groupDynamics || `No specific dynamics noted`,
      additionalContext: `Progress: ${progress} | Findings: ${findingsSummary}${this.conversationState.errors.length > 0 ? ' | Errors: ' + this.conversationState.errors.length : ''}`
    };
  }

  /**
   * Assess current progress
   */
  assessProgress() {
    const totalTools = this.conversationState.toolsUsed.length;
    const successfulTools = this.conversationState.toolsUsed.filter(t => t.success).length;
    const hasSearches = this.conversationState.searchQueries.length > 0;
    const hasFindings = this.conversationState.findingsCollected.length > 0;
    const hasErrors = this.conversationState.errors.length > 0;

    if (totalTools === 0) return 'Just started';
    if (hasErrors && successfulTools === 0) return 'Encountering issues';
    if (hasSearches && hasFindings) return 'Good progress with findings';
    if (hasSearches) return 'Researching actively';
    if (successfulTools > 0) return 'Making progress';

    return 'In progress';
  }

  /**
   * Get conversation summary
   */
  getSummary() {
    return {
      userQuestion: this.conversationState.userQuestion,
      toolsUsed: this.conversationState.toolsUsed.length,
      searchesMade: this.conversationState.searchQueries.length,
      findings: this.conversationState.findingsCollected.length,
      currentLoop: this.conversationState.currentLoop,
      progress: this.assessProgress()
    };
  }

  /**
   * Check if reflection is recommended
   */
  shouldReflect() {
    const { currentLoop, maxLoops, toolsUsed, errors } = this.conversationState;

    // Reflect if getting close to max loops
    if (currentLoop >= maxLoops - 3) return { should: true, reason: 'Approaching loop limit' };

    // Reflect if many tools used without clear progress
    if (toolsUsed.length >= 5 && this.conversationState.findingsCollected.length === 0) {
      return { should: true, reason: 'Many tools used but no clear findings' };
    }

    // Reflect if errors accumulating
    if (errors.length >= 2) return { should: true, reason: 'Multiple errors encountered' };

    // Reflect every 3 loops for strategic check-in
    if (currentLoop > 0 && currentLoop % 3 === 0) {
      return { should: true, reason: 'Periodic strategic review' };
    }

    return { should: false, reason: 'No reflection needed yet' };
  }
}

// Global context manager instance
export const contextManager = new ContextManager();
