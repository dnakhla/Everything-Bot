/**
 * Converts a readable stream to a string
 * @param {Stream} stream - The readable stream to convert
 * @returns {Promise<string>} - A promise that resolves to the string content
 */
export function streamToString(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (chunk) => (data += chunk));
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}