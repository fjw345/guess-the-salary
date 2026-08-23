import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app.js';

type GuessSalaryApp = Awaited<ReturnType<typeof buildApp>>;

let appPromise: Promise<GuessSalaryApp> | undefined;

function getApp() {
  appPromise ??= buildApp({
    logger: false,
    storage: 'database',
    trustProxy: true,
  });
  return appPromise;
}

export default async function vercelHandler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const app = await getApp();
  await app.ready();

  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      response.removeListener('finish', finish);
      response.removeListener('close', finish);
      response.removeListener('error', fail);
      resolve();
    };
    const fail = (error: Error) => {
      response.removeListener('finish', finish);
      response.removeListener('close', finish);
      response.removeListener('error', fail);
      reject(error);
    };

    response.once('finish', finish);
    response.once('close', finish);
    response.once('error', fail);
    app.server.emit('request', request, response);
  });
}
