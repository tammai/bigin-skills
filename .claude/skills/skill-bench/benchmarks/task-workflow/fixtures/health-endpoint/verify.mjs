import { createApp } from './server.js';

const server = createApp().listen(0, async () => {
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();
    if (res.status === 200 && body.status === 'ok') {
      console.log('health check passed');
      process.exit(0);
    }
    console.error('unexpected response', res.status, body);
    process.exit(1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    server.close();
  }
});
