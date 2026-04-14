const express = require('express');
const bus = require('../services/event-bus');

const router = express.Router();

router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(':\n\n'); // heartbeat

  const onEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  bus.on('event', onEvent);

  // Heartbeat every 30s
  const hb = setInterval(() => res.write(':\n\n'), 30000);

  req.on('close', () => {
    bus.off('event', onEvent);
    clearInterval(hb);
  });
});

module.exports = router;
