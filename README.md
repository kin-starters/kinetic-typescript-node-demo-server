# Kinetic Demo Server - TypeScript SDK


## This app demonstrates how to integrate with [Kin](https://developer.kin.org/) via the [TypeScript SDK](https://developer.kin.org/docs/developers/typescript)



## Front End
This Kin BE Demo Server is compatible with our [Kinetic Playground](https://github.com/kin-starters/kin-dapp-playground)

## Prep
- Your App is registered on the [Kin Developer Portal](https://portal.kin.org/) so you can take advantage of the [Kin Rewards Engine](https://developer.kin.org/docs/the-kre-explained/) and get your App Index. 
- Environment variable for your App Index. Use `APP_INDEX=1` to get started before your own App Index is confirmed.
- Environment variable for your Keypair. Can be either `MNEMONIC` or `BYTE_ARRAY`. 
- Don't have a Keypair? 
    - Use the [Kinetic DApp Demo](https://github.com/kin-starters/kin-dapp-kinetic) to quickly generate a devnet Keypair and get your mnemonic phrase.
    - Or run [Kinetic](https://developer.kin.org/docs/developers/kinetic-deployment#running-kinetic-locally) locally to do the same.

`.env`

```
PORT=3001
APP_INDEX=1
KINETIC_ENDPOINT='https://your_kinetic_endpoint'
BYTE_ARRAY=[24,20,238,188,26,234,120,209,88,63,170,46,66,98,21,113,194,120,143,228,231,37,91,0,242,32,180,99,243,179,57,144,11,233,235,235,203,20,105,33,47,140,152,253,12,148,72,175,141,253,242,110,225,110,21,211,118,87,99,99,99,99,99,99]
MNEMONIC="cat dog elephant lion tiger shark whale diplodocus dragon pokemon transformer turtle"
```
## Install Packages

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
    "env": 'devnet',
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
### Transfer Kin in Batch of Earn Transactions
 ```
 POST /earn_batch

 Request Body
 {
    "from": "App",
    "batch": [
        {to: "User1", amount: "111"}, 
        {to: "User2", amount: "333"}
    ]
}

Response
200 or 400
```
### Transaction Details
 ```
 GET /transaction?transaction_id=uxMepF4pYrexvFKJEsU2ATzxU1MSJkqx51DCEek5SszAPygRUgsFYT8Ai6yJYLyKBJuqTd4sBnsC9wDWpCFWXi4


Response
200 and return string of transaction data 
or 400
```
### Account History
 ```
 GET /history?user=Test%20User


Response
200 and return string of transaction data 
or 400
```
## Webhooks Local Development
I use localtunnel for doing local development: https://theboroer.github.io/localtunnel-www/
```
lt --port 3001 --subdomain <webhook domain stored in the developer portal for this app>
```


You could also use ngrok: https://ngrok.com/

## If you're just getting started, you might want to look at [this](https://developer.kin.org/docs/developers) first...

## Dev Community
Join us on [Discord](https://discord.com/invite/kdRyUNmHDn) if you're looking for support with your App or to connect with other active Kin developers.
