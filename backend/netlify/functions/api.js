import app from '../../server.js';

export const handler = async (event, context) => {
    // Construire l'objet req à partir de l'événement Lambda
    const req = {
        method: event.httpMethod,
        url: event.path,
        headers: event.headers,
        query: event.queryStringParameters || {},
        body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : null,
        get: (key) => event.headers[key.toLowerCase()],
        header: (key) => event.headers[key.toLowerCase()],
    };

    // Parser le body JSON si nécessaire
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json') && req.body) {
        try { req.body = JSON.parse(req.body); } catch (e) {}
    }

    let statusCode = 200;
    let responseBody = '';
    let responseHeaders = {};

    // Créer l'objet res
    const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { responseBody = JSON.stringify(data); responseHeaders['Content-Type'] = 'application/json'; },
        send: (data) => { responseBody = data; },
        setHeader: (key, value) => { responseHeaders[key] = value; },
        end: () => {},
    };

    // Exécuter l'application Express comme un middleware
    await new Promise((resolve, reject) => {
        app(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    return {
        statusCode,
        headers: responseHeaders,
        body: responseBody,
        isBase64Encoded: false,
    };
};