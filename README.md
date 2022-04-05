# Kin Node SDK Demo


## This app demonstrates how to integrate with [Kin](https://developer.kin.org/) via the [Node SDK](https://github.com/kinecosystem/kin-node)



## Front End
This Kin BE Demo Server is compatible with our [Kin DApp Playground](https://github.com/kin-starters/kin-dapp-playground)

## Prep
- Your App is registered on the [Kin Developer Portal](https://portal.kin.org/) so you can take advantage of the [Kin Rewards Engine](https://developer.kin.org/docs/the-kre-explained/) and get your App Index
- Environment variable for your App Index
- Environment variable for your Private Key. Visit [The Kin Laboratory](https://laboratory.kin.org/home) if you want help getting started with Keypairs for testing
- Environment variable for your Webhook Secret (if using webhooks)

`.env`

```
APP_INDEX=Your App App Index
PRIVATE_KEY=Your App Account Secret Key
SERVER_WEBHOOK_SECRET=Your Webhook Secret
```
## Install Packages - Make sure you're using Node 12

```
npm i
```

or

```
yarn
```
## Start

```
npm run start
```

or

```
yarn start
```
## Endpoints
### Status
```
GET /status

Response:
200 {
    "appIndex": 360,
    "env": 1,
    "transactions": [],
    "users": [
        {
            "name": "App",
            "publicKey": "BsiFeVHeyYv56rBfmotqbeDU7Q9rs8SYkXRsm3umsYvV"
        }
    ]
}


```

### Setup
 ```
 POST /setup?env=Test or setup?env=Prod

Response
200 or 400
```
### Create Account
 ```
 POST /account?name=Test%20User

Response
201 or 400
```
### Balance
 ```
 GET /balance?user=Test%20User

Response
'999' or 400
```
### Airdrop
 ```
 POST /airdrop?to=Test%20User&amount=2000

Response
200 or 400
```
### Transfer Kin
 ```
 POST /send

 Request Body
 {
    "from": "App",
    "to": "Test User",
    "amount": "2000",
    "type": "Earn"
}

Response
200 or 400
```
### Transaction Info
 ```
 GET /transaction?transaction_id=uxMepF4pYrexvFKJEsU2ATzxU1MSJkqx51DCEek5SszAPygRUgsFYT8Ai6yJYLyKBJuqTd4sBnsC9wDWpCFWXi4


Response
200 {
    "payments": [
        {
            "destination": "GTpeCtraqEzkbSChQCmakFqyHpNU3iensTWnX58yQrk6",
            "quarks": 100000000,
            "sender": "89CLzhYJzZKs8mZ3GkwPeJfb3wHVJqGunyryBNjJhiDH",
            "type": 1
        }
    ],
    "txState": 3
} 
or 400
```
## If you're just getting started, you might want to look at [this](https://developer.kin.org/tutorials/#getting-started) first...

## Dev Community
Join us on [Discord](https://discord.com/invite/kdRyUNmHDn) if you're looking for support with your App or to connect with other active Kin developers.

If you're stuck or have any questions you'd like answering, get in touch on our [kin-node](https://discord.com/channels/808859554997469244/811117045742960640) channel.