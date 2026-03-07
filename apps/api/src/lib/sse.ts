import { Response } from 'express';

const clients = new Map<string, Set<Response>>();

export function addClient(boardId: string, res: Response) {
    let boardClients = clients.get(boardId);
    if (!boardClients) {
        boardClients = new Set();
        clients.set(boardId, boardClients);
    }
    boardClients.add(res);

    res.on('close', () => {
        boardClients?.delete(res);
        if (boardClients?.size === 0) {
            clients.delete(boardId);
        }
    });

    // Send initial heartbeat to establish connection
    res.write(`:\n\n`);

    // Keep connection alive with a periodic comment
    const interval = setInterval(() => {
        res.write(`:\n\n`);
    }, 15000);

    res.on('close', () => {
        clearInterval(interval);
    });
}

export function broadcast(boardId: string, event: string, data: unknown) {
    const boardClients = clients.get(boardId);
    if (!boardClients) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of boardClients) {
        client.write(payload);
    }
}
