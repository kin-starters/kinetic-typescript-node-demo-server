import express from 'express';
import cors from 'cors';

import {
  Client,
  Environment,
  kinToQuarks,
  PrivateKey,
  PublicKey,
  TransactionType,
} from '@kinecosystem/kin-sdk-v2';

const app = express();
app.use(cors());

const port = 3001;

// Set up Kin client
let kinClient = {};

app.get('/healthcheck', (req, res) => {
  console.log('🚀 ~ /healthcheck');
  res.send(JSON.stringify(kinClient));
});

app.post('/setup', (req, res) => {
  console.log('🚀 ~ /setup');
  const env = req.query.env === 'Prod' ? Environment.Prod : Environment.Test;
  const appIndex = Number(req.query.appIndex);
  kinClient = new Client(env, { appIndex });
  console.log('🚀 ~ kinClient', kinClient);
  res.sendStatus(201);
});

async function createKinAccount(res) {
  const key = PrivateKey.random();
  console.log('🚀 ~ key', key);
  res.send('okay!');
}

app.post('/account', (req, res) => {
  console.log('🚀 ~ /account');
  createKinAccount(res);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.sendStatus(404);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
