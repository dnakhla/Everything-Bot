function streamToString(stream) {
    return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', (chunk) => (data += chunk));
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
    });
}

module.exports = { streamToString };