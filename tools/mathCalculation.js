import { evaluate } from 'mathjs';
import { createToolWrapper } from '../utils/toolWrapper.js';

// Core math service function
async function mathEvaluationService(expression) {
  const result = evaluate(expression);
  
  // Format the result appropriately
  if (typeof result === 'number') {
    return Number.isInteger(result) ? result : parseFloat(result.toFixed(8));
  } else if (typeof result === 'object' && result.toString) {
    return result.toString();
  }
  
  return result;
}

// Wrapped tool for agent use
export const performMathCalculation = createToolWrapper(
  mathEvaluationService,
  {
    name: 'performMathCalculation',
    category: 'math',
    description: 'Perform mathematical calculations and evaluations',
    validateParams: (expression) => typeof expression === 'string' && expression.trim() !== '',
    formatResult: (result, params) => {
      const [expression] = params;
      return `📊 Math calculation: ${expression} = ${result}`;
    },
    errorMessage: 'Error calculating mathematical expression'
  }
);