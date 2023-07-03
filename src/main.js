/**
 * Binance Bot
 * Useage.
 * Edit .env
 * node app.js
 **/

"use strict"
require('dotenv').config();
const { Spot } = require('@binance/connector');

// ENV SETTINGS 
const { 
  BINANCE_KEY : KEY, 
  BINANCE_SECRET : SECRET, 
  MINIMUM_WITHDRAW: MIN_WITHDRAW, 
  BUY_AMOUNT,
  WITHDRAW_ADDRESS,
  WITHDRAW_MEMO,
  BUY_COIN,
  BASE_CURRENCY
} = process.env;

// Options.
const CheckBalanceStruct = {
  USD : ["USDT"],
  BTS : ["BTS"],
  ALL : ["USDT", "BTS"]
};

// Binance Client
const client = new Spot(KEY, SECRET);

/**
 * Launch Application.
 * @constructor
 */
const App = async() => {
   onUpdate()
}

/**
 * Check User Balance.
 * @param {[]} coins
 *
 * */
async function checkBalance(coins) {
  return new Promise((resolve, reject) => {
    client.userAsset()
  .then(response => {
    let matches = {};
    for (let coin of coins) {
      const found = response.data.find(item => {
        if(item.asset === coin) {
          return true;
        }
      });
      if(found) {
        matches[coin] = { available: found.free };
      } else {
        matches[coin] = { available: 0.00 };
      }
    }
        resolve(matches);
  })
  .catch(error => reject(error))
  });
}


/**
 * Market Buy.
 * @param {number} quantity
 *
 * */
function marketBuy(quantity) {
  return new Promise((res, rej) => {
    client.newOrder(`${BUY_COIN}${BASE_CURRENCY}`, 'BUY', 'MARKET', {
      quantity: quantity
    }).then(response => res(true))
      .catch(error => {
        rej(error.response.data.msg)
      })
  })
}

/**
 * Check price of base asset..
 *
 * */
function checkPrice() {
  return new Promise((res, rej) => {
    client.tickerPrice(`${BUY_COIN}${BASE_CURRENCY}`).then(response => res(response.data.price))
  })
}

/**
 * Check Balance every xx.
 *
 * */
function onUpdate() {
  setInterval(async()=> {
    console.clear();
    const currentBalance = await checkBalance(CheckBalanceStruct.ALL).catch(err => "Failed to get balance");   
    console.log(`Current Balance USD: ${currentBalance.USDT.available}`);
    console.log(`Current Balance BTS: ${currentBalance.BTS.available}`);

    // If balance is more then our buy amount.
    if (currentBalance.USDT.available > BUY_AMOUNT) { // TODO: swap arrow 

      // check balance.
      const currentPrice = await checkPrice();
      const buy = (BUY_AMOUNT / currentPrice).toFixed(2);
      
      // buy
      try {
        const buyResponse = await marketBuy(buy);
      } catch (err) {
        console.error(err)
      }
    }

    // Check balance and withdraw if sufficient. 
    const withdraw = await checkWithdrawal().catch(err => console.log("Balance not yet enough to withdraw."));

  }, 1000);
}

/**
 * Withdraw
 * @param {string} symbol
 * @param {string} address
 * @param {number} quantity 
 * @param {number} memo
 * */
async function withdraw (symbol, address, quantity, memo) {
  return new Promise((res, rej) => {
    client.withdraw(
      symbol, // coin
      address, // withdraw address
      quantity, // amount
      {
        addressTag: memo
      }
    ).then(response => res(true))
      .catch(error => {
        console.log(error.response.data.msg)
        rej(false)
      })
  })
}

/**
 * Withdraw Fee.
 * Get cost of withdrawal.
 *
 * */
// FIX ENDPOINT > 
async function withdrawFee () {
  return new Promise((res, rej) => {
    client.assetDetail({ asset: BUY_COIN })
    .then(response => {
      if(response.data[BUY_COIN].withdrawStatus) {
        res({fee: response.data[BUY_COIN].withdrawFee, minAmount: response.data[BUY_COIN].minWithdrawAmount})
      } else {
        rej("Can not withdraw, wallet locked.")
      }      
    })
    .catch(error => client.logger.error(error));
  })
}

/**
 * Check Withdrawal
 * Check Balance is enough, Withdraw to given address minus the fee.
 * */
async function checkWithdrawal () {
  return new Promise(async(res,rej) => {
    const currentBalance = await checkBalance(CheckBalanceStruct.BTS);
    
    // Withdraw more then minimum ? 
    //console.log(currentBalance[BUY_COIN].available)
    if( currentBalance.available < MIN_WITHDRAW ) { //TODO: Change arrow to opposite.
      try {
        // Withdrawal fee.
        const remove = await withdrawFee();
        console.log(remove)
        const total = currentBalance[BUY_COIN].available - remove.fee;

        // Withdraw
        if(total > remove.minAmount) {
          const withdrawRes = await withdraw(BUY_COIN, WITHDRAW_ADDRESS, total, WITHDRAW_MEMO);
          console.log("Sucessfully withdrawn funds to wallet.")
          res(true)
        } else
          rej(false)
        }
      catch(err) {
        rej(false)
      }
    }
  })
}

module.exports = { App };
